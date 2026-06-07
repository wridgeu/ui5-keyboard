import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutoRepeater, BACKSPACE_AUTO_REPEAT } from "../../src/core/auto-repeat.js";

const T = BACKSPACE_AUTO_REPEAT;

describe("AutoRepeater", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fire before the initial delay, then repeats", () => {
    const onRepeat = vi.fn(() => true);
    const repeater = new AutoRepeater(onRepeat, T);

    repeater.start();
    vi.advanceTimersByTime(T.initialDelayMs - 1);
    expect(onRepeat).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onRepeat).toHaveBeenCalledTimes(1);

    // After the first repeat, the next fires roughly one (accelerated) interval later.
    vi.advanceTimersByTime(T.startIntervalMs);
    expect(onRepeat.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("accelerates: successive intervals shrink toward the floor", () => {
    const fireTimes: number[] = [];
    const repeater = new AutoRepeater(() => {
      fireTimes.push(Date.now());
      return true;
    }, T);

    repeater.start();
    vi.advanceTimersByTime(T.initialDelayMs + 2000);
    repeater.stop();

    expect(fireTimes.length).toBeGreaterThan(5);
    const gaps = fireTimes.slice(1).map((t, i) => t - fireTimes[i]!);
    // Each gap is <= the previous one (monotonically accelerating).
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]!).toBeLessThanOrEqual(gaps[i - 1]!);
    }
    // The first gap is the start interval; the cadence converges to the floor.
    expect(gaps[0]).toBe(T.startIntervalMs);
    expect(gaps.at(-1)).toBe(T.minIntervalMs);
  });

  it("stops when the callback returns false (nothing left to delete)", () => {
    let remaining = 3;
    const onRepeat = vi.fn(() => {
      remaining -= 1;
      return remaining > 0;
    });
    const repeater = new AutoRepeater(onRepeat, T);

    repeater.start();
    vi.advanceTimersByTime(T.initialDelayMs + 5000);

    // 3 ticks: two return true, the third returns false and halts the loop.
    expect(onRepeat).toHaveBeenCalledTimes(3);
    expect(repeater.active).toBe(false);
  });

  it("stop() cancels a pending repeat", () => {
    const onRepeat = vi.fn(() => true);
    const repeater = new AutoRepeater(onRepeat, T);

    repeater.start();
    expect(repeater.active).toBe(true);
    repeater.stop();
    vi.advanceTimersByTime(T.initialDelayMs + 5000);

    expect(onRepeat).not.toHaveBeenCalled();
    expect(repeater.active).toBe(false);
  });

  it("start() restarts the delay from scratch (resets acceleration)", () => {
    const fireTimes: number[] = [];
    const repeater = new AutoRepeater(() => {
      fireTimes.push(Date.now());
      return true;
    }, T);

    repeater.start();
    vi.advanceTimersByTime(T.initialDelayMs + T.startIntervalMs * 3);
    const countAfterFirstHold = fireTimes.length;
    fireTimes.length = 0;

    // A fresh start waits the full initial delay again before the next repeat.
    repeater.start();
    vi.advanceTimersByTime(T.initialDelayMs - 1);
    expect(fireTimes).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(fireTimes).toHaveLength(1);

    repeater.stop();
    expect(countAfterFirstHold).toBeGreaterThan(0);
  });
});
