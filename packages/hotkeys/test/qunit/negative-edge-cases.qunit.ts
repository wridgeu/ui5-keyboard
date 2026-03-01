import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { UnhandledReason } from "ui5/hotkeys/library";
import { fireKey, fireKeyOn } from "./test-helpers";

const fixture = document.getElementById("qunit-fixture")!;

/**
 * Shared module hooks that ensure a clean HotkeyManager singleton
 * before and after every test. The try-catch guards handle the case
 * where the manager is not yet initialized or already destroyed.
 */
function freshManagerHooks() {
  return {
    beforeEach() {
      try {
        HotkeyManager.getInstance().destroy();
      } catch {
        /* not initialized yet */
      }
    },
    afterEach() {
      try {
        HotkeyManager.getInstance().destroy();
      } catch {
        /* already destroyed */
      }
    },
  };
}

// ──────────────────────────────────────────────
// Conflict behavior edge cases
// ──────────────────────────────────────────────

QUnit.module("Negative / Edge-Case — Conflict behavior", freshManagerHooks());

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
      /* not initialized yet */
    }
    clock = sinon.useFakeTimers();
  },
  afterEach() {
    clock.restore();
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      /* already destroyed */
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

QUnit.module("Negative / Edge-Case — Callback throws", freshManagerHooks());

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

QUnit.module("Negative / Edge-Case — Misc", freshManagerHooks());

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

// ══════════════════════════════════════════════
// Suspend guard abuse
// ══════════════════════════════════════════════

QUnit.module("Negative / Edge-Case — Suspend guard abuse", freshManagerHooks());

QUnit.test("Stale guard from destroyed manager does not affect new manager", (assert) => {
  const manager = HotkeyManager.getInstance();
  const guard = manager.suspendDispatch("stale-test");
  manager.destroy();

  // Guard is invalidated
  assert.notOk(guard.isActive, "Stale guard is inactive after destroy");

  // New manager instance
  const newManager = HotkeyManager.getInstance();
  let fired = false;
  newManager.register("F5", () => {
    fired = true;
  });

  // Stale guard release should be a no-op — must NOT affect new manager
  guard.release();
  assert.notOk(newManager.isDispatchSuspended(), "New manager is NOT suspended by stale guard release");

  fireKey("F5");
  assert.ok(fired, "Hotkey fires on new manager — stale guard had no effect");
});

QUnit.test("Guard release during unhandled callback does not affect current event", (assert) => {
  const manager = HotkeyManager.getInstance();
  const guard = manager.suspendDispatch("will-release-in-callback");
  const reasons: string[] = [];

  manager.setUnhandledHandler((ctx) => {
    reasons.push(ctx.reason);
    // Release the guard inside the unhandled callback
    guard.release();
  });

  // First event — guard is active, so Suspended reason is emitted
  fireKey("F5");
  assert.strictEqual(reasons[0], UnhandledReason.Suspended, "First event: Suspended");
  assert.notOk(manager.isDispatchSuspended(), "Guard released inside callback");

  // Second event — guard was released, so now it's NoMatch (no registrations)
  fireKey("F5");
  assert.strictEqual(reasons[1], UnhandledReason.NoMatch, "Second event: NoMatch (guard released)");
});

QUnit.test("isDispatchSuspended returns false after destroy", (assert) => {
  const manager = HotkeyManager.getInstance();
  manager.suspendDispatch("test");
  assert.ok(manager.isDispatchSuspended(), "Suspended before destroy");

  manager.destroy();
  // isDispatchSuspended delegates to dispatcher which returns false when destroyed
  assert.notOk(manager.isDispatchSuspended(), "Not suspended after destroy");
});

// ══════════════════════════════════════════════
// Destroyed manager method calls
// ══════════════════════════════════════════════

QUnit.module("Negative / Edge-Case — Destroyed manager method calls", freshManagerHooks());

QUnit.test("register() on destroyed manager throws", (assert) => {
  const manager = HotkeyManager.getInstance();
  manager.destroy();

  assert.throws(() => manager.register("F5", () => {}), /destroyed/i, "register() throws on destroyed manager");
});

QUnit.test("createRecorder() on destroyed manager throws", (assert) => {
  const manager = HotkeyManager.getInstance();
  manager.destroy();

  assert.throws(
    () => manager.createRecorder({ onRecord: () => {} }),
    /destroyed/i,
    "createRecorder() throws on destroyed manager",
  );
});

QUnit.test("registerSequence() on destroyed manager throws", (assert) => {
  const manager = HotkeyManager.getInstance();
  manager.destroy();

  assert.throws(
    () => manager.registerSequence(["G", "I"], () => {}),
    /destroyed/i,
    "registerSequence() throws on destroyed manager",
  );
});

QUnit.test("createGroup() on destroyed manager throws", (assert) => {
  const manager = HotkeyManager.getInstance();
  manager.destroy();

  assert.throws(() => manager.createGroup(), /destroyed/i, "createGroup() throws on destroyed manager");
});

QUnit.test("setUnhandledHandler() on destroyed manager throws", (assert) => {
  const manager = HotkeyManager.getInstance();
  manager.destroy();

  assert.throws(
    () => manager.setUnhandledHandler(() => {}),
    /destroyed/i,
    "setUnhandledHandler() throws on destroyed manager",
  );
});

QUnit.test("addGenericRootId() on destroyed manager throws", (assert) => {
  const manager = HotkeyManager.getInstance();
  manager.destroy();

  assert.throws(
    () => manager.addGenericRootId("custom-root"),
    /destroyed/i,
    "addGenericRootId() throws on destroyed manager",
  );
});

QUnit.test("removeGenericRootId() on destroyed manager throws", (assert) => {
  const manager = HotkeyManager.getInstance();
  manager.destroy();

  assert.throws(
    () => manager.removeGenericRootId("custom-root"),
    /destroyed/i,
    "removeGenericRootId() throws on destroyed manager",
  );
});

// ══════════════════════════════════════════════
// Recorder abuse
// ══════════════════════════════════════════════

QUnit.module("Negative / Edge-Case — Recorder abuse", freshManagerHooks());

QUnit.test("Double-destroy recorder is idempotent", (assert) => {
  const manager = HotkeyManager.getInstance();
  const recorder = manager.createRecorder({ onRecord: () => {} });

  recorder.destroy();
  assert.ok(recorder.isDestroyed, "Destroyed after first call");

  recorder.destroy(); // Second destroy — must not throw
  assert.ok(recorder.isDestroyed, "Still destroyed after double call");
});

QUnit.test("cancel() on destroyed recorder does not throw", (assert) => {
  const manager = HotkeyManager.getInstance();
  const recorder = manager.createRecorder({
    onRecord: () => {},
    onCancel: () => {},
  });

  recorder.start();
  recorder.destroy();

  // cancel() after destroy — stop() is a no-op (already not recording)
  recorder.cancel();
  assert.ok(true, "cancel() on destroyed recorder does not throw");
});

QUnit.test("Rapid start/stop cycling does not leak interceptor state", (assert) => {
  const manager = HotkeyManager.getInstance();
  let recordCount = 0;
  const recorder = manager.createRecorder({
    onRecord: () => {
      recordCount++;
    },
  });

  // Rapid cycling
  for (let i = 0; i < 10; i++) {
    recorder.start();
    recorder.stop();
  }

  // Final start — should work cleanly
  recorder.start();
  fireKey("F5");
  assert.strictEqual(recordCount, 1, "Recorder works after rapid start/stop cycles");
  assert.notOk(recorder.isRecording, "Auto-stopped after recording");

  // Manager should still be functional after recorder
  let managerFired = false;
  manager.register("F6", () => {
    managerFired = true;
  });
  fireKey("F6");
  assert.ok(managerFired, "Manager dispatches normally after rapid recorder cycling");

  recorder.destroy();
});

QUnit.test("onRecord callback throws — manager remains functional", (assert) => {
  const manager = HotkeyManager.getInstance();
  const recorder = manager.createRecorder({
    onRecord: () => {
      throw new Error("Intentional onRecord error");
    },
  });

  recorder.start();
  // Error is caught by the pipeline (try-catch in interceptor step).
  // Recorder stops before callback runs (stop-before-callback pattern).
  fireKey("F5");

  assert.notOk(recorder.isRecording, "Recorder stopped despite callback throw");

  // Manager should still dispatch normally
  let managerFired = false;
  manager.register("F6", () => {
    managerFired = true;
  });
  fireKey("F6");
  assert.ok(managerFired, "Manager dispatches normally after recorder callback throw");

  recorder.destroy();
});

QUnit.test("onRecord callback throws — external window-capture listeners do not see the event", (assert) => {
  const manager = HotkeyManager.getInstance();
  const recorder = manager.createRecorder({
    onRecord: () => {
      throw new Error("Intentional onRecord error");
    },
  });

  // Register a window-capture listener AFTER the manager (so it would fire
  // second). The recorder's own stopImmediatePropagation() call (pre-throw)
  // ensures this listener never sees the event — the call happens before
  // the onRecord callback that throws.
  let externalSaw = false;
  const externalListener = () => {
    externalSaw = true;
  };
  window.addEventListener("keydown", externalListener, true);

  recorder.start();
  fireKey("F5");

  assert.notOk(externalSaw, "External window-capture listener did NOT see the event after interceptor throw");

  window.removeEventListener("keydown", externalListener, true);
  recorder.destroy();
});

QUnit.test("onCancel callback throws — recorder stops and manager remains functional", (assert) => {
  const manager = HotkeyManager.getInstance();
  const recorder = manager.createRecorder({
    onRecord: () => {},
    onCancel: () => {
      throw new Error("Intentional onCancel error");
    },
  });

  recorder.start();
  // Escape triggers cancel() → onCancel throws → caught by pipeline try-catch
  fireKey("Escape");

  assert.notOk(recorder.isRecording, "Recorder stopped despite onCancel throw");

  // Manager should still dispatch normally
  let managerFired = false;
  manager.register("F6", () => {
    managerFired = true;
  });
  fireKey("F6");
  assert.ok(managerFired, "Manager dispatches normally after onCancel callback throw");

  recorder.destroy();
});

QUnit.test("Recorder start after manager destroy is a no-op", (assert) => {
  const manager = HotkeyManager.getInstance();
  const recorder = manager.createRecorder({ onRecord: () => {} });

  manager.destroy();
  assert.ok(recorder.isDestroyed, "Recorder marked destroyed");

  recorder.start();
  assert.notOk(recorder.isRecording, "start() on destroyed recorder is a no-op");
});

// ══════════════════════════════════════════════
// Target-scoped edge cases
// ══════════════════════════════════════════════

QUnit.module("Negative / Edge-Case — Target-scoped", freshManagerHooks());

QUnit.test("Target removed from DOM before keypress — hotkey does not fire", (assert) => {
  const manager = HotkeyManager.getInstance();
  const target = document.createElement("div");
  fixture.appendChild(target);

  let fired = false;
  manager.register(
    "Escape",
    () => {
      fired = true;
    },
    { target },
  );

  // Remove target from DOM — composedPath() of a global keypress won't include it
  target.remove();

  fireKey("Escape");
  assert.notOk(fired, "Hotkey does NOT fire when target is detached from DOM");
});

QUnit.test("Target never added to DOM — hotkey does not fire", (assert) => {
  const manager = HotkeyManager.getInstance();
  const target = document.createElement("div");
  // Never appended to document

  let fired = false;
  manager.register(
    "Escape",
    () => {
      fired = true;
    },
    { target },
  );

  fireKey("Escape");
  assert.notOk(fired, "Hotkey does NOT fire when target was never in DOM");
});

QUnit.test("Target removed and re-added — hotkey resumes", (assert) => {
  const manager = HotkeyManager.getInstance();
  const target = document.createElement("div");
  fixture.appendChild(target);

  let callCount = 0;
  manager.register(
    "Escape",
    () => {
      callCount++;
    },
    { target },
  );

  fireKeyOn(target, "Escape");
  assert.strictEqual(callCount, 1, "Fires while target is in DOM");

  target.remove();
  fireKey("Escape");
  assert.strictEqual(callCount, 1, "Does NOT fire while target is detached");

  // Re-add to DOM
  fixture.appendChild(target);
  fireKeyOn(target, "Escape");
  assert.strictEqual(callCount, 2, "Fires again after target is re-added to DOM");
});

QUnit.test("Unregister target-scoped hotkey after target removed — no leak", (assert) => {
  const manager = HotkeyManager.getInstance();
  const target = document.createElement("div");
  fixture.appendChild(target);

  const handle = manager.register("F5", () => {}, { target });
  target.remove();

  // Unregister after target is gone — should not throw
  handle.unregister();
  assert.notOk(handle.isActive, "Handle is inactive after unregister");
  assert.strictEqual(manager.getRegistrations().length, 0, "No registrations remain");
});

// ══════════════════════════════════════════════
// Unhandled callback error resilience
// ══════════════════════════════════════════════

QUnit.module("Negative / Edge-Case — Unhandled callback errors", freshManagerHooks());

QUnit.test("Throwing unhandled callback does not break subsequent hotkey dispatch", (assert) => {
  const manager = HotkeyManager.getInstance();
  let throwCount = 0;

  manager.setUnhandledHandler(() => {
    throwCount++;
    throw new Error("Intentional unhandled callback error");
  });

  // Fire unmatched key — unhandled throws, but error is caught and logged
  fireKey("F9");
  assert.strictEqual(throwCount, 1, "Unhandled callback was invoked");

  // Now register a real hotkey and verify the manager still works
  let hotkeyFired = false;
  manager.setUnhandledHandler(null); // Clear throwing handler
  manager.register("F5", () => {
    hotkeyFired = true;
  });

  fireKey("F5");
  assert.ok(hotkeyFired, "Hotkey dispatch works after unhandled callback threw");
});

QUnit.test("Throwing unhandled callback while suspended does not corrupt guard state", (assert) => {
  const manager = HotkeyManager.getInstance();
  const guard = manager.suspendDispatch("test");

  manager.setUnhandledHandler(() => {
    throw new Error("Intentional throw during suspension");
  });

  // Error is caught and logged — guard state must remain intact
  fireKey("F5");

  // Guard should still be active and functional
  assert.ok(guard.isActive, "Guard still active after unhandled throw");
  assert.ok(manager.isDispatchSuspended(), "Still suspended after unhandled throw");

  guard.release();
  manager.setUnhandledHandler(null);

  // Manager should work normally now
  let fired = false;
  manager.register("F5", () => {
    fired = true;
  });
  fireKey("F5");
  assert.ok(fired, "Manager dispatches normally after suspended unhandled throw");
});

QUnit.test("enabled() function throwing on hotkey — other hotkeys still fire", (assert) => {
  const manager = HotkeyManager.getInstance();
  let safeFired = false;

  manager.register("F1", () => {}, {
    enabled: () => {
      throw new Error("Intentional enabled() error");
    },
  });

  manager.register("F2", () => {
    safeFired = true;
  });

  // F1 has throwing enabled() — treated as disabled, error logged, pipeline continues
  fireKey("F1");

  fireKey("F2");
  assert.ok(safeFired, "Other hotkey fires after enabled() threw on a different registration");
});
