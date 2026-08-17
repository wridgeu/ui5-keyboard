import { AutoRepeater, BACKSPACE_AUTO_REPEAT } from "ui5/kiosk/internal/auto-repeat";

// Exercises the press-and-hold scheduler in isolation: the initial hold delay,
// the accelerating cadence, and the two stop paths (callback returns false /
// explicit stop). Timing is driven by sinon fake timers so the assertions are
// deterministic rather than wall-clock dependent.

const T = BACKSPACE_AUTO_REPEAT;

let clock: sinon.SinonFakeTimers;

QUnit.module("AutoRepeater", {
  beforeEach() {
    clock = sinon.useFakeTimers();
  },
  afterEach() {
    clock.restore();
  },
});

QUnit.test("does not fire before the initial delay, then repeats", (assert) => {
  let calls = 0;
  const repeater = new AutoRepeater(() => {
    calls += 1;
    return true;
  }, T);

  repeater.start();
  clock.tick(T.initialDelayMs - 1);
  assert.strictEqual(calls, 0, "no repeat before the initial delay elapses");

  clock.tick(1);
  assert.strictEqual(calls, 1, "first repeat fires exactly at the initial delay");

  clock.tick(T.startIntervalMs);
  assert.ok(calls >= 2, "a further repeat fires one interval later");

  repeater.stop();
});

QUnit.test("accelerates: successive intervals shrink toward the floor", (assert) => {
  const fireTimes: number[] = [];
  const repeater = new AutoRepeater(() => {
    fireTimes.push(Date.now());
    return true;
  }, T);

  const holdMs = 2000;
  repeater.start();
  clock.tick(T.initialDelayMs + holdMs);
  repeater.stop();

  // Every gap stays within [minIntervalMs, startIntervalMs], so over the hold
  // window the repeat count is bounded on both sides. The tight lower bound
  // catches an acceleration regression (e.g. firing 6 times).
  assert.ok(
    fireTimes.length >= Math.floor(holdMs / T.startIntervalMs),
    `at least ${Math.floor(holdMs / T.startIntervalMs)} repeats over the hold window (got ${fireTimes.length})`,
  );
  assert.ok(
    fireTimes.length <= Math.ceil(holdMs / T.minIntervalMs) + 1,
    "no more repeats than the minimum-interval cadence allows",
  );

  const gaps = fireTimes.slice(1).map((time, i) => time - fireTimes[i]!);
  let monotonic = true;
  for (let i = 1; i < gaps.length; i++) {
    if (gaps[i]! > gaps[i - 1]!) monotonic = false;
  }
  assert.ok(monotonic, "each repeat-to-repeat gap is <= the previous one");
  assert.strictEqual(gaps[0], T.startIntervalMs, "first gap equals the start interval");
  assert.strictEqual(gaps.at(-1), T.minIntervalMs, "cadence converges to the minimum interval");
});

QUnit.test("stops when the callback returns false", (assert) => {
  let remaining = 3;
  let calls = 0;
  const repeater = new AutoRepeater(() => {
    calls += 1;
    remaining -= 1;
    return remaining > 0;
  }, T);

  repeater.start();
  clock.tick(T.initialDelayMs + 5000);

  assert.strictEqual(calls, 3, "halts on the tick that returns false");

  clock.tick(5000);
  assert.strictEqual(calls, 3, "no further ticks fire once the loop has stopped");
});

QUnit.test("stop() cancels a pending repeat", (assert) => {
  let calls = 0;
  const repeater = new AutoRepeater(() => {
    calls += 1;
    return true;
  }, T);

  repeater.start();
  repeater.stop();
  clock.tick(T.initialDelayMs + 5000);

  // start() scheduled the first repeat (proven by the initial-delay test);
  // stop() cancels it, so even past the delay nothing fires.
  assert.strictEqual(calls, 0, "no repeats fire after stop()");
});
