import { detectKeyboardType } from "./keyboard-type-detector.js";
import type { KeyboardType } from "../types.js";

/** Why the active target was set; drives focusout cleanup policy. */
type TargetSource = "autoShow" | "explicit";

/** Who last set keyboardType; `auto:VALUE` = auto-detected for VALUE. */
type KeyboardTypeSource = "unset" | "explicit" | `auto:${string}`;

/**
 * The slice of the host the auto-show controller reads and acts on.
 *
 * Live state is read through accessor methods (never snapshotted) because the
 * focus handlers run long after the controller is constructed; actions delegate
 * back to the host so the cancelable events, composition reset, inputmode
 * suppression, and physical-key highlight all stay on the control.
 */
export interface AutoShowControllerHost {
  // ── Live state (methods so the host can satisfy them with arrows) ──
  isDisabled(): boolean;
  isDocked(): boolean;
  isAutoShow(): boolean;
  isAutoType(): boolean;
  isConnected(): boolean;
  /** Public `open` getter; a closed docked keyboard does not block peers. */
  isVisiblyOpen(): boolean;
  getKeyboardType(): `${KeyboardType}`;
  getShadowRoot(): ShadowRoot | null;
  /** Light-DOM containment check (`host.contains`). */
  contains(node: Node | null): boolean;
  getClientRects(): DOMRectList;
  getTargetElement(): HTMLInputElement | HTMLTextAreaElement | null;
  getTargetSource(): TargetSource;
  getControlsList(): string[];
  getKeyboardTypeSource(): KeyboardTypeSource;
  resolveInputFrom(el: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null;

  // ── Actions ──
  setKeyboardTypeInternal(value: `${KeyboardType}`): void;
  setTarget(el: HTMLInputElement | HTMLTextAreaElement | null, source: TargetSource): void;
  /** Resets shift and commits/drops the middleware for a fresh target context. */
  resetTargetContext(): void;
  show(): void;
  close(): void;
  isOpen(): boolean;
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

  constructor(private readonly _host: AutoShowControllerHost) {}

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
    if (this._host.isAutoShow() && this._host.isDocked()) {
      if (this._abort) return;
      this._abort = new AbortController();
      const { signal } = this._abort;
      document.addEventListener("focusin", this._onFocusIn, { capture: true, signal });
      document.addEventListener("focusout", this._onFocusOut, { capture: true, signal });
    } else {
      this.teardown();
    }
  }

  teardown(): void {
    this._abort?.abort();
    this._abort = null;
  }

  private _onDocumentFocusIn(e: FocusEvent): void {
    if (this._host.isDisabled() || !this._host.isDocked() || !this._host.isAutoShow()) return;

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (this._host.getShadowRoot()!.contains(target) || this._host.contains(target)) return;

    const inputEl = this._host.resolveInputFrom(target);
    if (!inputEl) return;
    if (this._isTargetOfOther(inputEl)) return;

    const ids = this._host.getControlsList();
    if (ids.length > 0) {
      if (!this._matchesControls(target, ids)) return;
    }

    const targetChanged = this._host.getTargetElement() !== inputEl;
    if (targetChanged) {
      // Real switch: fresh context, so reset shift and end any composition.
      this._host.resetTargetContext();
    }
    this._host.setTarget(inputEl, "autoShow");

    // Detect keyboard type before open - this may trigger onInvalidation for
    // keyboardType, but the target is already set so subsequent logic is safe.
    if (this._host.isAutoType() && this._host.getKeyboardTypeSource() !== "explicit") {
      const detected = detectKeyboardType(inputEl);
      if (detected !== this._host.getKeyboardType()) {
        this._host.setKeyboardTypeInternal(detected);
      }
    }

    if (this._deferredCloseId !== null) {
      cancelAnimationFrame(this._deferredCloseId);
      this._deferredCloseId = null;
    }

    if (!this._host.isOpen()) {
      this._host.show();
      this._host.syncPhysicalKeyHighlight();
    } else if (targetChanged) {
      this._host.restoreInputMode();
      this._host.suppressInputMode();
      this._host.syncPhysicalKeyHighlight();
    }

    if (targetChanged) {
      this._host.fireActiveControlChange(inputEl);
    }
  }

  private _onDocumentFocusOut(_e: FocusEvent): void {
    if (!this._host.isAutoShow()) return;

    if (this._deferredCloseId !== null) {
      cancelAnimationFrame(this._deferredCloseId);
    }

    this._deferredCloseId = requestAnimationFrame(() => {
      this._deferredCloseId = null;
      if (!this._host.isConnected()) return;
      const active = document.activeElement;

      if (active && (this._host.getShadowRoot()!.contains(active) || this._host.contains(active))) return;
      if (active instanceof HTMLElement && this._host.resolveInputFrom(active)) {
        const ids = this._host.getControlsList();
        if (ids.length === 0 || this._matchesControls(active, ids)) return;
      }

      if (this._host.isOpen()) this._host.close();
      if (this._host.getTargetSource() === "autoShow") {
        this._host.setTarget(null, "explicit");
      }
    });
  }

  private _isTargetOfOther(inputEl: HTMLElement): boolean {
    for (const peer of AutoShowController._participants) {
      if (peer === this) continue;
      if (!peer._isAutoShowParticipationActive()) continue;
      if (peer._host.getTargetElement() === inputEl) return true;
      const ids = peer._host.getControlsList();
      if (ids.length === 1) {
        const el = document.getElementById(ids[0]!);
        if (!el) continue;
        if (el === inputEl) return true;
        if (el instanceof HTMLElement && peer._host.resolveInputFrom(el) === inputEl) return true;
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
    if (this._host.isDisabled()) return false;
    if (!this._host.isConnected()) return false;
    // A docked keyboard that is closed hides via an inner shadow-DOM class
    // (visibility:hidden + transform), but the host element still reports
    // client rects. Exclude it explicitly so it does not block other keyboards.
    if (this._host.isDocked() && !this._host.isVisiblyOpen()) return false;
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
