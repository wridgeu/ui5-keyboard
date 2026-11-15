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

/**
 * What re-derived the layout: a request, a width verdict, or an input the state reads
 * but does not own (the `keyboardType`, the folded layout table).
 */
type CommitCause = "request" | "tier" | "refresh";

/** The slice of the control the layout state reads and writes back into. */
interface LayoutStateHost {
  /** The `layout` property: the layout on screen, not the last one asked for. */
  getLayout(): string;
  /** Writes the `layout` property directly, bypassing the public setter this drives. */
  setLayoutProperty(name: string): void;
  getKeyboardType(): KeyboardType;
  getFold(): CustomLayoutFold;
  fireLayoutChange(parameters: { layout: string; requestedLayout: string; autoDetected: boolean }): void;
  /** Selecting a layout always resets the typing context. */
  resetShiftState(): void;
  endComposition(): void;
  /** The key focus sits on, captured before a switch re-renders the grid. */
  focusAnchorValue(): string | null;
  reseatFocusAnchor(value: string | null): void;
  warnTierWriteBack(): void;
}

/**
 * Owns which layout is active and who asked for it. It stores only inputs - the
 * layout last requested, the base (alphabetic) layout `{layout:base}` returns to, the
 * source that drove the current one, and the `autoCompact` width verdict - and
 * derives the layout to render from them in {@link _commit}, the one place the
 * `layout` property changes. It also holds the tier announcement waiting on a render.
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
  private _source: LayoutSource = "external";
  /** Whether the `autoCompact` width tier last reported the keyboard too narrow. */
  private _narrow = false;
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
    // Explicit, not left to `_commit`: a pick of a primary layout is already the base,
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
   * (warn and bail when unregistered) -> record -> commit. Selecting a layout always
   * resets the typing context (shift/caps-lock), even a re-selection of the active
   * layout. Returns whether the layout changed.
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
    if (getLayoutMeta(name, this._host.getFold().layoutMeta)?.secondary !== true) {
      this._base = name;
    }
    // A request supersedes any tier announcement still waiting on a render, which
    // would otherwise name the layout this switch just replaced.
    this._pendingAnnouncement = null;
    const changed = this._commit("request", source);
    if (!changed) this._host.resetShiftState();
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
  }

  /**
   * Re-derives the layout after an input the control owns changed under it: the
   * `keyboardType` constraint or the folded layout table.
   */
  refresh(): void {
    this._commit("refresh");
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
   * Derives the layout to render and, when it differs from the `layout` property,
   * switches to it: ends any in-progress composition, resets the typing context,
   * writes the property, re-seats focus on the key it followed and fires
   * `layoutChange`. The `source` only changes on a real switch so a no-op can't
   * silently flip the constraint-override. Under a `keyboardType` constraint only a
   * request moves the layout; the rest waits for the constraint to lift. Returns
   * whether the layout changed.
   *
   * `autoDetected` is whether the change was not exactly a request: a width verdict or
   * a changed input, or a request the tier rendered as its compact counterpart - the
   * changes a two-way binding of `layout` is warned about. A width the user crossed is
   * announced, by direction rather than by the layout's name - an identifier the user
   * never chose, which would enter a translated sentence untranslated. Two texts, not
   * one: a live region speaks on change, and consecutive announcements always
   * alternate direction.
   */
  private _commit(cause: CommitCause, source = this._source, crossed = false): boolean {
    const constrained = constrainedLayoutName(this._host.getKeyboardType()) !== null;
    if (constrained && cause !== "request") return false;
    const target = this._target(constrained);
    if (target === this._host.getLayout()) return false;

    const anchorValue = this._host.focusAnchorValue();
    this._source = source;
    this._host.endComposition();
    this._host.resetShiftState();
    this._host.setLayoutProperty(target);
    this._host.reseatFocusAnchor(anchorValue);

    const autoDetected = cause !== "request" || target !== this._requested;
    if (crossed) {
      this._pendingAnnouncement = this._narrow
        ? getText("ARIA_LAYOUT_COMPACTED", "Switched to the compact keyboard layout")
        : getText("ARIA_LAYOUT_UNCOMPACTED", "Switched back to the standard keyboard layout");
    }
    if (autoDetected) this._host.warnTierWriteBack();
    this._host.fireLayoutChange({ layout: target, requestedLayout: this._requested, autoDetected });
    return true;
  }
}
