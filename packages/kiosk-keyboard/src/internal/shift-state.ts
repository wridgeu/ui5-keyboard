/**
 * Shift / Caps Lock state machine.
 *
 * Single click: off -> shift (auto-releases after one key).
 * Double-click (within threshold): activates caps lock.
 * Click while caps-locked: off.
 */

const enum Mode {
  Off,
  Shift,
  CapsLock,
}

export class ShiftState {
  private _mode: Mode = Mode.Off;
  private _lastToggleTime = 0;

  /** Milliseconds within which a second click counts as double-click. */
  static readonly DOUBLE_CLICK_MS = 400;

  get isShifted(): boolean {
    return this._mode !== Mode.Off;
  }

  get isCapsLock(): boolean {
    return this._mode === Mode.CapsLock;
  }

  /**
   * Handles a shift key press.
   *
   * - If caps lock is on -> turn everything off.
   * - If shift is on and pressed again within the double-click window -> caps lock.
   * - If shift is on but outside the double-click window -> off.
   * - Otherwise -> activate one-shot shift.
   */
  toggle(): void {
    const now = performance.now();
    const isDouble = this._mode === Mode.Shift && now - this._lastToggleTime < ShiftState.DOUBLE_CLICK_MS;

    if (this._mode === Mode.CapsLock) {
      this._mode = Mode.Off;
    } else if (isDouble) {
      this._mode = Mode.CapsLock;
    } else if (this._mode === Mode.Shift) {
      this._mode = Mode.Off;
    } else {
      this._mode = Mode.Shift;
    }

    this._lastToggleTime = now;
  }

  /**
   * Auto-releases shift (but not caps lock) after a key press.
   * Returns `true` if shift was released.
   */
  autoRelease(): boolean {
    if (this._mode === Mode.Shift) {
      this._mode = Mode.Off;
      return true;
    }
    return false;
  }

  /** Clears both shift and caps lock. */
  reset(): void {
    this._mode = Mode.Off;
    this._lastToggleTime = 0;
  }
}
