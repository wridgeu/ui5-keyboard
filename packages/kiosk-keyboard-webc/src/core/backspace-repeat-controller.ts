import { AutoRepeater } from "./auto-repeat.js";
import { KIOSK_KEYBOARD_DOM } from "./dom-contract.js";

/** The slice of the host element the controller reads at event time. */
interface BackspaceRepeatHost {
  readonly shadowRoot: ShadowRoot | null;
  readonly disabled: boolean;
}

/**
 * Owns the press-and-hold Backspace auto-repeat for the web component: the
 * pointerdown that arms it, the repeat timer, and whether the current hold has
 * repeated. The actual delete is the host's `onTick` callback, so the
 * cancelable `key-press`, composition middleware, and grapheme-aware deletion
 * all stay on the control. The host ends the hold through `release` (its
 * press's pointerup) or `stop` (any other end).
 */
export class BackspaceRepeatController {
  private readonly _repeater: AutoRepeater;
  /** Whether the current hold has deleted through the repeat. */
  private _repeated = false;
  /** The Backspace key the current repeat is bound to (for leave detection). */
  private _keyEl: HTMLElement | null = null;

  private readonly _onPointerDown = (e: Event): void => {
    if (e instanceof PointerEvent) this._start(e);
  };
  // Sliding the pointer off the key ends the gesture off-key, so its release
  // owes nothing. `pointerleave` (not `pointerout`) does not fire when the
  // pointer moves onto the key's own children (icon span).
  private readonly _onPointerLeave = (): void => this.stop();

  /**
   * @param _host Live access to the shadow root (listener target) and disabled state.
   * @param _onTick Performs one repeat delete; returns whether to keep repeating.
   */
  constructor(
    private readonly _host: BackspaceRepeatHost,
    private readonly _onTick: () => boolean,
  ) {
    this._repeater = new AutoRepeater(() => {
      this._repeated = true;
      return this._onTick();
    });
  }

  /** Wire the pointerdown that starts a hold, on the host's connected-session signal. */
  attach(signal: AbortSignal): void {
    this._host.shadowRoot!.addEventListener("pointerdown", this._onPointerDown, { signal });
  }

  /** Cancel any in-flight repeat and unbind the per-key leave listener. */
  stop(): void {
    this._repeater.stop();
    this._repeated = false;
    if (this._keyEl) {
      this._keyEl.removeEventListener("pointerleave", this._onPointerLeave);
      this._keyEl = null;
    }
  }

  /**
   * Ends the hold on its pointer's release. Returns whether it repeated, in which
   * case the release's own click must not delete one more character.
   */
  release(): boolean {
    const repeated = this._repeated;
    this.stop();
    return repeated;
  }

  private _start(e: PointerEvent): void {
    if (this._host.disabled) return;
    if (e.button > 0) return; // primary press only (0 for touch/pen/left mouse)
    const target = e.target;
    const keyEl = target instanceof Element ? target.closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook) : null;
    if (!keyEl || keyEl.dataset.key !== "{backspace}") return;
    this.stop();
    this._keyEl = keyEl;
    keyEl.addEventListener("pointerleave", this._onPointerLeave);
    this._repeater.start();
  }
}
