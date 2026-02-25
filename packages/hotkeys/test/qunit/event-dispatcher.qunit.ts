import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { UnhandledReason } from "ui5/hotkeys/library";
import type { UnhandledContext, KeyboardDispatchGuard } from "ui5/hotkeys/types";
import { fireKey, fireKeyOn, fireKeyUp, fireBlur } from "./test-helpers";

let manager: HotkeyManager;

QUnit.module("EventDispatcher & Suspend Guard", {
  beforeEach() {
    manager = HotkeyManager.getInstance();
  },
  afterEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Already destroyed
    }
  },
});

// ──────────────────────────────────────────────
// Suspend guard: basic behavior
// ──────────────────────────────────────────────

QUnit.test("Single guard blocks dispatch", (assert) => {
  let callCount = 0;
  manager.register("F5", () => {
    callCount++;
  });

  const guard = manager.suspendDispatch("test");
  assert.ok(guard.isActive, "Guard is active");
  assert.ok(manager.isDispatchSuspended(), "Dispatch is suspended");

  fireKey("F5");
  assert.strictEqual(callCount, 0, "Hotkey callback did NOT fire while suspended");

  guard.release();
  assert.notOk(guard.isActive, "Guard is inactive after release");
  assert.notOk(manager.isDispatchSuspended(), "Dispatch resumes after release");

  fireKey("F5");
  assert.strictEqual(callCount, 1, "Hotkey callback fires after guard released");
});

QUnit.test("Nested guards require all releases before dispatch resumes", (assert) => {
  let callCount = 0;
  manager.register("F5", () => {
    callCount++;
  });

  const guard1 = manager.suspendDispatch("outer");
  const guard2 = manager.suspendDispatch("inner");

  fireKey("F5");
  assert.strictEqual(callCount, 0, "Blocked by both guards");

  guard1.release();
  assert.ok(manager.isDispatchSuspended(), "Still suspended — guard2 active");

  fireKey("F5");
  assert.strictEqual(callCount, 0, "Still blocked by guard2");

  guard2.release();
  assert.notOk(manager.isDispatchSuspended(), "Dispatch resumes");

  fireKey("F5");
  assert.strictEqual(callCount, 1, "Hotkey fires after both released");
});

QUnit.test("release() is idempotent", (assert) => {
  manager.register("F5", () => {});

  const guard = manager.suspendDispatch("test");
  guard.release();
  guard.release(); // Double release — should not throw or decrement below zero

  assert.notOk(guard.isActive, "Guard still inactive");
  assert.notOk(manager.isDispatchSuspended(), "Dispatch still not suspended");
});

QUnit.test("destroy() invalidates all guards", (assert) => {
  const guard1 = manager.suspendDispatch("g1");
  const guard2 = manager.suspendDispatch("g2");

  manager.destroy();

  assert.notOk(guard1.isActive, "Guard1 invalidated");
  assert.notOk(guard2.isActive, "Guard2 invalidated");

  // release on invalidated guard should not throw
  guard1.release();
  guard2.release();
  assert.ok(true, "release() on invalidated guards does not throw");
});

QUnit.test("Key state tracks during suspension", (assert) => {
  const tracker = manager.getKeyStateTracker();
  const guard = manager.suspendDispatch("test");

  fireKey("a");
  assert.ok(tracker.isKeyHeld("a"), "Key 'a' tracked during suspension");

  fireKeyUp("a");
  assert.notOk(tracker.isKeyHeld("a"), "Key 'a' released during suspension");

  guard.release();
});

QUnit.test("Suspend does NOT preventDefault — browser defaults leak", (assert) => {
  const guard = manager.suspendDispatch("test");

  const event = fireKey("F5");
  assert.notOk(event.defaultPrevented, "preventDefault NOT called during suspension");

  guard.release();
});

QUnit.test("Suspended → unhandled fires with Suspended reason", (assert) => {
  let unhandledCtx: UnhandledContext | null = null;
  manager.setUnhandledHandler((ctx) => {
    unhandledCtx = ctx;
  });
  manager.register("F5", () => {});

  const guard = manager.suspendDispatch("test");
  fireKey("F5");

  assert.ok(unhandledCtx !== null, "Unhandled callback fired");
  assert.strictEqual(unhandledCtx!.reason, UnhandledReason.Suspended, "Reason is Suspended");
  assert.strictEqual(unhandledCtx!.skippedRegistration, undefined, "No skippedRegistration for Suspended");

  guard.release();
});

QUnit.test("In-progress sequence times out during suspension", (assert) => {
  const done = assert.async();
  let seqFired = false;

  manager.registerSequence(
    ["G", "I"],
    () => {
      seqFired = true;
    },
    { timeout: 100 },
  );

  // Start the sequence
  fireKey("G");

  // Suspend immediately
  const guard = manager.suspendDispatch("test");

  // Wait for timeout to expire during suspension
  setTimeout(() => {
    guard.release();
    fireKey("I"); // Should not complete sequence — timed out

    assert.notOk(seqFired, "Sequence did NOT complete (timed out during suspension)");
    done();
  }, 200);
});

QUnit.test("Suspend mid-sequence, release before timeout — sequence completes", (assert) => {
  const done = assert.async();
  let seqFired = false;

  manager.registerSequence(
    ["G", "I"],
    () => {
      seqFired = true;
    },
    { timeout: 500 },
  );

  // Start the sequence
  fireKey("G");

  // Suspend briefly
  const guard = manager.suspendDispatch("test");

  setTimeout(() => {
    guard.release();
    fireKey("I");
    assert.ok(seqFired, "Sequence completed after brief suspension");
    done();
  }, 50);
});

// ──────────────────────────────────────────────
// Reentrancy
// ──────────────────────────────────────────────

QUnit.test("Reentrancy: suspendDispatch inside callback affects next event", (assert) => {
  let callCount = 0;
  let guard: KeyboardDispatchGuard | null = null;

  manager.register("F5", () => {
    callCount++;
    if (callCount === 1) {
      guard = manager.suspendDispatch("from-callback");
    }
  });

  fireKey("F5");
  assert.strictEqual(callCount, 1, "First F5 fires normally");

  fireKey("F5");
  assert.strictEqual(callCount, 1, "Second F5 is blocked by guard");

  guard!.release();
  fireKey("F5");
  assert.strictEqual(callCount, 2, "Third F5 fires after guard released");
});

// ──────────────────────────────────────────────
// Interceptor + Guard interaction
// ──────────────────────────────────────────────

QUnit.test("Interceptor active + guard active → interceptor wins", (assert) => {
  let recorderFired = false;
  let hotkeyFired = false;

  manager.register("F5", () => {
    hotkeyFired = true;
  });

  const guard = manager.suspendDispatch("test");
  const recorder = manager.createRecorder({
    onRecord: () => {
      recorderFired = true;
    },
  });
  recorder.start();

  fireKey("F5");
  assert.ok(recorderFired, "Recorder received the key");
  assert.notOk(hotkeyFired, "Hotkey did NOT fire");

  recorder.destroy();
  guard.release();
});

// ──────────────────────────────────────────────
// Target-scoped matching via composedPath()
// ──────────────────────────────────────────────

QUnit.test("Target-scoped: composedPath match", (assert) => {
  const target = document.createElement("div");
  document.body.appendChild(target);

  let fired = false;
  manager.register(
    "Escape",
    () => {
      fired = true;
    },
    { target },
  );

  fireKeyOn(target, "Escape");
  assert.ok(fired, "Callback fires when event is within target");

  target.remove();
});

QUnit.test("Target-scoped: composedPath miss", (assert) => {
  const target = document.createElement("div");
  const other = document.createElement("div");
  document.body.appendChild(target);
  document.body.appendChild(other);

  let fired = false;
  manager.register(
    "Escape",
    () => {
      fired = true;
    },
    { target },
  );

  fireKeyOn(other, "Escape");
  assert.notOk(fired, "Callback does NOT fire when event is outside target");

  target.remove();
  other.remove();
});

QUnit.test("Target-scoped: document priority (stopPropagation: true)", (assert) => {
  const target = document.createElement("div");
  document.body.appendChild(target);

  let docFired = false;
  let targetFired = false;

  // Document-level with stopPropagation: true (default) → blocks target-scoped
  manager.register("Escape", () => {
    docFired = true;
  });
  manager.register(
    "Escape",
    () => {
      targetFired = true;
    },
    { target },
  );

  fireKeyOn(target, "Escape");
  assert.ok(docFired, "Document-level callback fired");
  assert.notOk(targetFired, "Target-scoped callback skipped (document stopPropagation: true)");

  target.remove();
});

QUnit.test("Target-scoped: document without stopPropagation + target — both fire", (assert) => {
  const target = document.createElement("div");
  document.body.appendChild(target);

  let docFired = false;
  let targetFired = false;

  manager.register(
    "Escape",
    () => {
      docFired = true;
    },
    { stopPropagation: false },
  );
  manager.register(
    "Escape",
    () => {
      targetFired = true;
    },
    { target },
  );

  fireKeyOn(target, "Escape");
  assert.ok(docFired, "Document-level callback fired");
  assert.ok(targetFired, "Target-scoped callback also fired (doc stopPropagation: false)");

  target.remove();
});

QUnit.test("Target-scoped: nested targets, innermost wins", (assert) => {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  outer.appendChild(inner);
  document.body.appendChild(outer);

  let outerFired = false;
  let innerFired = false;

  manager.register(
    "Escape",
    () => {
      outerFired = true;
    },
    { target: outer },
  );
  manager.register(
    "Escape",
    () => {
      innerFired = true;
    },
    { target: inner },
  );

  fireKeyOn(inner, "Escape");
  assert.ok(innerFired, "Innermost target callback fired");
  assert.notOk(outerFired, "Outer target callback did NOT fire (innermost wins)");

  outer.remove();
});

QUnit.test("Target-scoped: nested targets, different keys fire independently", (assert) => {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  outer.appendChild(inner);
  document.body.appendChild(outer);

  let outerFired = false;
  let innerFired = false;

  manager.register(
    "F5",
    () => {
      outerFired = true;
    },
    { target: outer },
  );
  manager.register(
    "Escape",
    () => {
      innerFired = true;
    },
    { target: inner },
  );

  fireKeyOn(inner, "Escape");
  assert.ok(innerFired, "Inner callback fires for Escape");
  assert.notOk(outerFired, "Outer callback does not fire for Escape");

  innerFired = false;
  fireKeyOn(inner, "F5");
  assert.ok(outerFired, "Outer callback fires for F5 (inner is in composedPath)");

  outer.remove();
});

QUnit.test("Unhandled: target mismatch reason", (assert) => {
  const target = document.createElement("div");
  const other = document.createElement("div");
  document.body.appendChild(target);
  document.body.appendChild(other);

  let unhandledCtx: UnhandledContext | null = null;
  manager.setUnhandledHandler((ctx) => {
    unhandledCtx = ctx;
  });
  manager.register("Escape", () => {}, { target });

  fireKeyOn(other, "Escape");
  assert.ok(unhandledCtx !== null, "Unhandled callback fired");
  assert.strictEqual(unhandledCtx!.reason, UnhandledReason.TargetMismatch, "Reason is TargetMismatch");

  target.remove();
  other.remove();
});

// ──────────────────────────────────────────────
// Unhandled callback behavior
// ──────────────────────────────────────────────

QUnit.test("Unhandled: synchronous emission (no deferred state)", (assert) => {
  let unhandledCount = 0;
  manager.setUnhandledHandler(() => {
    unhandledCount++;
  });

  fireKey("F5"); // No registration → unhandled
  assert.strictEqual(unhandledCount, 1, "Unhandled fires synchronously");
});

QUnit.test("Unhandled: full sequence consumed suppresses unhandled", (assert) => {
  let unhandledCount = 0;
  let seqFired = false;
  manager.setUnhandledHandler(() => {
    unhandledCount++;
  });
  manager.registerSequence(
    ["G", "I"],
    () => {
      seqFired = true;
    },
    { timeout: 500 },
  );

  fireKey("G");
  fireKey("I");

  assert.ok(seqFired, "Sequence completed");
  assert.strictEqual(unhandledCount, 0, "Unhandled NOT called for consumed sequence");
});

QUnit.test("Unhandled: partial sequence advance suppresses unhandled", (assert) => {
  let unhandledCount = 0;
  manager.setUnhandledHandler(() => {
    unhandledCount++;
  });
  manager.registerSequence(["G", "I"], () => {}, { timeout: 500 });

  fireKey("G"); // Partial advance
  assert.strictEqual(unhandledCount, 0, "Unhandled NOT called for partial sequence advance");
});

// ──────────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────────

QUnit.test("Destroy removes all window listeners", (assert) => {
  let callCount = 0;
  manager.register("F5", () => {
    callCount++;
  });

  manager.destroy();

  fireKey("F5");
  assert.strictEqual(callCount, 0, "No callbacks after destroy");
});

QUnit.test("Re-create after destroy works", (assert) => {
  manager.destroy();

  const newManager = HotkeyManager.getInstance();
  let fired = false;
  newManager.register("F5", () => {
    fired = true;
  });

  fireKey("F5");
  assert.ok(fired, "Fresh manager works after destroy");
});

QUnit.test("Destroy marks tracked recorders as destroyed", (assert) => {
  const recorder = manager.createRecorder({ onRecord: () => {} });
  recorder.start();

  manager.destroy();

  assert.ok(recorder.isDestroyed, "Recorder is destroyed after manager destroy");
  assert.notOk(recorder.isRecording, "Recorder is not recording after manager destroy");
});

QUnit.test("Recorder stop after manager destroy — no throw", (assert) => {
  const recorder = manager.createRecorder({ onRecord: () => {} });
  recorder.start();
  manager.destroy();

  recorder.stop();
  assert.ok(true, "stop() on recorder after manager destroy does not throw");
});

// ──────────────────────────────────────────────
// Conflict: same key as hotkey and sequence first step
// ──────────────────────────────────────────────

QUnit.test("Same key registered as hotkey AND first step of sequence", (assert) => {
  let hotkeyFired = false;
  let seqFired = false;
  let unhandledCount = 0;

  manager.setUnhandledHandler(() => {
    unhandledCount++;
  });
  manager.register("G", () => {
    hotkeyFired = true;
  });
  manager.registerSequence(
    ["G", "I"],
    () => {
      seqFired = true;
    },
    { timeout: 500 },
  );

  fireKey("G");
  assert.ok(hotkeyFired, "Hotkey callback fires for G");
  assert.strictEqual(unhandledCount, 0, "Unhandled NOT called (both hotkey and partial sequence consumed)");

  fireKey("I");
  assert.ok(seqFired, "Sequence completes with G → I");
});

// ──────────────────────────────────────────────
// Blur handling
// ──────────────────────────────────────────────

QUnit.test("Blur clears KeyStateTracker via dispatcher", (assert) => {
  const tracker = manager.getKeyStateTracker();
  fireKey("a");
  assert.ok(tracker.isKeyHeld("a"), "Key held before blur");

  fireBlur();
  assert.strictEqual(tracker.getHeldKeys().length, 0, "All keys cleared after blur");
});
