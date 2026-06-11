import { createHotkeyManager, destroyHotkeyManager, fireKey } from "./test-helpers";

let clock: { tick: (ms: number) => number; restore: () => void };

QUnit.module("SequenceManager - Black-Box Contracts", {
  beforeEach() {
    destroyHotkeyManager();
    clock = sinon.useFakeTimers();
  },
  afterEach() {
    clock.restore();
    destroyHotkeyManager();
  },
});

// Mismatch recovery: a stray key mid-sequence resets progress so the later
// completion attempt does not fire. Adds the clock-tick + recovery-key path on
// top of the bare-mismatch case in SequenceManager.qunit.ts.
QUnit.test("Wrong key mid-sequence resets progress", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.register("G E", () => {
    called = true;
  });

  fireKey("g");
  clock.tick(50);
  fireKey("x"); // mismatch
  clock.tick(50);
  fireKey("e");

  assert.notOk(called, "Sequence did not complete after mismatch");
});

// Cross-component contract: in-progress sequence keys must not leak a no_match
// emission to the unhandled handler.
QUnit.test("Sequence keys do not emit no_match to unhandled handler", (assert) => {
  const manager = createHotkeyManager();
  let sequenceFired = false;
  let noMatchCount = 0;

  manager.register("G E", () => {
    sequenceFired = true;
  });

  manager.setUnhandledHandler((ctx) => {
    if (ctx.reason === "no_match") {
      noMatchCount++;
    }
  });

  fireKey("g");
  clock.tick(50);
  fireKey("e");

  assert.ok(sequenceFired, "Sequence completed");
  assert.strictEqual(noMatchCount, 0, "No no_match emissions during sequence");
});
