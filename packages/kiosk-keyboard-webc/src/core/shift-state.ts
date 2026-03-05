/**
 * Shift / Caps Lock state machine.
 *
 * Three-state cycle: off → shift → caps lock → off.
 * Auto-release returns to off after a single key press (shift only, not caps).
 */
export class ShiftState {
  private _active = false;
  private _capsLock = false;

  get isShifted(): boolean {
    return this._active || this._capsLock;
  }

  get isCapsLock(): boolean {
    return this._capsLock;
  }

  /** Cycles: off → shift → caps lock → off. */
  toggle(): void {
    if (this._capsLock) {
      // caps lock → off
      this._capsLock = false;
      this._active = false;
    } else if (this._active) {
      // shift → caps lock
      this._active = false;
      this._capsLock = true;
    } else {
      // off → shift
      this._active = true;
    }
  }

  /**
   * Auto-releases shift (but not caps lock) after a key press.
   * Returns `true` if shift was released.
   */
  autoRelease(): boolean {
    if (this._active && !this._capsLock) {
      this._active = false;
      return true;
    }
    return false;
  }

  /** Clears both shift and caps lock. */
  reset(): void {
    this._active = false;
    this._capsLock = false;
  }
}
