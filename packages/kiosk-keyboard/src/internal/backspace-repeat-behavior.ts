import { AutoRepeater } from "./auto-repeat";

/**
 * The press-and-hold Backspace auto-repeat of one pointer press: the repeat
 * timer plus the "a repeat already happened" flag the release path reads to
 * avoid deleting one extra character on lift-off. The press that armed it owns
 * it, so ending the press is what stops it.
 *
 * The delete itself is the caller's `onTick`, so composition middleware and
 * grapheme-aware deletion stay on the control.
 *
 * The timing curve is shared with the sibling `kiosk-keyboard-webc` package by
 * hand (see `auto-repeat.ts`); only the wiring differs between the two.
 */
export default class BackspaceRepeatBehavior {
  private readonly _repeater: AutoRepeater;
  /** Whether this hold has auto-repeated at least one delete; survives `stop()` for the release. */
  private _didRepeat = false;

  /**
   * Arms the repeat.
   *
   * @param onTick Performs one repeat delete and returns whether the gesture
   *   should keep going (`false` once there is nothing left to delete).
   */
  constructor(onTick: () => boolean) {
    this._repeater = new AutoRepeater(() => {
      this._didRepeat = true;
      return onTick();
    });
    this._repeater.start();
  }

  /** Cancel any in-flight repeat. Safe to call when idle. */
  stop(): void {
    this._repeater.stop();
  }

  /** Whether the release should skip its single delete because a repeat already deleted. */
  get didRepeat(): boolean {
    return this._didRepeat;
  }
}
