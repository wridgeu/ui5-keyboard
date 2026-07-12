import { AutoRepeater, type AutoRepeatTiming } from "./auto-repeat.js";
import { KIOSK_KEYBOARD_DOM } from "./dom-contract.js";

/** Press-and-hold threshold that opens the accent-variant popup (ms). */
export const VARIANT_HOLD_MS = 450;

// A single-shot hold timer: the AutoRepeater fires once after the initial delay
// and its callback returns `false`, so no repeat cadence follows. The other
// fields never come into play (they only drive repeat ticks), but a full timing
// object is required by the shared curve type.
const VARIANT_HOLD_TIMING: AutoRepeatTiming = {
  initialDelayMs: VARIANT_HOLD_MS,
  startIntervalMs: VARIANT_HOLD_MS,
  minIntervalMs: VARIANT_HOLD_MS,
  accelerationFactor: 1,
};

/** The slice of the host element the controller reads/drives at event time. */
export interface VariantPopupControllerHost {
  getShadowRoot(): ShadowRoot | null;
  isDisabled(): boolean;
  /** Open the popup anchored to `keyEl`; returns whether it opened. */
  openVariantPopup(keyEl: HTMLElement): boolean;
  /** Commit the option under these viewport coords if one is there; returns whether it committed. */
  commitVariantAt(clientX: number, clientY: number): boolean;
  /** Signal that a touch drag-release just committed, so the host swallows the trailing synthesized touchend. */
  notifyTouchCommit(): void;
}

/**
 * Owns the press-and-hold / right-click gesture that opens the accent-variant
 * popup for the web component: the pointer wiring, the single-shot hold timer,
 * the touch drag-release commit, and the one-shot "swallow the trailing release
 * click" flag so lifting off after a hold does not also insert the base glyph.
 *
 * Mirrors the sibling `BackspaceRepeatController` (pointerdown arms, pointerup /
 * pointercancel / pointerleave cancel), but gates on the key carrying
 * `data-has-variants` instead of `{backspace}` and opens the popup instead of
 * repeating. The popup DOM, keyboard navigation, positioning, and dismissal are
 * owned by the host; this controller only detects the gesture and forwards the
 * open/commit intents.
 *
 * The hold threshold is shared with the sibling `kiosk-keyboard` package by hand
 * (see the CLAUDE.md no-shared-core convention); only the wiring differs.
 */
export class VariantPopupController {
  private readonly _hold: AutoRepeater;
  /**
   * Set once the hold (or right-click) opened a popup; swallows the single
   * trailing `click` the opening gesture produces on release so lifting off
   * does not also insert the base character. Gated by `_originValue` and reset
   * on the next press, on the consuming click, and when the host closes the
   * popup, so a later activation of another key is never wrongly swallowed.
   */
  private _suppressNextClick = false;
  /** `data-key` value of the key the current suppression is bound to. */
  private _originValue: string | null = null;
  /** The variant key the current hold is armed on (for leave detection). */
  private _keyEl: HTMLElement | null = null;
  /** Pointer id of the active hold, so an unrelated release does not end it. */
  private _pointerId: number | null = null;
  /** Whether the current gesture has already opened the popup. */
  private _opened = false;

  private readonly _onPointerDown = (e: Event): void => {
    if (e instanceof PointerEvent) this._start(e);
  };
  private readonly _onPointerUp = (e: Event): void => {
    if (e instanceof PointerEvent) this._end(e);
  };
  private readonly _onPointerLeave = (): void => {
    // Sliding off the key before the hold fires cancels it; after the popup is
    // open the leave listener is already removed so a drag onto the popup keeps
    // the gesture alive for touch drag-release.
    this._cancelHold();
  };
  private readonly _onContextMenu = (e: Event): void => this._openFromContextMenu(e);

  constructor(private readonly _host: VariantPopupControllerHost) {
    this._hold = new AutoRepeater(() => {
      this._openFromHold();
      return false; // single-shot: open once, never repeat
    }, VARIANT_HOLD_TIMING);
  }

  /**
   * Wire the gesture listeners: pointerdown / contextmenu on the shadow root, a
   * release anywhere on the document (so a pointerup off the key still ends the
   * gesture). Call from the host's connected callback with its teardown signal.
   */
  attach(signal: AbortSignal): void {
    const root = this._host.getShadowRoot()!;
    root.addEventListener("pointerdown", this._onPointerDown, { signal });
    root.addEventListener("contextmenu", this._onContextMenu, { signal });
    document.addEventListener("pointerup", this._onPointerUp, { signal });
    document.addEventListener("pointercancel", this._onPointerUp, { signal });
  }

  /** Cancel any in-flight hold and unbind the per-key leave listener. */
  stop(): void {
    this._cancelHold();
    this._opened = false;
  }

  /**
   * Consume the trailing release click after the gesture opened a popup.
   * Returns `true` when `value` is the origin key of the suppressed release and
   * the caller should ignore the click.
   */
  consumeClick(value: string): boolean {
    if (this._suppressNextClick && value === this._originValue) {
      this._suppressNextClick = false;
      return true;
    }
    return false;
  }

  /** Clear the click suppression once the host has closed the popup. */
  notifyClosed(): void {
    this._suppressNextClick = false;
    this._originValue = null;
  }

  private _variantKey(target: EventTarget | null): HTMLElement | null {
    const keyEl = (target as HTMLElement | null)?.closest?.<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook) ?? null;
    if (!keyEl || !keyEl.hasAttribute(KIOSK_KEYBOARD_DOM.attributes.hasVariants)) return null;
    return keyEl;
  }

  private _start(e: PointerEvent): void {
    if (this._host.isDisabled()) return;
    if (e.button > 0) return; // primary press only (0 for touch/pen/left mouse)
    const keyEl = this._variantKey(e.target);
    if (!keyEl) return;
    this._cancelHold();
    this._suppressNextClick = false;
    this._keyEl = keyEl;
    this._pointerId = e.pointerId;
    keyEl.addEventListener("pointerleave", this._onPointerLeave);
    this._hold.start();
  }

  private _openFromHold(): void {
    const keyEl = this._keyEl;
    if (!keyEl) return;
    keyEl.removeEventListener("pointerleave", this._onPointerLeave);
    if (this._host.openVariantPopup(keyEl)) {
      this._opened = true;
      this._suppressNextClick = true;
      this._originValue = keyEl.dataset.key ?? null;
    }
  }

  private _openFromContextMenu(e: Event): void {
    if (this._host.isDisabled()) return;
    const keyEl = this._variantKey(e.target);
    if (!keyEl) return;
    e.preventDefault();
    this._cancelHold();
    this._host.openVariantPopup(keyEl);
  }

  private _end(e: PointerEvent): void {
    if (this._pointerId !== null && e.pointerId !== this._pointerId) return;
    if (this._opened) {
      // Touch drag-release: releasing over an option commits it. Releasing
      // elsewhere leaves the popup open (sticky) and keeps the suppression so
      // the trailing origin-key click does not insert the base glyph.
      if (this._host.commitVariantAt(e.clientX, e.clientY)) {
        this._suppressNextClick = false;
        // A touch commit is trailed by a synthesized touchend on the host; a
        // mouse/pen release is not, so only touch needs the swallow signal.
        if (e.pointerType === "touch") this._host.notifyTouchCommit();
      }
    }
    this.stop();
  }

  private _cancelHold(): void {
    this._hold.stop();
    if (this._keyEl) this._keyEl.removeEventListener("pointerleave", this._onPointerLeave);
    this._keyEl = null;
    this._pointerId = null;
  }
}
