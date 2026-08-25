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
    this._mode = this._nextMode(now);
    this._lastToggleTime = now;
    if (prev !== this._mode) this._onChange();
  }

  /**
   * Whether shift would be active after the next {@link toggle}, without
   * performing it. A `{shift}` key event that reports the state the toggle
   * produces has to ask the transition table: `Shift -> Off` and
   * `Off -> Shift` both leave {@link isCapsLock} false.
   */
  peekToggle(): boolean {
    return this._nextMode(performance.now()) !== Mode.Off;
  }

  /** The mode a toggle at `now` produces; performing the move is the caller's. */
  private _nextMode(now: number): Mode {
    if (this._mode === Mode.CapsLock) return Mode.Off;
    // Rapid second click -> caps lock from either remaining mode. The Off case
    // covers: Shift held > 400ms -> click turns Off -> a quick click should
    // still reach CapsLock, not bounce back to Shift.
    if (now - this._lastToggleTime < ShiftState.DOUBLE_CLICK_MS) return Mode.CapsLock;
    return this._mode === Mode.Shift ? Mode.Off : Mode.Shift;
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
