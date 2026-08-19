import { detectKeyboardType } from "./keyboard-type-detector.js";
import type { KeyboardType } from "../types.js";

/** Why the active target was set; drives focusout cleanup policy. */
type TargetSource = "autoShow" | "explicit";

/** Who last set keyboardType; `auto:VALUE` = auto-detected for VALUE. */
type KeyboardTypeSource = "unset" | "explicit" | `auto:${string}`;

/**
 * The host keyboard element. Live element/property state (visibility, the
 * docked/autoShow/autoType flags, keyboard type, shadow root, containment) is
 * read directly off it, with no accessor wrappers - matching the sibling
 * `ResponsiveSizingController` host pattern.
 */
export type AutoShowHost = HTMLElement & {
  readonly disabled: boolean;
  readonly docked: boolean;
  readonly autoShow: boolean;
  readonly autoType: boolean;
  /** Public `open` getter; a closed docked keyboard does not block peers. */
  readonly open: boolean;
  readonly keyboardType: `${KeyboardType}`;
};

/**
 * Bridge to the host's private state and behaviors that have no 1:1 element
 * equivalent: reading the active target / controls / keyboard-type provenance,
 * and the actions that delegate back to the control so the cancelable events,
 * composition reset, inputmode suppression, and physical-key highlight all stay
 * on it.
 */
export interface AutoShowBridge {
  getTargetElement(): HTMLInputElement | HTMLTextAreaElement | null;
  getTargetSource(): TargetSource;
  getControlsList(): string[];
  getKeyboardTypeSource(): KeyboardTypeSource;
  resolveInputFrom(el: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null;
  setKeyboardTypeInternal(value: `${KeyboardType}`): void;
  setTarget(el: HTMLInputElement | HTMLTextAreaElement | null, source: TargetSource): void;
  /** Resets shift and commits/drops the middleware for a fresh target context. */
  resetTargetContext(): void;
  show(): void;
  close(): void;
  restoreInputMode(): void;
  suppressInputMode(): void;
  syncPhysicalKeyHighlight(): void;
  fireActiveControlChange(el: HTMLInputElement | HTMLTextAreaElement | null): void;
}

/**
 * Owns auto-show: while `docked` and `autoShow` are on, document-level
 * focusin/focusout listeners open the keyboard for a focused input it claims
 * and close it (deferred one frame) when focus leaves to a non-claimed target.
 *
 * Multi-keyboard isolation lives here too: a live registry of controllers lets
 * one instance avoid claiming an input another keyboard already targets. The
 * host registers/unregisters its controller in step with its own connected
 * lifecycle. Uses the kiosk `auto-show-behavior.ts` as the responsibility
 * reference; the webc DOM specifics (resolving live elements, the `controls`
 * id matching) differ.
 */
export class AutoShowController {
  /** All live keyboards' controllers, for cross-instance claim checks. */
  private static readonly _participants = new Set<AutoShowController>();

  private _abort: AbortController | null = null;
  private _deferredCloseId: number | null = null;

  private readonly _onFocusIn = this._onDocumentFocusIn.bind(this);
  private readonly _onFocusOut = this._onDocumentFocusOut.bind(this);

  constructor(
    private readonly _host: AutoShowHost,
    private readonly _bridge: AutoShowBridge,
  ) {}

  /** Join the cross-instance claim registry (call from the host's connect). */
  register(): void {
    AutoShowController._participants.add(this);
  }

  /** Leave the claim registry and cancel any pending deferred close. */
  unregister(): void {
    AutoShowController._participants.delete(this);
    if (this._deferredCloseId !== null) {
      cancelAnimationFrame(this._deferredCloseId);
      this._deferredCloseId = null;
    }
  }

  /** Bind or unbind the document focus listeners to match docked + autoShow. */
  sync(): void {
    if (this._host.autoShow && this._host.docked) {
      if (this._abort) return;
      this._abort = new AbortController();
      const { signal } = this._abort;
      document.addEventListener("focusin", this._onFocusIn, { capture: true, signal });
      document.addEventListener("focusout", this._onFocusOut, { capture: true, signal });
    } else {
      this.teardown();
    }
  }

  /** Unbind the focus listeners and drop any pending deferred close. */
  teardown(): void {
    this._abort?.abort();
    this._abort = null;
    if (this._deferredCloseId !== null) {
      cancelAnimationFrame(this._deferredCloseId);
      this._deferredCloseId = null;
    }
  }

  private _onDocumentFocusIn(e: FocusEvent): void {
    if (this._host.disabled || !this._host.docked || !this._host.autoShow) return;

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (this._host.shadowRoot?.contains(target) || this._host.contains(target)) return;

    const inputEl = this._bridge.resolveInputFrom(target);
    if (!inputEl) return;
    if (this._isTargetOfOther(inputEl)) return;

    const ids = this._bridge.getControlsList();
    if (ids.length > 0) {
      if (!this._matchesControls(target, ids)) return;
    }

    const targetChanged = this._bridge.getTargetElement() !== inputEl;
    if (targetChanged) {
      // Real switch: fresh context, so reset shift and end any composition.
      this._bridge.resetTargetContext();
    }
    this._bridge.setTarget(inputEl, "autoShow");

    // Detect keyboard type before open - this may trigger onInvalidation for
    // keyboardType, but the target is already set so subsequent logic is safe.
    if (this._host.autoType && this._bridge.getKeyboardTypeSource() !== "explicit") {
      const detected = detectKeyboardType(inputEl);
      if (detected !== this._host.keyboardType) {
        this._bridge.setKeyboardTypeInternal(detected);
      }
    }

    if (this._deferredCloseId !== null) {
      cancelAnimationFrame(this._deferredCloseId);
      this._deferredCloseId = null;
    }

    if (!this._host.open) {
      this._bridge.show();
      this._bridge.syncPhysicalKeyHighlight();
    } else if (targetChanged) {
      this._bridge.restoreInputMode();
      this._bridge.suppressInputMode();
      this._bridge.syncPhysicalKeyHighlight();
    }

    if (targetChanged) {
      this._bridge.fireActiveControlChange(inputEl);
    }
  }

  private _onDocumentFocusOut(_e: FocusEvent): void {
    if (!this._host.autoShow) return;

    if (this._deferredCloseId !== null) {
      cancelAnimationFrame(this._deferredCloseId);
    }

    this._deferredCloseId = requestAnimationFrame(() => {
      this._deferredCloseId = null;
      if (!this._host.isConnected) return;
      const active = document.activeElement;

      if (active && (this._host.shadowRoot?.contains(active) || this._host.contains(active))) return;
      if (active instanceof HTMLElement && this._bridge.resolveInputFrom(active)) {
        const ids = this._bridge.getControlsList();
        if (ids.length === 0 || this._matchesControls(active, ids)) return;
      }

      if (this._host.open) this._bridge.close();
      if (this._bridge.getTargetSource() === "autoShow") {
        this._bridge.setTarget(null, "explicit");
      }
    });
  }

  private _isTargetOfOther(inputEl: HTMLElement): boolean {
    for (const peer of AutoShowController._participants) {
      if (peer === this) continue;
      if (!peer._isAutoShowParticipationActive()) continue;
      if (peer._bridge.getTargetElement() === inputEl) return true;
      // `controls` is a comma-separated list, and every id on it is a claim: the
      // peer's active target is only set once one of them takes focus, so before
      // that the list is the only statement of ownership there is.
      for (const id of peer._bridge.getControlsList()) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el === inputEl || peer._bridge.resolveInputFrom(el) === inputEl) return true;
      }
    }
    return false;
  }

  /**
   * Returns true when this instance should participate in auto-show claim checks.
   * Hidden, disabled, or disconnected keyboards must not block other keyboards
   * from claiming inputs.
   */
  private _isAutoShowParticipationActive(): boolean {
    if (this._host.disabled) return false;
    if (!this._host.isConnected) return false;
    // A docked keyboard that is closed hides via an inner shadow-DOM class
    // (visibility:hidden + transform), but the host element still reports
    // client rects. Exclude it explicitly so it does not block other keyboards.
    if (this._host.docked && !this._host.open) return false;
    return this._host.getClientRects().length > 0;
  }

  /**
   * Checks whether the focused element (or a close ancestor) matches one
   * of the configured controls.
   *
   * Supports:
   * - Exact DOM id match (plain HTML)
   * - UI5-style prefixed IDs: walks up the DOM and strips the view prefix
   *   (`*--`) from each ancestor's id, matching the unprefixed control id
   *   (e.g. `"container-app---view--myInput"` matches `"myInput"`)
   */
  private _matchesControls(el: HTMLElement, ids: string[]): boolean {
    let current: HTMLElement | null = el;
    // Walk up at most 5 levels: input → inner wrapper → control root (+ margin for deeper UI5 nesting)
    for (let i = 0; i < 5 && current; i++) {
      const domId = current.id;
      if (domId) {
        if (ids.includes(domId)) return true;
        // Strip UI5 view prefix: everything up to and including the last "--"
        const sepIdx = domId.lastIndexOf("--");
        if (sepIdx !== -1 && ids.includes(domId.slice(sepIdx + 2))) return true;
      }
      current = current.parentElement;
    }
    return false;
  }
}
