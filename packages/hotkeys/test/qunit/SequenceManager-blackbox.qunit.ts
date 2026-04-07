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

// ──────────────────────────────────────────────
// 1. Basic sequence completion
// ──────────────────────────────────────────────

QUnit.test("Completing G E in order fires callback once", (assert) => {
  const manager = createHotkeyManager();
  let count = 0;

  manager.registerSequence(["G", "E"], () => {
    count++;
  });

  fireKey("g");
  clock.tick(50);
  fireKey("e");

  assert.strictEqual(count, 1, "Callback fired exactly once");
});

// ──────────────────────────────────────────────
// 2. Mismatch reset
// ──────────────────────────────────────────────

QUnit.test("Wrong key mid-sequence resets progress", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(["G", "E"], () => {
    called = true;
  });

  fireKey("g");
  clock.tick(50);
  fireKey("x"); // mismatch
  clock.tick(50);
  fireKey("e");

  assert.notOk(called, "Sequence did not complete after mismatch");
});

// ──────────────────────────────────────────────
// 3. Timeout reset
// ──────────────────────────────────────────────

QUnit.test("Exceeding timeout resets sequence", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(
    ["G", "E"],
    () => {
      called = true;
    },
    { timeout: 100 },
  );

  fireKey("g");
  clock.tick(200);
  fireKey("e");

  assert.notOk(called, "Sequence did not complete after timeout");
});

// ──────────────────────────────────────────────
// 4. Scoped sequence precedence
// ──────────────────────────────────────────────

QUnit.test("Active scope sequence wins over global", (assert) => {
  const manager = createHotkeyManager();
  let globalFired = false;
  let scopedFired = false;

  manager.registerSequence(["G", "E"], () => {
    globalFired = true;
  });

  manager.registerSequence(
    ["G", "E"],
    () => {
      scopedFired = true;
    },
    { scope: "editor" },
  );

  manager.pushScope("editor");
  fireKey("g");
  clock.tick(50);
  fireKey("e");

  assert.ok(scopedFired, "Scoped sequence fired");
  assert.notOk(globalFired, "Global sequence suppressed by active scope");
});

// ──────────────────────────────────────────────
// 5. Unhandled callback interaction
// ──────────────────────────────────────────────

QUnit.test("Sequence keys do not emit no_match to unhandled handler", (assert) => {
  const manager = createHotkeyManager();
  let sequenceFired = false;
  let noMatchCount = 0;

  manager.registerSequence(["G", "E"], () => {
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

// ──────────────────────────────────────────────
// 6. Runtime enable/disable
// ──────────────────────────────────────────────

QUnit.test("Disabling via setOptions prevents fire; re-enabling restores it", (assert) => {
  const manager = createHotkeyManager();
  let count = 0;

  const handle = manager.registerSequence(["G", "E"], () => {
    count++;
  });

  // Disable
  handle.setOptions({ enabled: false });
  fireKey("g");
  clock.tick(50);
  fireKey("e");
  assert.strictEqual(count, 0, "Sequence did not fire while disabled");

  // Re-enable
  handle.setOptions({ enabled: true });
  fireKey("g");
  clock.tick(50);
  fireKey("e");
  assert.strictEqual(count, 1, "Sequence fires after re-enabling");
});
