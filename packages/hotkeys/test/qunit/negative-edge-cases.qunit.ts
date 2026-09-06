import { ConflictBehavior, UnhandledReason } from "ui5/hotkeys/library";
import { createHotkeyManager, destroyHotkeyManager, fireKey, fireKeyOn } from "./test-helpers";
import type Log from "sap/base/Log";

const fixture = document.getElementById("qunit-fixture")!;

/**
 * Shared module hooks that ensure a clean HotkeyManager instance
 * before and after every test.
 */
function freshManagerHooks() {
  return {
    beforeEach() {
      destroyHotkeyManager();
    },
    afterEach() {
      destroyHotkeyManager();
    },
  };
}

// ──────────────────────────────────────────────
// Conflict behavior edge cases
// ──────────────────────────────────────────────

QUnit.module("Negative / Edge-Case - Conflict behavior", freshManagerHooks());

QUnit.test("ConflictBehavior.Error: target-bound vs document-bound in same scope does not conflict", (assert) => {
  const manager = createHotkeyManager();
  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  // Register on document (target: null)
  manager.register("F3", () => {}, { conflictBehavior: ConflictBehavior.Error });

  // Register on specific target - different target, same scope: should NOT throw
  manager.register("F3", () => {}, { target: div, conflictBehavior: ConflictBehavior.Error });

  assert.strictEqual(manager.getRegistrations().length, 2, "Both registrations co-exist");
});

QUnit.test("ConflictBehavior.Error: same hotkey on different scopes does not conflict", (assert) => {
  const manager = createHotkeyManager();

  manager.register("Escape", () => {}, { scope: "editor", conflictBehavior: ConflictBehavior.Error });
  manager.register("Escape", () => {}, { scope: "dialog", conflictBehavior: ConflictBehavior.Error });

  assert.strictEqual(manager.getRegistrations().length, 2, "Both registrations co-exist in different scopes");
});

QUnit.test("ConflictBehavior.Error: same target in same scope DOES conflict", (assert) => {
  const manager = createHotkeyManager();
  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  manager.register("F5", () => {}, { target: div, conflictBehavior: ConflictBehavior.Error });

  assert.throws(
    () => manager.register("F5", () => {}, { target: div, conflictBehavior: ConflictBehavior.Error }),
    /already registered/,
    "Same hotkey on same target in same scope throws",
  );
});

QUnit.test("ConflictBehavior.Error: callback targets with same hotkey do not throw (resolved lazily)", (assert) => {
  const manager = createHotkeyManager();
  const a = document.createElement("div");
  const b = document.createElement("div");

  manager.register("F9", () => {}, { target: () => a, conflictBehavior: ConflictBehavior.Error });
  // A second callback target may resolve to a different element. The conflict
  // cannot be proven at registration time, so registration must NOT throw.
  manager.register("F9", () => {}, { target: () => b, conflictBehavior: ConflictBehavior.Error });

  assert.strictEqual(manager.getRegistrations().length, 2, "Both callback-target registrations co-exist");
});

QUnit.test("ConflictBehavior.Replace: callback targets with same hotkey are not silently removed", (assert) => {
  const manager = createHotkeyManager();
  const a = document.createElement("div");
  const b = document.createElement("div");

  manager.register("F10", () => {}, { target: () => a, conflictBehavior: ConflictBehavior.Replace });
  // Replace must not drop the first registration: the callbacks may resolve to
  // different elements, so the "conflict" is unprovable at registration time.
  manager.register("F10", () => {}, { target: () => b, conflictBehavior: ConflictBehavior.Replace });

  assert.strictEqual(manager.getRegistrations().length, 2, "Distinct callback-target registration is preserved");
});

QUnit.test("ConflictBehavior.Error: re-rendered element with same id conflicts via id-index", (assert) => {
  const manager = createHotkeyManager();
  const original = document.createElement("div");
  original.id = "hk-conflict-rerender";
  original.tabIndex = 0;
  fixture.appendChild(original);

  manager.register("F8", () => {}, { target: original, conflictBehavior: ConflictBehavior.Error });

  // Simulate re-render: new DOM node with same id
  const replacement = document.createElement("div");
  replacement.id = "hk-conflict-rerender";
  replacement.tabIndex = 0;
  original.replaceWith(replacement);

  assert.throws(
    () => manager.register("F8", () => {}, { target: replacement, conflictBehavior: ConflictBehavior.Error }),
    /already registered/,
    "Detects conflict via targetIdIndex when DOM node is replaced with same id",
  );
});

QUnit.test("ConflictBehavior.Replace: re-rendered element with same id replaces via id-index", (assert) => {
  const manager = createHotkeyManager();
  let oldCalled = false;
  let newCalled = false;

  const original = document.createElement("div");
  original.id = "hk-replace-rerender";
  original.tabIndex = 0;
  fixture.appendChild(original);

  manager.register(
    "F8",
    () => {
      oldCalled = true;
    },
    { target: original, conflictBehavior: ConflictBehavior.Replace },
  );

  const replacement = document.createElement("div");
  replacement.id = "hk-replace-rerender";
  replacement.tabIndex = 0;
  original.replaceWith(replacement);

  manager.register(
    "F8",
    () => {
      newCalled = true;
    },
    { target: replacement, conflictBehavior: ConflictBehavior.Replace },
  );

  fireKeyOn(replacement, "F8");
  assert.notOk(oldCalled, "Old registration was replaced");
  assert.ok(newCalled, "New registration fires on replacement element");
});

QUnit.test("ConflictBehavior.Error: failed registration does not pollute state", (assert) => {
  const manager = createHotkeyManager();
  let firstCalled = false;

  manager.register(
    "F6",
    () => {
      firstCalled = true;
    },
    { conflictBehavior: ConflictBehavior.Error },
  );

  assert.throws(
    () => manager.register("F6", () => {}, { conflictBehavior: ConflictBehavior.Error }),
    /already registered/,
  );

  // Only the first registration should exist
  assert.strictEqual(manager.getRegistrations().length, 1, "Failed registration not stored");

  fireKey("F6");
  assert.ok(firstCalled, "Original registration still fires after failed conflict");
});

// ──────────────────────────────────────────────
// enabled function returning false mid-sequence
// ──────────────────────────────────────────────

let clock: ReturnType<typeof sinon.useFakeTimers>;

QUnit.module("Negative / Edge-Case - enabled() mid-sequence", {
  beforeEach() {
    destroyHotkeyManager();
    clock = sinon.useFakeTimers();
  },
  afterEach() {
    clock.restore();
    destroyHotkeyManager();
  },
});

QUnit.test("enabled function returning false mid-sequence drops pending match", (assert) => {
  const manager = createHotkeyManager();
  let sequenceFired = false;
  let isEnabled = true;

  manager.register(
    "G E",
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

QUnit.test("enabled function throwing mid-sequence drops pending match", (assert) => {
  const manager = createHotkeyManager();
  let sequenceFired = false;
  let shouldThrow = false;

  manager.register(
    "G E",
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

QUnit.module("Negative / Edge-Case - Callback throws", freshManagerHooks());

QUnit.test("Throwing callback: same hotkey re-fires on subsequent keypress", (assert) => {
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();

  manager.register("F2", () => {
    throw new Error("Intentional callback error");
  });

  const event = fireKey("F2");
  assert.ok(event.defaultPrevented, "preventDefault called before callback ran and threw");
});

// ──────────────────────────────────────────────
// Misc edge cases
// ──────────────────────────────────────────────

QUnit.module("Negative / Edge-Case - Misc", freshManagerHooks());

QUnit.test("Unregistering inside own callback does not crash", (assert) => {
  const manager = createHotkeyManager();
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

QUnit.module("Negative / Edge-Case - Suspend guard abuse", freshManagerHooks());

QUnit.test("Stale guard from destroyed manager does not affect new manager", (assert) => {
  const manager = createHotkeyManager();
  const guard = manager.suspendDispatch("stale-test");
  manager.destroy();

  // Guard is invalidated
  assert.notOk(guard.isActive, "Stale guard is inactive after destroy");

  // New manager instance
  const newManager = createHotkeyManager();
  let fired = false;
  newManager.register("F5", () => {
    fired = true;
  });

  // Stale guard release should be a no-op - must NOT affect new manager
  guard.release();
  assert.notOk(newManager.isDispatchSuspended(), "New manager is NOT suspended by stale guard release");

  fireKey("F5");
  assert.ok(fired, "Hotkey fires on new manager - stale guard had no effect");
});

QUnit.test("Guard release during unhandled callback does not affect current event", (assert) => {
  const manager = createHotkeyManager();
  const guard = manager.suspendDispatch("will-release-in-callback");
  const reasons: string[] = [];

  manager.setUnhandledHandler((ctx) => {
    reasons.push(ctx.reason);
    // Release the guard inside the unhandled callback
    guard.release();
  });

  // First event - guard is active, so Suspended reason is emitted
  fireKey("F5");
  assert.strictEqual(reasons[0], UnhandledReason.Suspended, "First event: Suspended");
  assert.notOk(manager.isDispatchSuspended(), "Guard released inside callback");

  // Second event - guard was released, so now it's NoMatch (no registrations)
  fireKey("F5");
  assert.strictEqual(reasons[1], UnhandledReason.NoMatch, "Second event: NoMatch (guard released)");
});

QUnit.test("isDispatchSuspended returns false after destroy", (assert) => {
  const manager = createHotkeyManager();
  manager.suspendDispatch("test");
  assert.ok(manager.isDispatchSuspended(), "Suspended before destroy");

  manager.destroy();
  // isDispatchSuspended delegates to dispatcher which returns false when destroyed
  assert.notOk(manager.isDispatchSuspended(), "Not suspended after destroy");
});

// ══════════════════════════════════════════════
// Destroyed manager method calls
// ══════════════════════════════════════════════

QUnit.module("Negative / Edge-Case - Destroyed manager method calls", freshManagerHooks());

// One row per `_assertAlive` call site in HotkeyManager. `register()` gets a
// single row: `_assertAlive` is its first statement, ahead of any sequence
// parsing, so a "G I" spelling exercises nothing the plain key does not.
const destroyedGuardCases: [name: string, call: (manager: ReturnType<typeof createHotkeyManager>) => void][] = [
  ["register", (manager) => manager.register("F5", () => {})],
  ["createRecorder", (manager) => manager.createRecorder({ onRecord: () => {} })],
  ["createGroup", (manager) => manager.createGroup()],
  ["setUnhandledHandler", (manager) => manager.setUnhandledHandler(() => {})],
  ["addGenericRootId", (manager) => manager.addGenericRootId("custom-root")],
  ["removeGenericRootId", (manager) => manager.removeGenericRootId("custom-root")],
  ["suspendDispatch", (manager) => manager.suspendDispatch("after-destroy")],
  ["pushScope", (manager) => manager.pushScope("editor")],
  ["popScope", (manager) => manager.popScope("editor")],
  ["resetToGlobalScope", (manager) => manager.resetToGlobalScope()],
];

destroyedGuardCases.forEach(([name, call]) => {
  QUnit.test(`${name}() on destroyed manager throws`, (assert) => {
    const manager = createHotkeyManager();
    manager.destroy();

    assert.throws(() => call(manager), /destroyed/i, `${name}() throws on destroyed manager`);
  });
});

// ══════════════════════════════════════════════
// Recorder abuse
// ══════════════════════════════════════════════

QUnit.module("Negative / Edge-Case - Recorder abuse", freshManagerHooks());

QUnit.test("cancel() on destroyed recorder does not throw", (assert) => {
  const manager = createHotkeyManager();
  let cancelled = false;
  const recorder = manager.createRecorder({
    onRecord: () => {},
    onCancel: () => {
      cancelled = true;
    },
  });

  recorder.start();
  recorder.destroy();

  // cancel() after destroy must be idempotent: no throw, no onCancel, recorder
  // stays destroyed and stopped.
  recorder.cancel();
  assert.notOk(cancelled, "cancel() on destroyed recorder does not invoke onCancel");
  assert.ok(recorder.isDestroyed, "cancel() on destroyed recorder leaves isDestroyed true");
  assert.notOk(recorder.isRecording, "cancel() on destroyed recorder leaves isRecording false");
});

QUnit.test("onRecord callback throws - manager remains functional", (assert) => {
  const manager = createHotkeyManager();
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

QUnit.test("onRecord callback throws - external window-capture listeners do not see the event", (assert) => {
  const manager = createHotkeyManager();
  const recorder = manager.createRecorder({
    onRecord: () => {
      throw new Error("Intentional onRecord error");
    },
  });

  // Register a window-capture listener AFTER the manager (so it would fire
  // second). The recorder's own stopImmediatePropagation() call (pre-throw)
  // ensures this listener never sees the event - the call happens before
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

QUnit.test("onCancel callback throws - recorder stops and manager remains functional", (assert) => {
  const manager = createHotkeyManager();
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

// ══════════════════════════════════════════════
// Target-scoped edge cases
// ══════════════════════════════════════════════

QUnit.module("Negative / Edge-Case - Target-scoped", freshManagerHooks());

QUnit.test("Target removed and re-added - hotkey resumes", (assert) => {
  const manager = createHotkeyManager();
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

// ══════════════════════════════════════════════
// Unhandled callback error resilience
// ══════════════════════════════════════════════

QUnit.module("Negative / Edge-Case - Unhandled callback errors", freshManagerHooks());

QUnit.test("Throwing unhandled callback does not break subsequent hotkey dispatch", (assert) => {
  const manager = createHotkeyManager();
  let throwCount = 0;

  manager.setUnhandledHandler(() => {
    throwCount++;
    throw new Error("Intentional unhandled callback error");
  });

  // Fire unmatched key - unhandled throws, but error is caught and logged
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

QUnit.test("enabled() throwing - hotkey is disabled and the throw is logged at warning (not error) level", (assert) => {
  const LogModule = sap.ui.require("sap/base/Log") as typeof Log;
  const warnSpy = sinon.spy(LogModule, "warning");
  const errorSpy = sinon.spy(LogModule, "error");

  try {
    const manager = createHotkeyManager();
    let fired = false;
    manager.register(
      "F8",
      () => {
        fired = true;
      },
      {
        enabled: () => {
          throw new Error("Intentional enabled() error");
        },
      },
    );

    fireKey("F8");

    assert.notOk(fired, "throwing enabled() treats the hotkey as disabled (callback does not fire)");
    const enabledWarnings = warnSpy.getCalls().filter((c) => String(c.args[0]).includes("enabled() threw"));
    assert.ok(enabledWarnings.length >= 1, "the enabled() throw is logged at warning level");
    const enabledErrors = errorSpy.getCalls().filter((c) => String(c.args[0]).includes("enabled()"));
    assert.strictEqual(enabledErrors.length, 0, "the enabled() throw is not logged at error level");
  } finally {
    warnSpy.restore();
    errorSpy.restore();
  }
});
