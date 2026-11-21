import type { CustomLayoutFold } from "./custom-layout-fold.js";
import { getLayoutMeta } from "./layout-meta.js";
import { constrainedLayoutName } from "./layout-constraint.js";
import { getRegisteredLayout, resolveLayoutName } from "./layout-registry.js";
import { getText } from "./i18n.js";
import { LAYOUT_BASE } from "./key-token.js";
import type { KeyboardType, LayoutChangeEventDetail, LayoutChangeReason } from "../types.js";

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

type Reason = `${LayoutChangeReason}`;

/**
 * What re-derived the layout: a `{layout:*}` key or the session reset, the `layout`
 * attribute, a width verdict, or an input the state reads but does not own (the
 * `keyboardType`, the folded layout table).
 */
type CommitCause = "request" | "attribute" | "tier" | "refresh";

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
  /** Writes the `layout` property, which reflects to the attribute. */
  setLayoutAttribute(name: string): void;
  /** Locale-derived default, honoring the per-instance locale and layout overrides. */
  getLocaleLayout(): string;
  getKeyboardType(): `${KeyboardType}`;
  /** Whether `autoCompact` is on; while it is off no verdict resolves to a counterpart. */
  isAutoCompactEnabled(): boolean;
  getFold(): CustomLayoutFold;
  fireLayoutChange(parameters: LayoutChangeEventDetail): void;
  /** Selecting a layout always resets the typing context. */
  resetShiftState(): void;
  /**
   * Abandons a key press still held: the keycap under it now shows another key, so
   * its release must not type that one.
   */
  cancelPress(): void;
  endComposition(): void;
  focusAnchor(): FocusAnchor;
  reseatFocusAnchor(anchor: FocusAnchor): void;
  announce(text: string): void;
}

/**
 * Owns which layout is active and who asked for it. It stores only inputs - the
 * layout last requested, the base (alphabetic) layout `{layout:base}` returns to, the
 * source that drove the current one, and the `autoCompact` width verdict - and
 * derives the layout to render from them in {@link _commit}, the one place
 * `_currentLayout` changes.
 *
 * Two layouts are public. The `layout` property is the *intent*: what the app set, or
 * a primary layout the user picked with a `{layout:*}` key, which it reflects the way
 * `<details open>` reflects a user toggle - never a secondary pick, a width swap, a
 * constraint or a registry fallback. {@link resolvedName} is the *effective* layout,
 * the one on screen, with all of those applied. `layout-change` fires once per change
 * of either, from {@link _report}.
 *
 * Three *request* entry points, one per way the element accepts a layout - the
 * `layout` attribute, a `{layout:*}` key, and the reset that ends a session - plus
 * {@link applyTier} for the width verdict and {@link refresh} for the inputs the
 * element owns.
 *
 * The attribute path does not validate against the registry at request time: the slot
 * is populated asynchronously by `_processChildren`, so a custom layout appended in
 * the same task is not in the fold yet and an early check would reject a name that is
 * about to be perfectly valid. {@link resolvedName} reports the fallback from the
 * render pass instead, where the fold is authoritative, and {@link settle} reports
 * there what such a request changed.
 */
export class LayoutState {
  private readonly _host: LayoutStateHost;
  /** The intent as last written, normalized; empty while the locale layout stands in. */
  private _intent = "";
  /** The base (alphabetic) layout `{layout:base}` and the session reset return to. */
  private _base = "";
  /** The layout last asked for, which the width tier resolves its counterpart against. */
  private _requested = "";
  private _source: LayoutSource = "external";
  /** The `autoCompact` width verdict: too narrow, wide enough, or none measured. */
  private _narrow: boolean | null = null;
  /** The intent and the effective layout `layout-change` last reported, or was seeded with. */
  private _reportedLayout = "";
  private _reportedEffective = "";
  /** The effective layout the switch effects last ran for: the one on screen. */
  private _rendered = "";
  /** The reason of a report held until {@link settle}, while the fold may still be filling. */
  private _held: Reason | null = null;
  /** Caps the unregistered-layout warning at one per distinct name. */
  private readonly _warnedUnregistered = new Set<string>();

  constructor(host: LayoutStateHost) {
    this._host = host;
  }

  /**
   * Seeds the intent, the base, the requested layout and the layout on screen on
   * connect, once, without an event. A `layout` attribute naming a secondary layout
   * is rendered but is not the base, which falls through to the locale layout so
   * `{layout:base}` and the session reset still return to an alphabetic layout.
   * Seating `_currentLayout` here keeps the first `{layout:*}` tap from announcing the
   * layout already on screen as a change.
   */
  seed(): void {
    if (this._base) return;
    const attribute = this._host.getLayoutAttribute().trim().toLowerCase();
    const secondary = getLayoutMeta(attribute, this._host.getFold().layoutMeta)?.secondary === true;
    this._intent = attribute;
    this._requested = attribute || this._host.getLocaleLayout();
    this._base = attribute && !secondary ? attribute : this._host.getLocaleLayout();
    this._host.setCurrentLayout(this._requested);
    this._reportedLayout = this._intentName();
    this._reportedEffective = this._resolve().resolved;
    this._rendered = this._reportedEffective;
  }

  /**
   * Drops a user-driven `{layout:X}` pick: the source returns to `"external"` and the
   * surface to the base layout, so the resolved layout follows the constraint context
   * again and a lifted constraint lands on the base rather than on the pick. A
   * programmatic or `{layout:base}` layout is left alone. Called on every
   * `keyboardType` change.
   */
  clearUserOverride(): void {
    if (this._source !== "user") return;
    // Explicit, not left to `_commit`: a pick of a primary layout is already the base,
    // so the request below is a no-op that would leave the source at "user".
    this._source = "external";
    this.resetToBase("keyboardType");
  }

  /**
   * Applies the `layout` attribute, unconditionally - see the class doc for why. The
   * value the intent already holds is a no-op, which is also what keeps a reflected
   * user pick from re-entering here as a request.
   */
  applyAttribute(rawName: string): void {
    const name = rawName.trim().toLowerCase();
    if (name === this._intent) return;
    this._intent = name;
    this._request(name, "attribute", "external", "api");
  }

  /** Applies a `{layout:*}` key, whose target the fold is authoritative about by now. */
  applyKeySwitch(layoutName: string): void {
    const isBase = layoutName === LAYOUT_BASE;
    if (!isBase && !getRegisteredLayout(layoutName, this._host.getFold().layouts)) {
      console.warn(`[kiosk-keyboard] Layout "${layoutName}" referenced by a {layout:*} key is not registered.`);
      return;
    }
    const name = isBase ? this._fallbackBase() : layoutName;
    if (getLayoutMeta(name, this._host.getFold().layoutMeta)?.secondary !== true) this._writeIntent(name);
    this._request(name, "request", isBase ? "external" : "user", "user");
  }

  /**
   * Returns the active surface to the base (alphabetic) layout and makes it the intent. Fires `layout-change` only on a
   * real change.
   */
  resetToBase(reason: Reason = "api"): void {
    const name = this._fallbackBase();
    this._writeIntent(name);
    this._request(name, "request", "external", reason);
  }

  /**
   * Records the `autoCompact` width verdict: the requested layout's compact
   * counterpart renders while the keyboard is too narrow for it, the requested layout
   * itself once the room returns, or once the verdict is withdrawn (`null`). Called
   * from `AutoCompactController` on a frame of its own, never from the observation
   * callback. An unchanged verdict is dropped; a verdict that replaces a known one is
   * a width the user crossed, which is what gets announced.
   */
  applyTier(narrow: boolean | null): void {
    if (narrow === this._narrow) return;
    const crossed = narrow !== null && this._narrow !== null;
    this._narrow = narrow;
    this._commit("tier", this._source, crossed);
    this._report("width");
  }

  /**
   * Re-derives the layout after an input the element owns changed under it: the
   * `keyboardType` constraint or the folded layout table, which `reason` names.
   */
  refresh(reason: Reason): void {
    this._commit("refresh");
    this._report(reason);
  }

  /**
   * Called from the render pass, where the slot has settled: reports what an attribute
   * request naming a not-yet-slotted layout changed, now that the fold says what it
   * renders as.
   */
  settle(): void {
    const reason = this._held;
    if (reason === null) return;
    this._held = null;
    this._report(reason);
  }

  /**
   * The effective layout name for the current state: an explicit user switch (via a
   * `{layout:...}` key) takes precedence, then the keyboardType constraint
   * (Numpad/Numeric force their layout), then the current layout or, before the first
   * one is seated, the base fallback chain. The result is run through the registry, so
   * an unregistered name reports the default layout it actually falls back to.
   * Rendering, the accent-variant table and composition-middleware resolution all read
   * this name, so none of them can key off a layout other than the one rendered.
   */
  resolvedName(): string {
    const { requested, resolved } = this._resolve();
    if (resolved !== requested && requested && !this._warnedUnregistered.has(requested)) {
      this._warnedUnregistered.add(requested);
      console.warn(
        `[kiosk-keyboard] Layout "${requested}" is not registered, so "${resolved}" renders instead. Declare it as a <kiosk-keyboard-custom-layout> in the customLayouts slot.`,
      );
    }
    return resolved;
  }

  /** {@link resolvedName} without the unregistered-layout warning, and the name it resolved. */
  private _resolve(
    current = this._host.getCurrentLayout() || this._fallbackBase(),
    source = this._source,
  ): { requested: string; resolved: string } {
    const requested = source === "user" ? current : (constrainedLayoutName(this._host.getKeyboardType()) ?? current);
    return { requested, resolved: resolveLayoutName(requested, this._host.getFold().layouts) };
  }

  /** The intent `layout-change` reports: the locale layout while the attribute is empty. */
  private _intentName(): string {
    return this._intent || this._host.getLocaleLayout();
  }

  /** Makes a layout the intent and reflects it to the `layout` attribute, unless it already is. */
  private _writeIntent(name: string): void {
    if (name === this._intentName()) return;
    this._intent = name;
    this._host.setLayoutAttribute(name);
  }

  /** The layout a `{layout:base}` key and the session reset fall back through. */
  private _fallbackBase(): string {
    return this._base || this._host.getLayoutAttribute() || this._host.getLocaleLayout();
  }

  /**
   * Records a request, commits and reports it. Selecting a layout always resets
   * shift/caps-lock, even a re-selection of the active layout. An attribute naming a
   * layout the fold does not hold yet holds its report for {@link settle}, so a layout
   * appended in the same task is not first reported as the fallback it never paints.
   */
  private _request(name: string, cause: "request" | "attribute", source: LayoutSource, reason: Reason): void {
    this._requested = name;
    if (getLayoutMeta(name, this._host.getFold().layoutMeta)?.secondary !== true) {
      this._base = name;
    }
    if (!this._commit(cause, source)) this._host.resetShiftState();
    if (cause === "attribute" && name && !getRegisteredLayout(name, this._host.getFold().layouts)) {
      this._held ??= reason;
    }
    this._report(reason);
  }

  /**
   * The layout the inputs resolve to: the requested layout's registered
   * compact counterpart while the keyboard is narrow, the requested layout otherwise.
   * An unregistered counterpart resolves to the requested layout rather than to the
   * default one, since a consumer who names a missing one should keep the layout they
   * asked for. A `keyboardType` constraint suspends the tier: it pins the rendered
   * surface, so a counterpart would name a layout that is not on screen.
   */
  private _target(constrained: boolean): string {
    const requested = this._requested;
    if (this._narrow !== true || constrained || !this._host.isAutoCompactEnabled()) return requested;
    const fold = this._host.getFold();
    const compact = getLayoutMeta(requested, fold.layoutMeta)?.compact;
    return compact !== undefined && getRegisteredLayout(compact, fold.layouts) ? compact : requested;
  }

  /**
   * Derives the layout to render and, when the effective layout differs from the one
   * on screen - whatever moved it: a request, the width tier, a constraint, or a
   * layout slotted or removed - switches to it: cancels any held key press, ends any
   * in-progress composition, resets the typing context and re-seats focus on the key
   * it followed. The `source` only changes with the tiered layout so a no-op can't
   * silently flip the constraint-override. Under a `keyboardType` constraint only a
   * request moves the tiered layout; the rest waits for the constraint to lift.
   * Returns whether the effective layout changed.
   *
   * A width the user crossed is announced, by direction rather than by the layout's
   * name - an identifier the user never chose, which would enter a translated sentence
   * untranslated. Two texts, not one: a live region speaks on change, and consecutive
   * announcements always alternate direction.
   */
  private _commit(cause: CommitCause, source = this._source, crossed = false): boolean {
    const constrained = constrainedLayoutName(this._host.getKeyboardType()) !== null;
    const current = this._host.getCurrentLayout();
    const target = constrained && (cause === "tier" || cause === "refresh") ? current : this._target(constrained);
    const nextSource = target === current ? this._source : source;
    const effective = this._resolve(target || this._fallbackBase(), nextSource).resolved;
    if (effective === this._rendered) {
      if (target !== current) this._host.setCurrentLayout(target);
      this._source = nextSource;
      return false;
    }

    const anchor = this._host.focusAnchor();
    this._host.setCurrentLayout(target);
    this._source = nextSource;
    this._rendered = effective;
    this._host.cancelPress();
    this._host.endComposition();
    this._host.resetShiftState();
    this._host.reseatFocusAnchor(anchor);

    if (crossed) {
      this._host.announce(
        this._narrow
          ? getText("ARIA_LAYOUT_COMPACTED", "Switched to the compact keyboard layout")
          : getText("ARIA_LAYOUT_UNCOMPACTED", "Switched back to the standard keyboard layout"),
      );
    }
    return true;
  }

  /**
   * Fires `layout-change` when the intent or the effective layout differs from the pair
   * last reported: one event for a change of either or both, none for a no-op. Silent
   * while a report is held for {@link settle}.
   */
  private _report(reason: Reason): void {
    if (this._held !== null) return;
    const layout = this._intentName();
    const effectiveLayout = this._resolve().resolved;
    if (layout === this._reportedLayout && effectiveLayout === this._reportedEffective) return;
    this._reportedLayout = layout;
    this._reportedEffective = effectiveLayout;
    this._host.fireLayoutChange({ layout, effectiveLayout, reason });
  }
}
