export interface AutoRepeatTiming {
  /** Delay before the first repeat fires while the key stays held (ms). */
  readonly initialDelayMs: number;
  /** Cadence of the first repeat after the initial delay (ms). */
  readonly startIntervalMs: number;
  /** Fastest cadence the acceleration converges to (ms). */
  readonly minIntervalMs: number;
  /** Per-tick multiplier applied to the interval (< 1 accelerates). */
  readonly accelerationFactor: number;
}

/** Backspace auto-repeat curve. */
export const BACKSPACE_AUTO_REPEAT: AutoRepeatTiming = {
  initialDelayMs: 450,
  startIntervalMs: 140,
  minIntervalMs: 35,
  accelerationFactor: 0.85,
};

/**
 * Press-and-hold auto-repeat scheduler.
 *
 * After an initial hold delay, invokes a callback repeatedly with an
 * accelerating cadence - the behavior phone/touch keyboards use to delete
 * continuously while Backspace is held. The callback returns whether the
 * gesture should keep repeating (e.g. `false` once the input is empty), at
 * which point the scheduler stops on its own. A `stop()` or `start()` reached
 * from inside the callback wins over its return value.
 */
export class AutoRepeater {
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _interval: number;
  /** Bumped by every stop(), so a tick can tell its hold was ended while its callback ran. */
  private _generation = 0;

  /**
   * @param _onRepeat Invoked on every repeat tick. Return `false` to stop the
   *   repeat (e.g. nothing left to delete); `true` to keep going.
   * @param _timing The delay/acceleration curve to apply.
   */
  constructor(
    private readonly _onRepeat: () => boolean,
    private readonly _timing: AutoRepeatTiming = BACKSPACE_AUTO_REPEAT,
  ) {
    this._interval = _timing.startIntervalMs;
  }

  /** (Re)start the hold: schedule the first repeat after the initial delay. */
  start(): void {
    this.stop();
    this._interval = this._timing.startIntervalMs;
    const generation = this._generation;
    this._timer = setTimeout(() => this._tick(generation), this._timing.initialDelayMs);
  }

  /** Cancel any pending repeat. Safe to call when inactive. */
  stop(): void {
    this._generation += 1;
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  private _tick(generation: number): void {
    this._timer = null;
    if (!this._onRepeat() || generation !== this._generation) return;
    // Schedule the next tick at the current cadence, then accelerate for the
    // one after - so the first repeat-to-repeat gap is `startIntervalMs`.
    const interval = this._interval;
    this._interval = Math.max(this._timing.minIntervalMs, Math.round(interval * this._timing.accelerationFactor));
    this._timer = setTimeout(() => this._tick(generation), interval);
  }
}
