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
  private _lastToggleTime = -Infinity;

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
   * - Two rapid clicks within the double-click window -> caps lock,
   *   regardless of whether the current mode is Shift or Off (the Off
   *   case covers: Shift held > 400ms -> click turns Off -> quick click
   *   should still reach CapsLock, not bounce back to Shift).
   * - If shift is on but outside the double-click window -> off.
   * - Otherwise -> activate one-shot shift.
   */
  toggle(): void {
    const now = performance.now();
    const withinWindow = now - this._lastToggleTime < ShiftState.DOUBLE_CLICK_MS;

    if (this._mode === Mode.CapsLock) {
      this._mode = Mode.Off;
    } else if (this._mode === Mode.Shift && withinWindow) {
      this._mode = Mode.CapsLock;
    } else if (this._mode === Mode.Off && withinWindow) {
      // Rapid Off -> CapsLock: the previous click turned Shift off
      // (or CapsLock off), and this click arrived within the window.
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
      // Close the double-click window so the next toggle() starts a
      // fresh cycle instead of incorrectly jumping to CapsLock.
      this._lastToggleTime = -Infinity;
      return true;
    }
    return false;
  }

  /**
   * Syncs the shift state from a physical keyboard event.
   * Returns true if the state changed.
   */
  syncFromPhysical(shiftHeld: boolean, capsLockOn: boolean): boolean {
    const prev = this._mode;

    if (capsLockOn) {
      this._mode = Mode.CapsLock;
    } else if (shiftHeld) {
      this._mode = Mode.Shift;
    } else {
      this._mode = Mode.Off;
    }

    if (prev !== this._mode) {
      this._lastToggleTime = -Infinity;
    }

    return prev !== this._mode;
  }

  /** Clears both shift and caps lock. */
  reset(): void {
    this._mode = Mode.Off;
    this._lastToggleTime = -Infinity;
  }
}
