/**
 * Shift / Caps Lock state machine.
 *
 * Single click: off -> shift (auto-releases after one key).
 * Double-click (within threshold): activates caps lock.
 * Click while caps-locked: off.
 *
 * Every mutator (toggle, autoRelease, syncFromPhysical, reset) fires the
 * `onChange` callback supplied to the constructor whenever the mode actually
 * transitions. The owner wires it to `invalidate()` so it never has to pair a
 * mutation call with a manual repaint.
 */

const enum Mode {
  Off,
  Shift,
  CapsLock,
}

export class ShiftState {
  private _mode: Mode = Mode.Off;
  private _lastToggleTime = -Infinity;
  private readonly _onChange: () => void;

  /** Milliseconds within which a second click counts as double-click. */
  static readonly DOUBLE_CLICK_MS = 400;

  constructor(onChange: () => void) {
    this._onChange = onChange;
  }

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
    const prev = this._mode;
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
    if (prev !== this._mode) this._onChange();
  }

  /** Auto-releases shift (but not caps lock) after a key press. */
  autoRelease(): void {
    if (this._mode === Mode.Shift) {
      this._mode = Mode.Off;
      // Close the double-click window so the next toggle() starts a
      // fresh cycle instead of incorrectly jumping to CapsLock.
      this._lastToggleTime = -Infinity;
      this._onChange();
    }
  }

  /** Syncs the shift state from a physical keyboard event. */
  syncFromPhysical(shiftHeld: boolean, capsLockOn: boolean): void {
    const prev = this._mode;

    if (capsLockOn) {
      this._mode = Mode.CapsLock;
    } else if (shiftHeld) {
      this._mode = Mode.Shift;
    } else {
      this._mode = Mode.Off;
    }

    if (prev !== this._mode) {
      // Reset the double-click window so the next virtual toggle()
      // starts fresh instead of inheriting stale timing.
      this._lastToggleTime = -Infinity;
      this._onChange();
    }
  }

  /** Clears both shift and caps lock. */
  reset(): void {
    const prev = this._mode;
    this._mode = Mode.Off;
    this._lastToggleTime = -Infinity;
    if (prev !== Mode.Off) this._onChange();
  }
}
