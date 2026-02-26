import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { fireKey } from "./test-helpers";

declare const sinon: {
  useFakeTimers: () => {
    tick: (ms: number) => number;
    restore: () => void;
  };
};

const fixture = document.getElementById("qunit-fixture")!;

// ──────────────────────────────────────────────
// Conflict behavior edge cases
// ──────────────────────────────────────────────

QUnit.module("Negative / Edge-Case — Conflict behavior", {
  beforeEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Not initialized yet
    }
  },
  afterEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Already destroyed
    }
  },
});

QUnit.test("ConflictBehavior.Error: target-bound vs document-bound in same scope does not conflict", (assert) => {
  const manager = HotkeyManager.getInstance();
  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  // Register on document (target: null)
  manager.register("F3", () => {}, { conflictBehavior: "error" });

  // Register on specific target — different target, same scope: should NOT throw
  manager.register("F3", () => {}, { target: div, conflictBehavior: "error" });

  assert.strictEqual(manager.getRegistrations().length, 2, "Both registrations co-exist");
});

QUnit.test("ConflictBehavior.Error: same hotkey on different scopes does not conflict", (assert) => {
  const manager = HotkeyManager.getInstance();

  manager.register("Escape", () => {}, { scope: "editor", conflictBehavior: "error" });
  manager.register("Escape", () => {}, { scope: "dialog", conflictBehavior: "error" });

  assert.strictEqual(manager.getRegistrations().length, 2, "Both registrations co-exist in different scopes");
});

QUnit.test("ConflictBehavior.Error: document-bound in same scope DOES conflict", (assert) => {
  const manager = HotkeyManager.getInstance();

  manager.register("F4", () => {}, { conflictBehavior: "error" });

  assert.throws(
    () => manager.register("F4", () => {}, { conflictBehavior: "error" }),
    /already registered/,
    "Second document-bound registration in same scope throws",
  );
});

QUnit.test("ConflictBehavior.Error: same target in same scope DOES conflict", (assert) => {
  const manager = HotkeyManager.getInstance();
  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  manager.register("F5", () => {}, { target: div, conflictBehavior: "error" });

  assert.throws(
    () => manager.register("F5", () => {}, { target: div, conflictBehavior: "error" }),
    /already registered/,
    "Same hotkey on same target in same scope throws",
  );
});

QUnit.test("ConflictBehavior.Error: failed registration does not pollute state", (assert) => {
  const manager = HotkeyManager.getInstance();
  let firstCalled = false;

  manager.register(
    "F6",
    () => {
      firstCalled = true;
    },
    { conflictBehavior: "error" },
  );

  assert.throws(() => manager.register("F6", () => {}, { conflictBehavior: "error" }), /already registered/);

  // Only the first registration should exist
  assert.strictEqual(manager.getRegistrations().length, 1, "Failed registration not stored");

  fireKey("F6");
  assert.ok(firstCalled, "Original registration still fires after failed conflict");
});

// ──────────────────────────────────────────────
// enabled function returning false mid-sequence
// ──────────────────────────────────────────────

let clock: ReturnType<typeof sinon.useFakeTimers>;

QUnit.module("Negative / Edge-Case — enabled() mid-sequence", {
  beforeEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Not initialized yet
    }
    clock = sinon.useFakeTimers();
  },
  afterEach() {
    clock.restore();
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Already destroyed
    }
  },
});

QUnit.test("enabled function returning false mid-sequence drops pending match", (assert) => {
  const manager = HotkeyManager.getInstance();
  let sequenceFired = false;
  let isEnabled = true;

  manager.registerSequence(
    ["G", "E"],
    () => {
      sequenceFired = true;
    },
    {
      enabled: () => isEnabled,
    },
  );

  // Start the sequence
  fireKey("g");

  // Disable mid-sequence via function
  isEnabled = false;

  // Try to complete
  clock.tick(50);
  fireKey("e");
  assert.notOk(sequenceFired, "Sequence does not complete when enabled() returns false mid-sequence");
});

QUnit.test("enabled function returning false mid-sequence then re-enabled allows fresh start", (assert) => {
  const manager = HotkeyManager.getInstance();
  let sequenceFired = false;
  let isEnabled = true;

  manager.registerSequence(
    ["G", "E"],
    () => {
      sequenceFired = true;
    },
    {
      enabled: () => isEnabled,
    },
  );

  // Start sequence, disable mid-way, fail to complete
  fireKey("g");
  isEnabled = false;
  clock.tick(50);
  fireKey("e");
  assert.notOk(sequenceFired, "First attempt does not fire");

  // Re-enable and retry the full sequence
  isEnabled = true;
  fireKey("g");
  clock.tick(50);
  fireKey("e");
  assert.ok(sequenceFired, "Fresh sequence completes after re-enabling");
});

QUnit.test("enabled function throwing mid-sequence drops pending match", (assert) => {
  const manager = HotkeyManager.getInstance();
  let sequenceFired = false;
  let shouldThrow = false;

  manager.registerSequence(
    ["G", "E"],
    () => {
      sequenceFired = true;
    },
    {
      enabled: () => {
        if (shouldThrow) throw new Error("Intentional mid-sequence enabled() error");
        return true;
      },
    },
  );

  // Start the sequence successfully
  fireKey("g");

  // Make enabled() throw before second key
  shouldThrow = true;

  clock.tick(50);
  fireKey("e");
  assert.notOk(sequenceFired, "Sequence does not complete when enabled() throws mid-sequence");
});

// ──────────────────────────────────────────────
// Callback throws during invocation
// ──────────────────────────────────────────────

QUnit.module("Negative / Edge-Case — Callback throws", {
  beforeEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Not initialized yet
    }
  },
  afterEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Already destroyed
    }
  },
});

QUnit.test("Throwing callback: same hotkey re-fires on subsequent keypress", (assert) => {
  const manager = HotkeyManager.getInstance();
  let callCount = 0;

  manager.register("F1", () => {
    callCount++;
    throw new Error("Intentional callback error");
  });

  fireKey("F1");
  assert.strictEqual(callCount, 1, "Callback invoked despite throw");

  fireKey("F1");
  assert.strictEqual(callCount, 2, "Same throwing callback fires again on next keypress");
});

QUnit.test("Throwing callback: preventDefault was already applied", (assert) => {
  const manager = HotkeyManager.getInstance();

  manager.register("F2", () => {
    throw new Error("Intentional callback error");
  });

  const event = fireKey("F2");
  assert.ok(event.defaultPrevented, "preventDefault called before callback ran and threw");
});

QUnit.test("Throwing callback: other hotkeys remain functional", (assert) => {
  const manager = HotkeyManager.getInstance();
  let secondFired = false;

  manager.register("F1", () => {
    throw new Error("Intentional callback error");
  });

  manager.register("F2", () => {
    secondFired = true;
  });

  fireKey("F1");
  fireKey("F2");
  assert.ok(secondFired, "Other hotkey fires after a different callback threw");
});

QUnit.test("Throwing callback: multiple rapid throws do not break manager", (assert) => {
  const manager = HotkeyManager.getInstance();
  let normalCallCount = 0;

  manager.register("F1", () => {
    throw new Error("Error A");
  });

  manager.register("F3", () => {
    throw new Error("Error B");
  });

  manager.register("F5", () => {
    normalCallCount++;
  });

  fireKey("F1");
  fireKey("F3");
  fireKey("F1");
  fireKey("F3");
  fireKey("F5");
  assert.strictEqual(normalCallCount, 1, "Normal hotkey fires after multiple throwing callbacks");
});

QUnit.test("Throwing callback: registration and unregistration still work", (assert) => {
  const manager = HotkeyManager.getInstance();

  manager.register("F1", () => {
    throw new Error("Intentional callback error");
  });

  fireKey("F1");

  // Should still be able to register new hotkeys
  let newFired = false;
  const handle = manager.register("F4", () => {
    newFired = true;
  });

  fireKey("F4");
  assert.ok(newFired, "New registration after throw fires correctly");

  handle.unregister();
  newFired = false;

  fireKey("F4");
  assert.notOk(newFired, "Unregistered handle no longer fires");
});

// ──────────────────────────────────────────────
// Misc edge cases
// ──────────────────────────────────────────────

QUnit.module("Negative / Edge-Case — Misc", {
  beforeEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Not initialized yet
    }
  },
  afterEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Already destroyed
    }
  },
});

QUnit.test("Rapid register-unregister-fire cycle does not throw", (assert) => {
  const manager = HotkeyManager.getInstance();
  let callCount = 0;

  for (let i = 0; i < 5; i++) {
    const handle = manager.register("Escape", () => {
      callCount++;
    });
    fireKey("Escape");
    handle.unregister();
  }

  assert.strictEqual(callCount, 5, "Each rapid cycle invokes callback once");
  assert.strictEqual(manager.getRegistrations().length, 0, "No registrations remain after all unregisters");
});

QUnit.test("Unregistering inside own callback does not crash", (assert) => {
  const manager = HotkeyManager.getInstance();
  let handle: { unregister: () => void };
  let called = false;

  handle = manager.register("F7", () => {
    called = true;
    handle.unregister();
  });

  fireKey("F7");
  assert.ok(called, "Callback fired before self-unregister");
  assert.strictEqual(manager.getRegistrations().length, 0, "Registration removed by self-unregister");

  // Subsequent keypress should not cause errors
  fireKey("F7");
});
