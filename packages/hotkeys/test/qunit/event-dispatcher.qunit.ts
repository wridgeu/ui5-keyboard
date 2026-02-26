import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { UnhandledReason } from "ui5/hotkeys/library";
import type { UnhandledContext, KeyboardDispatchGuard } from "ui5/hotkeys/types";
import type Log from "sap/base/Log";
import { fireKey, fireKeyOn, fireKeyUp, fireBlur } from "./test-helpers";

declare const sinon: {
  spy: (
    obj: object,
    method: string,
  ) => {
    callCount: number;
    called: boolean;
    restore: () => void;
  };
};

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

QUnit.test("Target-scoped: stale target reference with same DOM id still matches", (assert) => {
  const original = document.createElement("div");
  original.id = "hk-stale-target";
  document.body.appendChild(original);

  let fired = false;
  manager.register(
    "Escape",
    () => {
      fired = true;
    },
    { target: original },
  );

  const replacement = document.createElement("div");
  replacement.id = "hk-stale-target";
  original.replaceWith(replacement);

  fireKeyOn(replacement, "Escape");
  assert.ok(fired, "Callback still fires when target DOM node is replaced with same id");

  replacement.remove();
});

QUnit.test("Target-scoped: target priority over document (stopPropagation: true)", (assert) => {
  const target = document.createElement("div");
  document.body.appendChild(target);

  let docFired = false;
  let targetFired = false;

  // Document-level handler exists, but target-scoped fires first
  manager.register("Escape", () => {
    docFired = true;
  });
  // Target-scoped with stopPropagation: true (default) → blocks document-level
  manager.register(
    "Escape",
    () => {
      targetFired = true;
    },
    { target },
  );

  fireKeyOn(target, "Escape");
  assert.ok(targetFired, "Target-scoped callback fired (target has priority)");
  assert.notOk(docFired, "Document-level callback skipped (target stopPropagation: true)");

  target.remove();
});

QUnit.test("Target-scoped: target without stopPropagation + document — both fire", (assert) => {
  const target = document.createElement("div");
  document.body.appendChild(target);

  let docFired = false;
  let targetFired = false;

  manager.register("Escape", () => {
    docFired = true;
  });
  // Target-scoped with stopPropagation: false → allows document-level to fire too
  manager.register(
    "Escape",
    () => {
      targetFired = true;
    },
    { target, stopPropagation: false },
  );

  fireKeyOn(target, "Escape");
  assert.ok(targetFired, "Target-scoped callback fired first");
  assert.ok(docFired, "Document-level callback also fired (target stopPropagation: false)");

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

QUnit.test("Target-scoped: nested targets with allowBubble execute inner then outer", (assert) => {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  outer.appendChild(inner);
  document.body.appendChild(outer);

  const firedOrder: string[] = [];

  manager.register(
    "Escape",
    () => {
      firedOrder.push("outer");
    },
    { target: outer },
  );
  manager.register(
    "Escape",
    () => {
      firedOrder.push("inner");
    },
    { target: inner, allowBubble: true, stopPropagation: false },
  );

  fireKeyOn(inner, "Escape");

  assert.deepEqual(firedOrder, ["inner", "outer"], "Bubbling executes targets from inner to outer");

  outer.remove();
});

QUnit.test("Target-scoped: allowBubble skips outer when inner unregisters it", (assert) => {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  outer.appendChild(inner);
  document.body.appendChild(outer);

  let outerFired = false;
  let innerFired = false;

  const outerHandle = manager.register(
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
      outerHandle.unregister();
    },
    { target: inner, allowBubble: true, stopPropagation: false },
  );

  fireKeyOn(inner, "Escape");

  assert.ok(innerFired, "Inner callback fired");
  assert.notOk(outerFired, "Outer callback did NOT fire after being unregistered by inner callback");

  outer.remove();
});

QUnit.test("Target-scoped: stopPropagation on inner does not block allowBubble", (assert) => {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  outer.appendChild(inner);
  document.body.appendChild(outer);

  const firedOrder: string[] = [];

  manager.register(
    "Escape",
    () => {
      firedOrder.push("outer");
    },
    { target: outer, stopPropagation: false },
  );
  manager.register(
    "Escape",
    () => {
      firedOrder.push("inner");
    },
    { target: inner, allowBubble: true, stopPropagation: true },
  );

  fireKeyOn(inner, "Escape");

  assert.deepEqual(
    firedOrder,
    ["inner", "outer"],
    "allowBubble controls internal target traversal independently from stopPropagation",
  );

  outer.remove();
});

QUnit.test("Target-scoped: stopPropagation on inner blocks document-level even when allowBubble is true", (assert) => {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  outer.appendChild(inner);
  document.body.appendChild(outer);

  let docCalled = false;
  const firedOrder: string[] = [];

  manager.register("Escape", () => {
    docCalled = true;
  });
  manager.register(
    "Escape",
    () => {
      firedOrder.push("outer");
    },
    { target: outer, stopPropagation: false },
  );
  manager.register(
    "Escape",
    () => {
      firedOrder.push("inner");
    },
    { target: inner, allowBubble: true, stopPropagation: true },
  );

  fireKeyOn(inner, "Escape");

  assert.deepEqual(firedOrder, ["inner", "outer"], "Both target handlers fire via allowBubble");
  assert.notOk(docCalled, "Document-level handler blocked by stopPropagation on inner target match");

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

// ──────────────────────────────────────────────
// clearInterceptor owner-safety
// ──────────────────────────────────────────────

QUnit.test("clearInterceptor is owner-safe — wrong owner cannot clear", (assert) => {
  let recordedA: string | null = null;

  const recorderA = manager.createRecorder({
    onRecord: (h) => {
      recordedA = h;
    },
  });
  const recorderB = manager.createRecorder({
    onRecord: () => {},
  });

  recorderA.start();

  // recorderB tries to stop() (which calls clearInterceptor with itself as owner)
  // but recorderB is NOT the current interceptor — should be a no-op
  recorderB.stop();

  // recorderA should still be the active interceptor
  assert.ok(recorderA.isRecording, "RecorderA still recording after wrong-owner clear attempt");

  fireKey("F5");
  assert.strictEqual(recordedA, "F5", "RecorderA still received the key");
});

// ──────────────────────────────────────────────
// Nested targets — stopPropagation edge cases
// ──────────────────────────────────────────────

QUnit.test("Nested targets — default remains innermost with stopPropagation: false", (assert) => {
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
    { target: outer, stopPropagation: false },
  );
  manager.register(
    "Escape",
    () => {
      innerFired = true;
    },
    { target: inner, stopPropagation: false },
  );

  fireKeyOn(inner, "Escape");
  assert.ok(innerFired, "Innermost target callback fired");
  assert.notOk(outerFired, "Outer target callback did NOT fire (no bubbling by default)");

  outer.remove();
});

QUnit.test("Nested targets — stopPropagation on inner does not change default non-bubbling", (assert) => {
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
    { target: inner, stopPropagation: true },
  );

  fireKeyOn(inner, "Escape");
  assert.ok(innerFired, "Inner callback fired");
  assert.notOk(outerFired, "Outer callback did NOT fire");

  outer.remove();
});

// ──────────────────────────────────────────────
// Target-scoped: stopPropagation option vs callback
// ──────────────────────────────────────────────

QUnit.test("Target-scoped: option governs bubbling, not callback event.stopPropagation()", (assert) => {
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
    (event) => {
      innerFired = true;
      // Callback explicitly calls event.stopPropagation(), but option-based
      // dispatch behavior is controlled by registration options.
      event.stopPropagation();
    },
    { target: inner, stopPropagation: false },
  );

  fireKeyOn(inner, "Escape");
  assert.ok(innerFired, "Innermost target callback fired");
  assert.notOk(outerFired, "Outer target did NOT fire (allowBubble not enabled)");

  outer.remove();
});

// ──────────────────────────────────────────────
// Destroyed dispatcher safety
// ──────────────────────────────────────────────

QUnit.test("Destroyed manager: suspendDispatch throws", (assert) => {
  manager.destroy();

  assert.throws(
    () => {
      manager.suspendDispatch("after-destroy");
    },
    /destroyed/i,
    "suspendDispatch throws on destroyed manager",
  );
});

// ──────────────────────────────────────────────
// Event context reset — no stale data
// ──────────────────────────────────────────────

QUnit.test("Unhandled reason is fresh per event (no stale skip info)", (assert) => {
  const reasons: string[] = [];
  manager.setUnhandledHandler((ctx) => {
    reasons.push(ctx.reason);
  });

  const target = document.createElement("div");
  const other = document.createElement("div");
  document.body.appendChild(target);
  document.body.appendChild(other);

  // Register target-scoped Escape
  manager.register("Escape", () => {}, { target });

  // Fire from outside target → should be TargetMismatch
  fireKeyOn(other, "Escape");
  assert.strictEqual(reasons[0], UnhandledReason.TargetMismatch, "First event: TargetMismatch");

  // Fire a totally different key with no registration → should be NoMatch, NOT stale TargetMismatch
  fireKey("F9");
  assert.strictEqual(reasons[1], UnhandledReason.NoMatch, "Second event: NoMatch (not stale TargetMismatch)");

  target.remove();
  other.remove();
});

// ──────────────────────────────────────────────
// Third-party listener interaction
// ──────────────────────────────────────────────

QUnit.test("stopPropagation: true blocks document capture listeners", (assert) => {
  let docCaptureCount = 0;
  const docListener = () => {
    docCaptureCount++;
  };
  document.addEventListener("keydown", docListener, true);

  manager.register("F5", () => {}); // default stopPropagation: true

  fireKey("F5");
  assert.strictEqual(docCaptureCount, 0, "Document capture listener did NOT fire (event stopped at window)");

  document.removeEventListener("keydown", docListener, true);
});

QUnit.test("stopPropagation: false allows document capture listeners", (assert) => {
  let docCaptureCount = 0;
  const docListener = () => {
    docCaptureCount++;
  };
  document.addEventListener("keydown", docListener, true);

  manager.register("F5", () => {}, { stopPropagation: false });

  fireKey("F5");
  assert.strictEqual(docCaptureCount, 1, "Document capture listener fires (stopPropagation: false)");

  document.removeEventListener("keydown", docListener, true);
});

QUnit.test("stopPropagation: true blocks document bubble listeners", (assert) => {
  let docBubbleCount = 0;
  const docListener = () => {
    docBubbleCount++;
  };
  document.addEventListener("keydown", docListener, false);

  manager.register("F5", () => {}); // default stopPropagation: true

  fireKey("F5");
  assert.strictEqual(docBubbleCount, 0, "Document bubble listener did NOT fire");

  document.removeEventListener("keydown", docListener, false);
});

QUnit.test("stopPropagation: false allows both window capture and document listeners", (assert) => {
  let windowCaptureCount = 0;
  let docCaptureCount = 0;
  const winListener = () => {
    windowCaptureCount++;
  };
  const docListener = () => {
    docCaptureCount++;
  };
  window.addEventListener("keydown", winListener, true);
  document.addEventListener("keydown", docListener, true);

  manager.register("F5", () => {}, { stopPropagation: false });

  fireKey("F5");
  assert.strictEqual(windowCaptureCount, 1, "Window capture listener fires (stopPropagation: false)");
  assert.strictEqual(docCaptureCount, 1, "Document capture listener fires (stopPropagation: false)");

  window.removeEventListener("keydown", winListener, true);
  document.removeEventListener("keydown", docListener, true);
});

QUnit.test("Window capture listener fires even with stopPropagation: true", (assert) => {
  let windowCaptureCount = 0;
  const winListener = () => {
    windowCaptureCount++;
  };
  // Add our listener AFTER the dispatcher's (same target, same phase — insertion order)
  window.addEventListener("keydown", winListener, true);

  manager.register("F5", () => {}); // default stopPropagation: true

  fireKey("F5");
  // stopPropagation prevents child targets (document) but not same-target listeners
  // However, since our listener was added AFTER the dispatcher's, it depends on
  // whether stopPropagation was called. With window capture, stopPropagation
  // prevents propagation to children but other same-target capture listeners still fire.
  assert.strictEqual(windowCaptureCount, 1, "Window capture listener fires (same target as dispatcher)");

  window.removeEventListener("keydown", winListener, true);
});

// ──────────────────────────────────────────────
// Target-scoped: target = document
// ──────────────────────────────────────────────

QUnit.test("Target-scoped: target = document has higher priority than document-level", (assert) => {
  let docLevelFired = false;
  let targetDocFired = false;

  // Document-level (no target) — lower priority (fallback)
  manager.register("F5", () => {
    docLevelFired = true;
  });
  // target: document — treated as target-scoped, fires first
  manager.register(
    "F5",
    () => {
      targetDocFired = true;
    },
    { target: document },
  );

  fireKey("F5");
  assert.ok(targetDocFired, "target:document registration fired (target-scoped has priority)");
  assert.notOk(docLevelFired, "Document-level registration did NOT fire (target stopPropagation blocks it)");
});

// ──────────────────────────────────────────────
// onDetached idempotent
// ──────────────────────────────────────────────

QUnit.test("onDetached is idempotent on already-stopped recorder", (assert) => {
  const recorder = manager.createRecorder({ onRecord: () => {} });
  recorder.start();
  recorder.stop();
  assert.notOk(recorder.isRecording, "Recorder stopped");

  // Simulate a second onDetached call (e.g., from destroy) — should not throw
  // We test this by starting another recorder (which would call onDetached on
  // the previous interceptor if it were still set — but it isn't because stop() cleared it)
  const recorder2 = manager.createRecorder({ onRecord: () => {} });
  recorder2.start();
  assert.ok(recorder2.isRecording, "Second recorder started without error");
  assert.notOk(recorder.isRecording, "First recorder still not recording");

  recorder2.destroy();
  recorder.destroy();
});

// ──────────────────────────────────────────────
// setInterceptor replacement calls onDetached synchronously
// ──────────────────────────────────────────────

QUnit.test("setInterceptor replacement calls onDetached synchronously", (assert) => {
  const events: string[] = [];

  const recorderA = manager.createRecorder({
    onRecord: () => {
      events.push("A-record");
    },
  });
  const recorderB = manager.createRecorder({
    onRecord: () => {
      events.push("B-record");
    },
  });

  recorderA.start();
  assert.ok(recorderA.isRecording, "A recording");

  // Starting B replaces A — onDetached called synchronously before start() returns
  recorderB.start();
  assert.notOk(recorderA.isRecording, "A.isRecording is false synchronously after B.start()");
  assert.ok(recorderB.isRecording, "B is recording");

  recorderA.destroy();
  recorderB.destroy();
});

// ──────────────────────────────────────────────
// Recorder tracking leak prevention
// ──────────────────────────────────────────────

QUnit.test("recorder.destroy() untracks from dispatcher — no double-destroy on manager teardown", (assert) => {
  const recorder = manager.createRecorder({ onRecord: () => {} });

  // Destroy the recorder first — this should untrack it from the dispatcher
  recorder.destroy();
  assert.ok(recorder.isDestroyed, "Recorder is destroyed after its own destroy()");

  // Now create a second recorder that stays alive
  const recorder2 = manager.createRecorder({ onRecord: () => {} });

  // When manager destroys, it iterates tracked recorders and calls _onDispatcherDestroyed.
  // If recorder was NOT untracked, _onDispatcherDestroyed would be called on an already-
  // destroyed recorder (which would be a leak). recorder2 should be properly notified.
  manager.destroy();
  assert.ok(recorder.isDestroyed, "First recorder still destroyed (no double-destroy side effects)");
  assert.ok(recorder2.isDestroyed, "Second recorder destroyed by manager teardown");

  // Re-create manager works cleanly
  const newManager = HotkeyManager.getInstance();
  const newRecorder = newManager.createRecorder({ onRecord: () => {} });
  assert.notOk(newRecorder.isDestroyed, "New recorder is functional after clean re-creation");
  newRecorder.destroy();
});

// ──────────────────────────────────────────────
// Scope-based target matching precedence
// ──────────────────────────────────────────────

QUnit.test("Active-scope target takes precedence over global-scope target", (assert) => {
  const outerTarget = document.createElement("div");
  const innerTarget = document.createElement("div");
  outerTarget.appendChild(innerTarget);
  document.body.appendChild(outerTarget);

  let globalFired = false;
  let scopedFired = false;

  // Global-scope target on inner element
  manager.register(
    "Escape",
    () => {
      globalFired = true;
    },
    { target: innerTarget },
  );
  // Active-scope target on outer element — should win due to scope precedence
  manager.register(
    "Escape",
    () => {
      scopedFired = true;
    },
    { target: outerTarget, scope: "testScope" },
  );

  manager.pushScope("testScope");

  fireKeyOn(innerTarget, "Escape");
  assert.ok(scopedFired, "Active-scope target callback fired");
  assert.notOk(globalFired, "Global-scope target callback did NOT fire (active scope wins)");

  manager.popScope("testScope");
  outerTarget.remove();
});

QUnit.test("GLOBAL_SCOPE: no duplicate matching when active scope is global", (assert) => {
  const target = document.createElement("div");
  document.body.appendChild(target);

  let callCount = 0;
  manager.register(
    "Escape",
    () => {
      callCount++;
    },
    { target },
  );

  // Active scope is already GLOBAL_SCOPE (default)
  fireKeyOn(target, "Escape");
  assert.strictEqual(callCount, 1, "Callback fired exactly once (no duplicate global pass)");

  target.remove();
});

// ──────────────────────────────────────────────
// stopImmediatePropagation during recording
// ──────────────────────────────────────────────

QUnit.test("Recorder stopImmediatePropagation blocks non-library window listeners", (assert) => {
  let externalListenerCount = 0;
  const externalListener = () => {
    externalListenerCount++;
  };

  // Add an external window capture listener (simulating third-party code)
  window.addEventListener("keydown", externalListener, true);

  const recorder = manager.createRecorder({ onRecord: () => {} });
  recorder.start();

  fireKey("F5");

  // The recorder's onKeyDown calls stopImmediatePropagation, which blocks
  // other same-target capture listeners added after the dispatcher's listener.
  // However, the external listener was added AFTER manager creation, so it
  // should be blocked by stopImmediatePropagation.
  assert.strictEqual(
    externalListenerCount,
    0,
    "External window capture listener was blocked by stopImmediatePropagation",
  );

  recorder.destroy();
  window.removeEventListener("keydown", externalListener, true);
});

// ──────────────────────────────────────────────
// composedPath fallback
// ──────────────────────────────────────────────

QUnit.test("composedPath fallback — event with empty composedPath uses target fallback", (assert) => {
  const target = document.createElement("div");
  document.body.appendChild(target);

  let fired = false;
  // Register on the target
  manager.register(
    "Escape",
    () => {
      fired = true;
    },
    { target },
  );

  // Create a keyboard event and override composedPath to return empty
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "composedPath", { value: () => [] });
  Object.defineProperty(event, "target", { value: target });

  // Dispatch on target — the fallback should use [event.target, document, window]
  // so target should be in the path
  target.dispatchEvent(event);

  // Note: when dispatched on target, the real composedPath is used by the browser,
  // not our mock. So we test via document dispatch where we control the event.
  fired = false;
  const event2 = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  // Override composedPath on the event
  Object.defineProperty(event2, "composedPath", { value: () => [] });
  Object.defineProperty(event2, "target", { value: target });
  window.dispatchEvent(event2);

  // With fallback [event.target, document, window], the target element IS in the path
  assert.ok(fired, "Target-scoped hotkey fires via composedPath fallback");

  target.remove();
});

// ──────────────────────────────────────────────
// Interceptor replacement logs warning
// ──────────────────────────────────────────────

QUnit.test("Interceptor replacement logs warning via sap/base/Log", (assert) => {
  // Load sap/base/Log synchronously — module is already loaded by the library
  const LogModule = sap.ui.require("sap/base/Log") as typeof Log;
  assert.ok(LogModule, "sap/base/Log loaded synchronously");

  // Spy on Log.warning
  const spy = sinon.spy(LogModule, "warning");

  try {
    const recorderA = manager.createRecorder({ onRecord: () => {} });
    const recorderB = manager.createRecorder({ onRecord: () => {} });

    recorderA.start();
    assert.strictEqual(spy.callCount, 0, "No warning before replacement");

    // Starting recorderB replaces recorderA's interceptor
    recorderB.start();
    assert.strictEqual(spy.callCount, 1, "Log.warning fired on interceptor replacement");

    recorderB.destroy();
    recorderA.destroy();
  } finally {
    spy.restore();
  }
});

// ──────────────────────────────────────────────
// Target-scoped with same-origin iframe document
// ──────────────────────────────────────────────

QUnit.test("Target-scoped iframe document does NOT match parent document events", (assert) => {
  const done = assert.async();

  // Create a same-origin iframe
  const iframe = document.createElement("iframe");
  iframe.srcdoc = "<!DOCTYPE html><html><body></body></html>";
  document.body.appendChild(iframe);

  iframe.addEventListener("load", () => {
    try {
      const iframeDoc = iframe.contentDocument!;
      assert.ok(iframeDoc, "iframe contentDocument is accessible (same-origin)");

      let fired = false;
      // Register with target set to the iframe's document
      const handle = manager.register(
        "Escape",
        () => {
          fired = true;
        },
        { target: iframeDoc },
      );

      // Fire a key event on the PARENT document — the iframe's document
      // is NOT in the parent document's composedPath()
      fireKey("Escape");
      assert.notOk(fired, "Hotkey did NOT fire — iframe document is not in parent composedPath()");

      // Verify it also doesn't fire from a child element in the parent document
      const parentDiv = document.createElement("div");
      document.body.appendChild(parentDiv);
      fireKeyOn(parentDiv, "Escape");
      assert.notOk(fired, "Hotkey did NOT fire from parent div either");
      parentDiv.remove();

      handle.unregister();
    } finally {
      iframe.remove();
      done();
    }
  });
});
