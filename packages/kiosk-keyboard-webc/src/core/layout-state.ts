import type { CustomLayoutFold } from "./custom-layout-fold.js";
import { getLayoutMeta } from "./layout-meta.js";
import { constrainedLayoutName } from "./layout-constraint.js";
import { getRegisteredLayout, resolveLayoutName } from "./layout-registry.js";
import { getText } from "./i18n.js";
import { LAYOUT_BASE } from "./key-token.js";
import type { KeyboardType } from "../types.js";

/**
 * Whether the active layout was last set by a user-driven `{layout:X}` key tap
 * (`"user"`) or by a programmatic / auto-detected change (`"external"`).
 *
 * User-driven switches override the `keyboardType` constraint so a `{layout:special}`
 * tap in Numeric/Numpad mode shows the special layout. `{layout:base}`, the `layout`
 * attribute, `keyboardType` changes and auto-type detection all reset this back to
 * `"external"`.
 */
type LayoutSource = "user" | "external";

/** The key focus sat on before a switch re-rendered the grid. */
export interface FocusAnchor {
  value: string | null;
  focused: boolean;
}

/** The slice of the host element the layout state reads and writes back into. */
interface LayoutStateHost {
  /** The reactive `_currentLayout` property: empty until the first real switch. */
  getCurrentLayout(): string;
  setCurrentLayout(name: string): void;
  /** The `layout` attribute as authored, which may name a not-yet-slotted layout. */
  getLayoutAttribute(): string;
  /** Locale-derived default, honoring the per-instance locale and layout overrides. */
  getLocaleLayout(): string;
  getKeyboardType(): `${KeyboardType}`;
  getFold(): CustomLayoutFold;
  fireLayoutChange(parameters: { layout: string; autoDetected: boolean }): void;
  /** Selecting a layout always resets the typing context. */
  resetShiftState(): void;
  endComposition(): void;
  focusAnchor(): FocusAnchor;
  reseatFocusAnchor(anchor: FocusAnchor): void;
  /** A change re-opens the width-tier question at an unchanged width. */
  reapplyAutoCompact(): void;
  announce(text: string): void;
}

/**
 * Owns which layout is active and who asked for it: the base (alphabetic) layout
 * `{layout:base}` returns to, the layout last requested, and the source that drove
 * the current one.
 *
 * Three request entry points, because the element accepts a layout three ways -
 * the `layout` attribute, a `{layout:*}` key, and the reset that ends a session -
 * plus `applyTier`, which is an *arrangement* the `autoCompact` width observer
 * imposes and which must leave the request alone.
 *
 * Unlike the kiosk twin, a requested name is not validated against the registry at
 * request time on the attribute path: the slot is populated asynchronously by
 * `_processChildren`, so a custom layout appended in the same task is not in the
 * fold yet and an early check would reject a name that is about to be perfectly
 * valid. {@link resolvedName} reports the fallback from the render pass instead,
 * where the fold is authoritative.
 */
export class LayoutState {
  private readonly _host: LayoutStateHost;
  /** The base (alphabetic) layout `{layout:base}` and the session reset return to. */
  private _base = "";
  /** The layout last asked for, which the width tier resolves its counterpart against. */
  private _requested = "";
  private _source: LayoutSource = "external";
  /** Caps the unregistered-layout warning at one per distinct name. */
  private readonly _warnedUnregistered = new Set<string>();

  constructor(host: LayoutStateHost) {
    this._host = host;
  }

  /**
   * Seeds the base and requested layout on connect, once. An authored `layout`
   * attribute reaches the first render through {@link resolvedName}'s fallback
   * chain, so only the unauthored case seats `_currentLayout` here.
   */
  seed(): void {
    if (this._base) return;
    this._base = this._host.getLayoutAttribute() || this._host.getLocaleLayout();
    this._requested = this._base;
    if (!this._host.getLayoutAttribute()) {
      this._host.setCurrentLayout(this._base);
    }
  }

  /**
   * Drops a user-driven `{layout:X}` override, so the resolved layout follows the
   * constraint context again. Called on every `keyboardType` change.
   */
  clearUserOverride(): void {
    this._source = "external";
  }

  /**
   * Applies the `layout` attribute. Applied unconditionally - see the class doc for
   * why the registry check cannot happen here.
   */
  applyAttribute(rawName: string): void {
    const requested = rawName.trim().toLowerCase();
    this._requested = requested;
    this._apply(requested, "external");
    // A new request re-opens the tier question at an unchanged width, which no
    // resize would report.
    this._host.reapplyAutoCompact();
  }

  /** Applies a `{layout:*}` key, whose target the fold is authoritative about by now. */
  applyKeySwitch(layoutName: string): void {
    const isBase = layoutName === LAYOUT_BASE;
    if (!isBase && !getRegisteredLayout(layoutName, this._host.getFold().layouts)) {
      console.warn(`[kiosk-keyboard] Layout "${layoutName}" referenced by a {layout:*} key is not registered.`);
      return;
    }
    this._request(isBase ? this._fallbackBase() : layoutName, isBase ? "external" : "user");
  }

  /**
   * Returns the active surface to the base (alphabetic) layout, mirroring the kiosk
   * twin's `resetLayout()`. Fires `layout-change` only on a real change.
   */
  resetToBase(): void {
    this._request(this._fallbackBase(), "external");
  }

  /**
   * Applies the `autoCompact` width tier: the requested layout's compact counterpart
   * while the keyboard is too narrow for it, the requested layout itself once the room
   * returns. Called from `AutoCompactController` on a frame of its own, never
   * from the observation callback.
   *
   * Deliberately not routed through the request paths: this is not a request and must
   * leave the requested layout alone, or the first swap would erase the layout it has
   * to swap back to. An unregistered counterpart resolves to no swap rather than to
   * the default layout, since a consumer who names a missing one should keep the
   * layout they asked for.
   *
   * The tier is compared against the layout on screen, not against the current layout:
   * a `layout` attribute present before the element connects reaches the first render
   * through the fallback chain of {@link resolvedName} without passing through the
   * current layout, which stays empty until the first switch.
   */
  applyTier(narrow: boolean, crossed: boolean): void {
    // Numpad and Numeric pin the rendered surface to their own layout, so tiering
    // would emit `layout-change` naming a layout that is not the one on screen.
    if (constrainedLayoutName(this._host.getKeyboardType()) !== null) return;

    const fold = this._host.getFold();
    const requested = this._requested;
    const compact = narrow ? getLayoutMeta(requested, fold.layoutMeta)?.compact : undefined;
    const target = compact ?? requested;
    if (target === this.resolvedName()) return;
    if (!getRegisteredLayout(target, fold.layouts)) return;

    // The tier is an arrangement, not a request, so it must not become the base:
    // a `{layout:base}` key and `resetToBase` both return to the layout that was
    // asked for. `_apply` promotes any non-secondary name it applies, so the base is
    // restored around it.
    const base = this._base;
    const changed = this._apply(target, this._source);
    this._base = base;
    if (changed) {
      // Announced only when a width the user crossed rearranged the keyboard under
      // them: the one layout change with no interaction behind it, and so the only
      // one a screen reader user has no other way of learning about. The first
      // resolution of a keyboard that was always this narrow rearranged nothing they
      // had seen, and a requested switch re-seats focus onto the key it followed,
      // which announces itself; announcing either would speak over the interaction.
      //
      // The direction is announced rather than the layout's name: the name is an
      // identifier the user never chose and never sees, and it would enter a
      // translated sentence untranslated. Two texts rather than one because the live
      // region is a plain text write, so a repeat of what it already holds is dropped
      // - and consecutive announcements always alternate direction, since
      // `AutoCompactController` only reports a verdict that differs from the last.
      if (crossed) {
        this._host.announce(
          narrow
            ? getText("ARIA_LAYOUT_COMPACTED", "Switched to the compact keyboard layout")
            : getText("ARIA_LAYOUT_UNCOMPACTED", "Switched back to the standard keyboard layout"),
        );
      }
      this._host.fireLayoutChange({ layout: target, autoDetected: true });
    }
  }

  /**
   * The effective layout name for the current state: an explicit user switch (via a
   * `{layout:...}` key) takes precedence, then the keyboardType constraint
   * (Numpad/Numeric force their layout), then the current/base/attribute/locale
   * fallback chain. The result is run through the registry, so an unregistered name
   * reports the default layout it actually falls back to. Rendering, the
   * accent-variant table and composition-middleware resolution all read this name, so
   * none of them can key off a layout other than the one rendered.
   */
  resolvedName(): string {
    const current = this._host.getCurrentLayout();
    const requested =
      this._source === "user"
        ? current
        : (constrainedLayoutName(this._host.getKeyboardType()) ??
          (current || this._base || this._host.getLayoutAttribute() || this._host.getLocaleLayout()));
    const resolved = resolveLayoutName(requested, this._host.getFold().layouts);
    if (resolved !== requested && requested && !this._warnedUnregistered.has(requested)) {
      this._warnedUnregistered.add(requested);
      console.warn(
        `[kiosk-keyboard] Layout "${requested}" is not registered, so "${resolved}" renders instead. Declare it as a <kiosk-keyboard-custom-layout> in the customLayouts slot.`,
      );
    }
    return resolved;
  }

  /** The layout a `{layout:base}` key and the session reset fall back through. */
  private _fallbackBase(): string {
    return this._base || this._host.getLayoutAttribute() || this._host.getLocaleLayout();
  }

  /** Records a request, applies it, and announces a real change. */
  private _request(name: string, source: LayoutSource): void {
    this._requested = name;
    if (this._apply(name, source)) {
      this._host.fireLayoutChange({ layout: this._host.getCurrentLayout(), autoDetected: false });
    }
    // A new request re-opens the tier question at an unchanged width, which no
    // resize would report.
    this._host.reapplyAutoCompact();
  }

  /**
   * Apply a resolved layout as the active surface: track the base (alphabetic)
   * layout, record who drove the switch, and reset the typing context.
   *
   * Selecting a layout always resets shift/caps-lock, even a re-selection of the
   * active layout. The `source` only changes on a real switch so a no-op can't
   * silently flip the constraint-override. Returns whether the layout changed.
   */
  private _apply(currentLayout: string, source: LayoutSource): boolean {
    if (getLayoutMeta(currentLayout, this._host.getFold().layoutMeta)?.secondary !== true) {
      this._base = currentLayout;
    }
    const changed = currentLayout !== this._host.getCurrentLayout();
    const anchor = changed ? this._host.focusAnchor() : null;
    if (changed) {
      this._host.setCurrentLayout(currentLayout);
      this._source = source;
      // A real layout switch ends any in-progress composition: commit the preedit
      // to the target and drop the middleware so the next key resolves the new
      // layout's middleware. Covers both a programmatic `layout` change and the
      // {layout:*} key path.
      this._host.endComposition();
    }
    this._host.resetShiftState();
    if (anchor) {
      this._host.reseatFocusAnchor(anchor);
    }
    return changed;
  }
}
