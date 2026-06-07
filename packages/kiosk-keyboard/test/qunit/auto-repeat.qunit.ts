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

  repeater.start();
  clock.tick(T.initialDelayMs + 2000);
  repeater.stop();

  assert.ok(fireTimes.length > 5, "many repeats over the hold window");

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
  assert.notOk(repeater.active, "no longer active after stopping");
});

QUnit.test("stop() cancels a pending repeat", (assert) => {
  let calls = 0;
  const repeater = new AutoRepeater(() => {
    calls += 1;
    return true;
  }, T);

  repeater.start();
  assert.ok(repeater.active, "active after start");
  repeater.stop();
  clock.tick(T.initialDelayMs + 5000);

  assert.strictEqual(calls, 0, "no repeats fire after stop()");
  assert.notOk(repeater.active, "inactive after stop()");
});
