/**
 * Shift / Caps Lock state machine.
 *
 * Single click: off → shift (auto-releases after one key).
 * Double-click (within threshold): activates caps lock.
 * Click while caps-locked: off.
 */
export class ShiftState {
  private _active = false;
  private _capsLock = false;
  private _lastToggleTime = 0;

  /** Milliseconds within which a second click counts as double-click. */
  static readonly DOUBLE_CLICK_MS = 400;

  get isShifted(): boolean {
    return this._active || this._capsLock;
  }

  get isCapsLock(): boolean {
    return this._capsLock;
  }

  /**
   * Handles a shift key press.
   *
   * - If caps lock is on → turn everything off.
   * - If shift is on and pressed again within the double-click window → caps lock.
   * - Otherwise → activate one-shot shift.
   */
  toggle(): void {
    const now = Date.now();

    if (this._capsLock) {
      // Caps lock → off
      this._capsLock = false;
      this._active = false;
    } else if (this._active && now - this._lastToggleTime < ShiftState.DOUBLE_CLICK_MS) {
      // Double-click → caps lock
      this._active = false;
      this._capsLock = true;
    } else {
      // Off (or stale shift) → one-shot shift
      this._active = true;
    }

    this._lastToggleTime = now;
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
    this._lastToggleTime = 0;
  }
}
