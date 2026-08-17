import { AutoRepeater } from "./auto-repeat.js";
import { KIOSK_KEYBOARD_DOM } from "./dom-contract.js";

/** The slice of the host element the controller reads at event time. */
interface BackspaceRepeatHost {
  readonly shadowRoot: ShadowRoot | null;
  readonly disabled: boolean;
}

/**
 * Owns the press-and-hold Backspace auto-repeat for the web component: the
 * pointer-gesture wiring, the repeat timer, and the one-shot "swallow the
 * trailing release click" flag.
 *
 * Encapsulating the whole lifecycle here - arm on pointerdown, tick while held,
 * stop on release / pointer-leave, suppress the single trailing click - keeps
 * it out of the control's fields, lifecycle hooks, and click handler. The host
 * forwards exactly three things: `attach` (connected), `stop` (disconnected),
 * and `consumeClick` (its click handler). The actual delete is the host's
 * `onTick` callback, so the cancelable `key-press`, composition middleware, and
 * grapheme-aware deletion all stay on the control.
 *
 * The timing curve is shared with the sibling `kiosk-keyboard` package by hand
 * (see `auto-repeat.ts`); only the wiring differs between the two.
 */
export class BackspaceRepeatController {
  private readonly _repeater: AutoRepeater;
  /**
   * Set on every repeat tick; swallows the one trailing `click` the gesture
   * produces on release (a real mouse click, or the click `_boundTouchEnd`
   * synthesizes) so lifting off does not delete one extra character. Reset on
   * the next Backspace press and on the consuming click; cleared on
   * pointer-leave (no on-key click follows), so a later keyboard- or
   * programmatically-activated Backspace click is never wrongly swallowed.
   */
  private _suppressNextClick = false;
  /** The Backspace key the current repeat is bound to (for leave detection). */
  private _keyEl: HTMLElement | null = null;

  private readonly _onPointerDown = (e: Event): void => {
    if (e instanceof PointerEvent) this._start(e);
  };
  private readonly _onPointerUp = (): void => this.stop();
  private readonly _onPointerLeave = (): void => {
    // Sliding the pointer off the key ends the gesture off-key, so no trailing
    // on-key click follows: stop and drop the suppression. `pointerleave` (not
    // `pointerout`) does not fire when the pointer moves onto the key's own
    // children (icon span), so no relatedTarget filtering is needed.
    this._suppressNextClick = false;
    this.stop();
  };

  /**
   * @param _host Live access to the shadow root (listener target) and disabled state.
   * @param _onTick Performs one repeat delete; returns whether to keep repeating.
   */
  constructor(
    private readonly _host: BackspaceRepeatHost,
    private readonly _onTick: () => boolean,
  ) {
    this._repeater = new AutoRepeater(() => {
      this._suppressNextClick = true;
      return this._onTick();
    });
  }

  /**
   * Wire the pointer listeners: pointerdown on the shadow root starts a hold; a
   * release anywhere on the document ends it (so a pointerup outside the key
   * still stops the repeat). Call from the host's connected callback with its
   * teardown signal.
   */
  attach(signal: AbortSignal): void {
    this._host.shadowRoot!.addEventListener("pointerdown", this._onPointerDown, { signal });
    document.addEventListener("pointerup", this._onPointerUp, { signal });
    document.addEventListener("pointercancel", this._onPointerUp, { signal });
  }

  /** Cancel any in-flight repeat and unbind the per-key leave listener. */
  stop(): void {
    this._repeater.stop();
    if (this._keyEl) {
      this._keyEl.removeEventListener("pointerleave", this._onPointerLeave);
      this._keyEl = null;
    }
  }

  /**
   * Consume the trailing release click after a repeat. Returns `true` when the
   * click is that suppressed Backspace release and the caller should ignore it.
   */
  consumeClick(value: string): boolean {
    if (value === "{backspace}" && this._suppressNextClick) {
      this._suppressNextClick = false;
      return true;
    }
    return false;
  }

  private _start(e: PointerEvent): void {
    if (this._host.disabled) return;
    if (e.button > 0) return; // primary press only (0 for touch/pen/left mouse)
    const target = e.target;
    const keyEl = target instanceof Element ? target.closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook) : null;
    if (!keyEl || keyEl.dataset.key !== "{backspace}") return;
    this.stop();
    this._suppressNextClick = false;
    this._keyEl = keyEl;
    keyEl.addEventListener("pointerleave", this._onPointerLeave);
    this._repeater.start();
  }
}
