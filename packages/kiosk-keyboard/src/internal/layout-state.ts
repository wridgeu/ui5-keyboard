import Log from "sap/base/Log";
import type { CustomLayoutFold } from "./custom-layout-fold";
import { getLayoutMeta } from "./layout-meta";
import { constrainedLayoutName } from "./layout-constraint";
import {
  getRegisteredLayout as registryGetLayout,
  resolveLayoutName as registryResolveLayoutName,
} from "./layout-registry";
import { getText } from "./i18n-registry";
import type { KeyboardType } from "../library";

/**
 * Whether the active layout was last set by a user-driven `{layout:X}` key tap
 * (`"user"`) or by a programmatic / auto-detected change (`"external"`).
 *
 * User-driven switches override the `keyboardType` constraint so a `{layout:special}`
 * tap in Numeric/Numpad mode shows the special layout. `{layout:base}`, `setLayout`,
 * `setKeyboardType`, `resetKeyboardType`, and auto-type detection all reset this
 * back to `"external"`.
 */
type LayoutSource = "external" | "user";

/** The slice of the control the layout state reads and writes back into. */
interface LayoutStateHost {
  /** The `layout` property: the layout on screen, not the last one asked for. */
  getLayout(): string;
  /** Writes the `layout` property directly, bypassing the public setter this drives. */
  setLayoutProperty(name: string): void;
  getKeyboardType(): KeyboardType;
  getFold(): CustomLayoutFold;
  fireLayoutChange(parameters: { layout: string; autoDetected: boolean }): void;
  /** Selecting a layout always resets the typing context. */
  resetShiftState(): void;
  endComposition(): void;
  /** The key focus sits on, captured before a switch re-renders the grid. */
  focusAnchorValue(): string | null;
  reseatFocusAnchor(value: string | null): void;
  /** A change re-opens the width-tier question at an unchanged width. */
  reapplyAutoCompact(): void;
  warnTierWriteBack(): void;
}

/**
 * Owns which layout is active and who asked for it: the base (alphabetic) layout
 * `{layout:base}` returns to, the layout last requested, the source that drove the
 * current one, and the tier announcement waiting on a render.
 *
 * Two entry points, deliberately distinct. {@link perform} is a *request* -
 * `setLayout` and the `{layout:*}` key - validated against the registry and kept as
 * the layout to swap back to. {@link applyTier} is an *arrangement* the `autoCompact`
 * width observer imposes, which must leave the request alone.
 */
export default class LayoutState {
  private readonly _host: LayoutStateHost;
  /** The base (alphabetic) layout `{layout:base}`, `resetLayout()` and `reset()` return to. */
  private _base = "";
  /** The layout last asked for, which the width tier resolves its counterpart against. */
  private _requested = "";
  private _source: LayoutSource = "external";
  /** Live-region text for a width-driven swap, held until the render it triggers is done. */
  private _pendingAnnouncement: string | null = null;

  constructor(host: LayoutStateHost) {
    this._host = host;
  }

  /** Seeds the base and requested layout from the locale default, before any request. */
  seed(name: string): void {
    this._base = name;
    this._requested = name;
  }

  getBaseLayout(): string {
    return this._base;
  }

  getSource(): LayoutSource {
    return this._source;
  }

  /**
   * Drops a user-driven `{layout:X}` pick: the source returns to `"external"` and the
   * `layout` property to the base layout, so the resolved layout follows the
   * constraint context again and a lifted constraint lands on the base rather than
   * on the pick. A programmatic or `{layout:base}` layout is left alone. Called on a
   * real target switch and on every `keyboardType` change.
   */
  clearUserOverride(): void {
    if (this._source !== "user") return;
    // Explicit, not left to `_apply`: a pick of a primary layout is already the base,
    // so the request below is a no-op that would leave the source at "user".
    this._source = "external";
    this.perform(this._base, "external", "held as the base layout");
  }

  /**
   * Takes the tier announcement waiting on a render, or `null` when none is due.
   *
   * Held rather than queued at the swap so a request arriving in the same task can
   * still retract it - once queued there is no taking it back, and a text naming the
   * arrangement a request has just replaced would put a screen reader user on a
   * layout the keyboard has left.
   */
  takePendingAnnouncement(): string | null {
    const pending = this._pendingAnnouncement;
    this._pendingAnnouncement = null;
    return pending;
  }

  /**
   * Requests a layout: normalize (trim + lowercase) -> validate against the registry
   * (warn and bail when unregistered) -> apply -> fire `layoutChange` on a real
   * change. Returns whether the layout changed.
   *
   * @param rawName Requested layout name; normalized here.
   * @param source  Who drove the switch.
   * @param origin  Requester description used in the unregistered warning.
   */
  perform(rawName: string, source: LayoutSource, origin: string): boolean {
    const name = rawName.trim().toLowerCase();
    if (!registryGetLayout(name, this._host.getFold().layouts)) {
      Log.warning(
        `Layout "${name}" ${origin} is not registered. Declare it as a <kiosk:CustomLayout> in the customLayouts aggregation.`,
        undefined,
        "ui5.kiosk.KioskKeyboard",
      );
      return false;
    }
    this._requested = name;
    // A request supersedes any tier announcement still waiting on a render, which
    // would otherwise name the layout this switch just replaced.
    this._pendingAnnouncement = null;
    const changed = this._apply(name, source);
    if (changed) {
      this._host.fireLayoutChange({ layout: name, autoDetected: false });
    }
    // A new request re-opens the tier question at an unchanged width, which no
    // resize would report.
    this._host.reapplyAutoCompact();
    return changed;
  }

  /**
   * Applies the `autoCompact` width tier: the requested layout's compact counterpart
   * while the keyboard is too narrow for it, the requested layout itself once the room
   * returns. Called from `AutoCompactBehavior` on a frame of its own, never from
   * the observation callback.
   *
   * Deliberately not routed through {@link perform}: it must leave the requested
   * layout alone, or the first swap would erase the layout it has to swap back to. An
   * unregistered counterpart resolves to no swap rather than to the default layout,
   * since a consumer who names a missing one should keep the layout they asked for.
   */
  applyTier(narrow: boolean, crossed: boolean): void {
    // Numpad and Numeric pin the rendered surface to their own layout, so tiering
    // would fire `layoutChange` naming a layout that is not the one on screen.
    if (constrainedLayoutName(this._host.getKeyboardType()) !== null) return;

    const fold = this._host.getFold();
    const requested = this._requested;
    const compact = narrow ? getLayoutMeta(requested, fold.layoutMeta)?.compact : undefined;
    const target = compact ?? requested;
    if (target === this._host.getLayout()) return;
    if (!registryGetLayout(target, fold.layouts)) return;

    // The tier is an arrangement, not a request, so it must not become the base:
    // `{layout:base}`, `resetLayout()` and `reset()` all return to the layout that
    // was asked for. `_apply` promotes any non-secondary name it applies, so the
    // base is restored around it.
    const base = this._base;
    const changed = this._apply(target, this._source);
    this._base = base;
    if (changed) {
      // Announced only on a width the user crossed: the one layout change with no
      // interaction behind it. A keyboard that was always this narrow rearranged
      // nothing they had seen, and a requested switch re-seats focus onto the key it
      // followed, which announces itself.
      //
      // The direction rather than the layout's name - an identifier the user never
      // chose, which would enter a translated sentence untranslated. Two texts, not
      // one: a live region speaks on change, and consecutive announcements always
      // alternate direction.
      if (crossed) {
        this._pendingAnnouncement = narrow
          ? getText("ARIA_LAYOUT_COMPACTED", "Switched to the compact keyboard layout")
          : getText("ARIA_LAYOUT_UNCOMPACTED", "Switched back to the standard keyboard layout");
      }
      this._host.warnTierWriteBack();
      this._host.fireLayoutChange({ layout: target, autoDetected: true });
    }
  }

  /**
   * The effective layout NAME for the current state, shared by the renderer, the
   * accent-variant table and the composition-middleware lookup so none of them
   * resolve to a different layout than the one rendered. A user-driven `{layout:X}`
   * switch wins (it overrides the keyboardType constraint), then the keyboardType
   * constraint (Numpad/Numeric force their layout), then the `layout` property. The
   * result is run through the registry, so an unregistered name reports the default
   * layout it actually falls back to.
   */
  resolvedName(): string {
    const layout = this._host.getLayout();
    const requested =
      this._source === "user" ? layout : (constrainedLayoutName(this._host.getKeyboardType()) ?? layout);
    return registryResolveLayoutName(requested, this._host.getFold().layouts);
  }

  /**
   * State-application step of {@link perform}: track the base (alphabetic) layout,
   * record who drove the switch, and write the `layout` property. The caller
   * validates `name` against the registry first. Returns whether the property value
   * actually changed.
   *
   * Selecting a layout always resets the typing context (shift/caps-lock), even a
   * re-selection of the active layout. The `source` only changes on a real switch so
   * a no-op re-selection can't silently flip the constraint-override.
   */
  private _apply(name: string, source: LayoutSource): boolean {
    if (getLayoutMeta(name, this._host.getFold().layoutMeta)?.secondary !== true) {
      this._base = name;
    }
    const changed = name !== this._host.getLayout();
    const anchorValue = changed ? this._host.focusAnchorValue() : null;
    if (changed) {
      this._source = source;
      // A real layout switch ends any in-progress composition so the next key
      // resolves the new layout's middleware. Covers both programmatic
      // setLayout() and the {layout:*} key path.
      this._host.endComposition();
    }
    this._host.resetShiftState();
    this._host.setLayoutProperty(name);
    if (changed) {
      this._host.reseatFocusAnchor(anchorValue);
    }
    return changed;
  }
}
