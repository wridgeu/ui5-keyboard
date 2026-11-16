import Log from "sap/base/Log";
import type { CustomLayoutFold } from "./custom-layout-fold";
import { getLayoutMeta } from "./layout-meta";
import { constrainedLayoutName } from "./layout-constraint";
import {
  getRegisteredLayout as registryGetLayout,
  resolveLayoutName as registryResolveLayoutName,
} from "./layout-registry";
import { getText } from "./i18n-registry";
import { LayoutChangeReason, type KeyboardType } from "../library";

/**
 * Whether the active layout was last set by a user-driven `{layout:X}` key tap
 * (`"user"`) or by a programmatic / auto-detected change (`"external"`).
 *
 * User-driven switches override the `keyboardType` constraint so a `{layout:special}`
 * tap in Numeric/Numpad mode shows the special layout. `{layout:base}`, `setLayout`,
 * `resetLayout`, `setKeyboardType`, `resetKeyboardType`, and auto-type detection all
 * reset this back to `"external"`.
 */
type LayoutSource = "external" | "user";

/**
 * What re-derived the layout: a request, a width verdict, or an input the state reads
 * but does not own (the `keyboardType`, the folded layout table).
 */
type CommitCause = "request" | "tier" | "refresh";

/** The slice of the control the layout state reads and writes back into. */
interface LayoutStateHost {
  /** The `layout` property: the layout asked for, not the one on screen. */
  getLayout(): string;
  /** Writes the `layout` property directly, bypassing the public setter this drives. */
  setLayoutProperty(name: string): void;
  /** Re-renders after the layout on screen moved under an unchanged `layout` property. */
  invalidate(): void;
  getKeyboardType(): KeyboardType;
  getFold(): CustomLayoutFold;
  fireLayoutChange(parameters: { layout: string; effectiveLayout: string; reason: LayoutChangeReason }): void;
  /** Selecting a layout always resets the typing context. */
  resetShiftState(): void;
  /**
   * Abandons a key press still held: the keycap under it now shows another key, so
   * its release must not type that one.
   */
  cancelPress(): void;
  endComposition(): void;
  /** The key focus sits on, captured before a switch re-renders the grid. */
  focusAnchorValue(): string | null;
  reseatFocusAnchor(value: string | null): void;
}

/**
 * Owns which layout is active and who asked for it. It stores only inputs - the
 * layout last requested, the base (alphabetic) layout `{layout:base}` returns to, the
 * source that drove the current one, and the `autoCompact` width verdict - and
 * derives the layout to render from them in {@link _commit}. It also holds the tier
 * announcement waiting on a render.
 *
 * Two layouts are public. The `layout` property is the *intent*: what the app set, or
 * a primary layout the user picked with a `{layout:*}` key - never a secondary pick,
 * a width swap, a constraint or a registry fallback. {@link resolvedName} is the
 * *effective* layout, the one on screen, with all of those applied. `layoutChange`
 * fires once per change of either, from {@link _report}.
 *
 * Three entry points: {@link perform} is a *request* - `setLayout` and the
 * `{layout:*}` key - validated against the registry and kept as the layout to swap
 * back to; {@link applyTier} records the width verdict; {@link refresh} re-derives
 * after an input the control owns changed.
 */
export default class LayoutState {
  private readonly _host: LayoutStateHost;
  /** The base (alphabetic) layout `{layout:base}`, `resetLayout()` and `reset()` return to. */
  private _base = "";
  /** The layout last asked for, which the width tier resolves its counterpart against. */
  private _requested = "";
  /** The requested layout after the width tier: what renders unless a constraint pins it. */
  private _current = "";
  /** The effective layout the switch effects last ran for: the one on screen. */
  private _rendered = "";
  private _source: LayoutSource = "external";
  /** Whether the `autoCompact` width tier last reported the keyboard too narrow. */
  private _narrow = false;
  /** Live-region text for a width-driven swap, held until the render it triggers is done. */
  private _pendingAnnouncement: string | null = null;
  /** The intent and the effective layout `layoutChange` last reported, or the control started on. */
  private _reportedLayout = "";
  private _reportedEffective = "";
  /** Whether the constructor settings are still being applied, which report nothing. */
  private _seeding = false;

  constructor(host: LayoutStateHost) {
    this._host = host;
  }

  /**
   * Seeds every layout from the locale default, before any request, and silences
   * `layoutChange` until {@link settle}.
   */
  seed(name: string): void {
    this._base = name;
    this._requested = name;
    this._current = name;
    this._rendered = this.resolvedName();
    this._seeding = true;
  }

  /**
   * Ends the window {@link seed} opened: the layouts the constructor settings produced
   * are the ones the control starts on, which `layoutChange` does not report.
   */
  settle(): void {
    if (!this._seeding) return;
    this._seeding = false;
    this._reportedLayout = this._host.getLayout();
    this._reportedEffective = this.resolvedName();
  }

  getBaseLayout(): string {
    return this._base;
  }

  getSource(): LayoutSource {
    return this._source;
  }

  /**
   * Drops a user-driven `{layout:X}` pick: the source returns to `"external"` and the
   * layout to the base layout, so the resolved layout follows the constraint context
   * again and a lifted constraint lands on the base rather than on the pick. A
   * programmatic or `{layout:base}` layout is left alone. Called on a real target
   * switch and on every `keyboardType` change, which `reason` names.
   */
  clearUserOverride(reason: LayoutChangeReason): void {
    if (this._source !== "user") return;
    // Explicit, not left to `_commit`: a pick of a primary layout is already the base,
    // so the request below is a no-op that would leave the source at "user".
    this._source = "external";
    this.perform(this._base, "external", "held as the base layout", reason);
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
   * (warn and bail when unregistered) -> record -> commit. Selecting a layout always
   * resets the typing context (shift/caps-lock), even a re-selection of the active
   * layout. The request becomes the `layout` property when the app made it or when it
   * names a primary layout; a secondary pick changes only what renders. Returns
   * whether the layout on screen changed.
   *
   * @param rawName Requested layout name; normalized here.
   * @param source  Who drove the switch.
   * @param origin  Requester description used in the unregistered warning.
   * @param reason  What `layoutChange` names as the cause.
   */
  perform(rawName: string, source: LayoutSource, origin: string, reason: LayoutChangeReason): boolean {
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
    const secondary = getLayoutMeta(name, this._host.getFold().layoutMeta)?.secondary === true;
    if (!secondary) this._base = name;
    if (!secondary || reason === LayoutChangeReason.Api) this._host.setLayoutProperty(name);
    // A request supersedes any tier announcement still waiting on a render, which
    // would otherwise name the layout this switch just replaced.
    this._pendingAnnouncement = null;
    const changed = this._commit("request", source);
    if (!changed) this._host.resetShiftState();
    this._report(reason);
    return changed;
  }

  /**
   * Records the `autoCompact` width verdict: the requested layout's compact
   * counterpart renders while the keyboard is too narrow for it, the requested layout
   * itself once the room returns. Called from `AutoCompactBehavior` on a frame of its
   * own, never from the observation callback. `crossed` is whether the verdict
   * replaces a known previous one, which is what gets announced.
   */
  applyTier(narrow: boolean, crossed: boolean): void {
    this._narrow = narrow;
    this._commit("tier", this._source, crossed);
    this._report(LayoutChangeReason.Width);
  }

  /**
   * Re-derives the layout after an input the control owns changed under it: the
   * `keyboardType` constraint or the folded layout table, which `reason` names.
   */
  refresh(reason: LayoutChangeReason): void {
    this._commit("refresh");
    this._report(reason);
  }

  /**
   * The effective layout NAME for the current state, shared by the renderer, the
   * accent-variant table and the composition-middleware lookup so none of them
   * resolve to a different layout than the one rendered. A user-driven `{layout:X}`
   * switch wins (it overrides the keyboardType constraint), then the keyboardType
   * constraint (Numpad/Numeric force their layout), then the requested layout after
   * the width tier. The result is run through the registry, so an unregistered name
   * reports the default layout it actually falls back to.
   */
  resolvedName(): string {
    return this._resolve(this._current, this._source);
  }

  /** {@link resolvedName} for a given tiered layout and source. */
  private _resolve(current: string, source: LayoutSource): string {
    const requested = source === "user" ? current : (constrainedLayoutName(this._host.getKeyboardType()) ?? current);
    return registryResolveLayoutName(requested, this._host.getFold().layouts);
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
    if (!this._narrow || constrained) return requested;
    const fold = this._host.getFold();
    const compact = getLayoutMeta(requested, fold.layoutMeta)?.compact;
    return compact !== undefined && registryGetLayout(compact, fold.layouts) ? compact : requested;
  }

  /**
   * Derives the layout to render and, when the effective layout differs from the one
   * on screen - whatever moved it: a request, the width tier, a constraint, or a
   * layout declared or removed - switches to it: cancels any held key press, ends any
   * in-progress composition, resets the typing context, re-renders and re-seats focus
   * on the key it followed. The `source` only changes with the tiered layout so a
   * no-op can't silently flip the constraint-override. Under a `keyboardType`
   * constraint only a request moves the tiered layout; the rest waits for the
   * constraint to lift. Returns whether the effective layout changed.
   *
   * A width the user crossed is announced, by direction rather than by the layout's
   * name - an identifier the user never chose, which would enter a translated sentence
   * untranslated. Two texts, not one: a live region speaks on change, and consecutive
   * announcements always alternate direction.
   */
  private _commit(cause: CommitCause, source = this._source, crossed = false): boolean {
    const constrained = constrainedLayoutName(this._host.getKeyboardType()) !== null;
    const target = constrained && cause !== "request" ? this._current : this._target(constrained);
    const nextSource = target === this._current ? this._source : source;
    const effective = this._resolve(target, nextSource);
    if (effective === this._rendered) {
      this._current = target;
      this._source = nextSource;
      return false;
    }

    const anchorValue = this._host.focusAnchorValue();
    this._host.cancelPress();
    this._host.endComposition();
    this._host.resetShiftState();
    this._current = target;
    this._source = nextSource;
    this._rendered = effective;
    this._host.invalidate();
    this._host.reseatFocusAnchor(anchorValue);

    if (crossed) {
      this._pendingAnnouncement = this._narrow
        ? getText("ARIA_LAYOUT_COMPACTED", "Switched to the compact keyboard layout")
        : getText("ARIA_LAYOUT_UNCOMPACTED", "Switched back to the standard keyboard layout");
    }
    return true;
  }

  /**
   * Fires `layoutChange` when the intent or the effective layout differs from the pair
   * last reported: one event for a change of either or both, none for a no-op.
   */
  private _report(reason: LayoutChangeReason): void {
    if (this._seeding) return;
    const layout = this._host.getLayout();
    const effectiveLayout = this.resolvedName();
    if (layout === this._reportedLayout && effectiveLayout === this._reportedEffective) return;
    this._reportedLayout = layout;
    this._reportedEffective = effectiveLayout;
    this._host.fireLayoutChange({ layout, effectiveLayout, reason });
  }
}
