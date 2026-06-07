import { AutoRepeater } from "./auto-repeat";

/**
 * Owns the press-and-hold Backspace auto-repeat for the UI5 control: the repeat
 * timer plus the "a repeat already happened" flag the release path reads to
 * avoid deleting one extra character on lift-off.
 *
 * Keeping the gesture's whole lifecycle here - arm on press, tick while held,
 * suppress the trailing release - mirrors the other behavior delegates in this
 * folder (auto-show, native-keyboard suppression, key-grid navigation) instead
 * of scattering fields and branches across the control. The actual delete is
 * the caller's `onTick`, so composition middleware and grapheme-aware deletion
 * stay on the control.
 *
 * The timing curve is shared with the sibling `kiosk-keyboard-webc` package by
 * hand (see `auto-repeat.ts`); only the wiring differs between the two.
 */
export default class BackspaceRepeatBehavior {
  private readonly _repeater: AutoRepeater;
  /**
   * Whether the current hold has auto-repeated at least one delete. Set on the
   * first tick, reset on the next Backspace press; survives `stop()` so the
   * release that immediately follows can still read it.
   */
  private _didRepeat = false;

  /**
   * @param _onTick Performs one repeat delete and returns whether the gesture
   *   should keep going (`false` once there is nothing left to delete).
   */
  constructor(private readonly _onTick: () => boolean) {
    this._repeater = new AutoRepeater(() => {
      this._didRepeat = true;
      return this._onTick();
    });
  }

  /**
   * Arm the repeat when an enabled keyboard's Backspace key is pressed. A no-op
   * for any other key or while disabled, so callers can forward every press.
   */
  onPress(keyEl: HTMLElement, enabled: boolean): void {
    if (!enabled || keyEl.dataset.key !== "{backspace}") return;
    this._didRepeat = false;
    this._repeater.start();
  }

  /** Cancel any in-flight repeat. Safe to call when idle. */
  stop(): void {
    this._repeater.stop();
  }

  /**
   * Whether the release for `keyValue` should skip its single delete because a
   * repeat already deleted while the key was held.
   */
  shouldSuppressRelease(keyValue: string | undefined): boolean {
    return keyValue === "{backspace}" && this._didRepeat;
  }
}
