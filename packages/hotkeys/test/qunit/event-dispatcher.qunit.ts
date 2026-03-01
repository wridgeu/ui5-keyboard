import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { UnhandledReason } from "ui5/hotkeys/library";
import type { UnhandledContext, KeyboardDispatchGuard } from "ui5/hotkeys/types";
import { FOCUS_PATH_FALLBACK_TTL_MS } from "ui5/hotkeys/internal/FocusFallbackTracker";
import type Log from "sap/base/Log";
import { fireKey, fireKeyOn, fireKeyUp, fireBlur } from "./test-helpers";

let manager: HotkeyManager;

QUnit.module("EventDispatcher & Suspend Guard", {
  beforeEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Not initialized yet
    }
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

QUnit.test("suspendDispatch on destroyed manager throws", (assert) => {
  const ref = manager;
  ref.destroy();
  assert.throws(
    () => {
      ref.suspendDispatch("after-destroy");
    },
    /destroyed/i,
    "suspendDispatch() throws on a destroyed manager",
  );
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
  const clock = sinon.useFakeTimers();
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

  // Advance past the sequence timeout while suspended
  clock.tick(200);

  guard.release();
  fireKey("I"); // Should not complete sequence — timed out

  assert.notOk(seqFired, "Sequence did NOT complete (timed out during suspension)");
  clock.restore();
});

QUnit.test("Suspend mid-sequence, release before timeout — sequence completes", (assert) => {
  const clock = sinon.useFakeTimers();
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

  // Advance time but stay within sequence timeout
  clock.tick(50);

  guard.release();
  fireKey("I");
  assert.ok(seqFired, "Sequence completed after brief suspension");
  clock.restore();
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

QUnit.test("Interceptor error is isolated — pipeline keeps working", (assert) => {
  const errorRecorder = manager.createRecorder({
    onRecord: () => {
      throw new Error("recorder boom");
    },
  });
  errorRecorder.start();

  // The throwing recorder should not crash the dispatch pipeline.
  fireKey("F5");
  assert.notOk(errorRecorder.isRecording, "Recorder stopped despite callback throw");

  errorRecorder.destroy();

  // After the broken recorder is gone, normal hotkeys should still work.
  let hotkeyFired = false;
  manager.register("F6", () => {
    hotkeyFired = true;
  });
  fireKey("F6");
  assert.ok(hotkeyFired, "Hotkey dispatch works after broken recorder is removed");
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

QUnit.test("Target-scoped: activeElement fallback path match", (assert) => {
  const target = document.createElement("div");
  const input = document.createElement("input");
  target.appendChild(input);
  document.body.appendChild(target);

  let fired = false;
  manager.register(
    "Escape",
    () => {
      fired = true;
    },
    { target },
  );

  input.focus();
  fireKey("Escape");

  assert.ok(fired, "Callback fires when activeElement is inside target even if event path is untargeted");

  target.remove();
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

  let untargetedFired = false;
  let targetFired = false;

  // Untargeted handler exists, but target-scoped fires first
  manager.register("Escape", () => {
    untargetedFired = true;
  });
  // Target-scoped with stopPropagation: true (default) → blocks untargeted
  manager.register(
    "Escape",
    () => {
      targetFired = true;
    },
    { target },
  );

  fireKeyOn(target, "Escape");
  assert.ok(targetFired, "Target-scoped callback fired (target has priority)");
  assert.notOk(untargetedFired, "Untargeted callback skipped (target stopPropagation: true)");

  target.remove();
});

QUnit.test("Target-scoped: target without stopPropagation + document — both fire", (assert) => {
  const target = document.createElement("div");
  document.body.appendChild(target);

  let untargetedFired = false;
  let targetFired = false;

  manager.register("Escape", () => {
    untargetedFired = true;
  });
  // Target-scoped with stopPropagation: false → allows untargeted to fire too
  manager.register(
    "Escape",
    () => {
      targetFired = true;
    },
    { target, stopPropagation: false },
  );

  fireKeyOn(target, "Escape");
  assert.ok(targetFired, "Target-scoped callback fired first");
  assert.ok(untargetedFired, "Untargeted callback also fired (target stopPropagation: false)");

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
  assert.notOk(outerFired, "Outer target did NOT fire (innermost wins)");

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

QUnit.test("Target-scoped: target = document degrades to untargeted registration", (assert) => {
  let fired = false;
  manager.register(
    "F5",
    () => {
      fired = true;
    },
    { target: document as unknown as HTMLElement },
  );

  fireKey("F5");
  assert.ok(fired, "Registration fires as untargeted after document target degradation");
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

  // Dispatch via window where we can control composedPath via mock
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

QUnit.test("Target-scoped iframe document degrades to untargeted registration", (assert) => {
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
      // Register with target set to the iframe's document — degrades to untargeted
      const handle = manager.register(
        "Escape",
        () => {
          fired = true;
        },
        { target: iframeDoc as unknown as HTMLElement },
      );

      // After degradation to untargeted, it fires for any key event
      fireKey("Escape");
      assert.ok(fired, "Registration fires as untargeted after document target degradation");

      handle.unregister();
    } finally {
      iframe.remove();
      done();
    }
  });
});

// ──────────────────────────────────────────────
// Three-tier target matching (inner + outer + untargeted)
// ──────────────────────────────────────────────

QUnit.test("Three-tier: focus in inner → only inner fires", (assert) => {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  const input = document.createElement("input");
  inner.appendChild(input);
  outer.appendChild(inner);
  document.body.appendChild(outer);

  let untargetedFired = false;
  let outerFired = false;
  let innerFired = false;

  manager.register("Escape", () => {
    untargetedFired = true;
  });
  manager.register(
    "Escape",
    () => {
      outerFired = true;
    },
    { target: outer, stopPropagation: true },
  );
  manager.register(
    "Escape",
    () => {
      innerFired = true;
    },
    { target: inner, stopPropagation: true },
  );

  fireKeyOn(input, "Escape");

  assert.ok(innerFired, "Inner target fired");
  assert.notOk(outerFired, "Outer target did NOT fire (innermost wins)");
  assert.notOk(untargetedFired, "Untargeted did NOT fire (stopPropagation)");

  outer.remove();
});

QUnit.test("Three-tier: focus in outer (not inner) → outer fires", (assert) => {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  const input = document.createElement("input");
  const outerButton = document.createElement("button");
  inner.appendChild(input);
  outer.appendChild(inner);
  outer.appendChild(outerButton);
  document.body.appendChild(outer);

  let untargetedFired = false;
  let outerFired = false;
  let innerFired = false;

  manager.register("Escape", () => {
    untargetedFired = true;
  });
  manager.register(
    "Escape",
    () => {
      outerFired = true;
    },
    { target: outer, stopPropagation: true },
  );
  manager.register(
    "Escape",
    () => {
      innerFired = true;
    },
    { target: inner, stopPropagation: true },
  );

  // Fire from sibling inside outer but outside inner
  fireKeyOn(outerButton, "Escape");

  assert.ok(outerFired, "Outer target fired");
  assert.notOk(innerFired, "Inner target did NOT fire (event outside inner)");
  assert.notOk(untargetedFired, "Untargeted did NOT fire (stopPropagation)");

  outer.remove();
});

QUnit.test("Three-tier: focus outside all targets → untargeted fires", (assert) => {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  const outside = document.createElement("div");
  outer.appendChild(inner);
  document.body.appendChild(outer);
  document.body.appendChild(outside);

  let untargetedFired = false;
  let outerFired = false;
  let innerFired = false;

  manager.register("Escape", () => {
    untargetedFired = true;
  });
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

  fireKeyOn(outside, "Escape");

  assert.ok(untargetedFired, "Untargeted fallback fired");
  assert.notOk(outerFired, "Outer target did NOT fire");
  assert.notOk(innerFired, "Inner target did NOT fire");

  outer.remove();
  outside.remove();
});

// ──────────────────────────────────────────────
// Focus transitions — repeated Escape scenarios
// ──────────────────────────────────────────────

QUnit.test("Repeated Escape: first fires inner, focus leaves to non-target → second fires untargeted", (assert) => {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  const input = document.createElement("input");
  const outside = document.createElement("input");
  inner.appendChild(input);
  outer.appendChild(inner);
  document.body.appendChild(outer);
  document.body.appendChild(outside);

  let innerCount = 0;
  let outerCount = 0;
  let untargetedCount = 0;

  manager.register("Escape", () => {
    untargetedCount++;
  });
  manager.register(
    "Escape",
    () => {
      outerCount++;
    },
    { target: outer, stopPropagation: true },
  );
  manager.register(
    "Escape",
    () => {
      innerCount++;
    },
    { target: inner, stopPropagation: true },
  );

  // First Escape — event originates inside inner target
  fireKeyOn(input, "Escape");
  assert.strictEqual(innerCount, 1, "First Escape: inner target fired");
  assert.strictEqual(outerCount, 0, "First Escape: outer did not fire");
  assert.strictEqual(untargetedCount, 0, "First Escape: untargeted did not fire");

  // Simulate focus leaving to element outside all targets (like sap.m.Input blur)
  outside.focus();

  // Second Escape — from outside element
  fireKeyOn(outside, "Escape");
  assert.strictEqual(innerCount, 1, "Second Escape: inner did NOT fire again");
  assert.strictEqual(outerCount, 0, "Second Escape: outer did not fire");
  assert.strictEqual(untargetedCount, 1, "Second Escape: untargeted fallback fired");

  outer.remove();
  outside.remove();
});

QUnit.test("Repeated Escape: first fires inner, focus moves to outer area → second fires outer", (assert) => {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  const input = document.createElement("input");
  const outerButton = document.createElement("button");
  inner.appendChild(input);
  outer.appendChild(inner);
  outer.appendChild(outerButton);
  document.body.appendChild(outer);

  let innerCount = 0;
  let outerCount = 0;
  let untargetedCount = 0;

  manager.register("Escape", () => {
    untargetedCount++;
  });
  manager.register(
    "Escape",
    () => {
      outerCount++;
    },
    { target: outer, stopPropagation: true },
  );
  manager.register(
    "Escape",
    () => {
      innerCount++;
    },
    { target: inner, stopPropagation: true },
  );

  // First Escape — from inner target
  fireKeyOn(input, "Escape");
  assert.strictEqual(innerCount, 1, "First Escape: inner target fired");

  // Focus moves to sibling inside outer
  outerButton.focus();

  // Second Escape — from outer target area
  fireKeyOn(outerButton, "Escape");
  assert.strictEqual(innerCount, 1, "Second Escape: inner did NOT fire");
  assert.strictEqual(outerCount, 1, "Second Escape: outer target fired");
  assert.strictEqual(untargetedCount, 0, "Second Escape: untargeted did not fire (outer stopPropagation)");

  outer.remove();
});

// ──────────────────────────────────────────────
// activeElement path ordering (innermost-wins on untargeted dispatch)
// ──────────────────────────────────────────────

QUnit.test("activeElement in inner target wins over outer target on untargeted dispatch", (assert) => {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  const input = document.createElement("input");
  inner.appendChild(input);
  outer.appendChild(inner);
  document.body.appendChild(outer);

  let innerFired = false;
  let outerFired = false;

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

  // Focus the input inside the inner target
  input.focus();

  // Dispatch on document — activeElement augmentation must place inner
  // ancestry before outer/root entries to preserve innermost-wins.
  fireKey("Escape");

  assert.ok(innerFired, "Inner target fires (innermost-wins via activeElement augmentation)");
  assert.notOk(outerFired, "Outer target does NOT fire");

  outer.remove();
});

// ──────────────────────────────────────────────
// Stale-ref + direct merge during rerender
// ──────────────────────────────────────────────

QUnit.test("Stale-ref registration found via id merge when fresh-ref has different key", (assert) => {
  // Simulate rerender: register Escape on the old node, replace the node,
  // register F5 on the new node. Pressing Escape on the new node must
  // still find the stale-ref registration via the id-based index merge.
  const container = document.createElement("div");
  document.body.appendChild(container);

  const oldTarget = document.createElement("div");
  oldTarget.id = "rerenderTarget";
  container.appendChild(oldTarget);

  let escapeFired = false;
  let f5Fired = false;

  // Register Escape on the old target (will become stale after rerender)
  manager.register(
    "Escape",
    () => {
      escapeFired = true;
    },
    { target: oldTarget },
  );

  // Simulate rerender: new node with the same id replaces old node
  const newTarget = document.createElement("div");
  newTarget.id = "rerenderTarget";
  container.replaceChild(newTarget, oldTarget);

  // Register F5 on the new target (direct-match entry exists for newTarget)
  manager.register(
    "F5",
    () => {
      f5Fired = true;
    },
    { target: newTarget },
  );

  // Press Escape on the new target. Without the id merge fix, the direct
  // lookup finds newTarget's F5 registration and early-returns, missing
  // the stale-ref Escape registration entirely.
  fireKeyOn(newTarget, "Escape");

  assert.ok(escapeFired, "Stale-ref Escape registration fires via id merge");
  assert.notOk(f5Fired, "Fresh-ref F5 registration does NOT fire for Escape");

  container.remove();
});

// ──────────────────────────────────────────────
// Focus fallback for Escape
// ──────────────────────────────────────────────

let clock: ReturnType<typeof sinon.useFakeTimers>;

QUnit.module("Focus fallback for Escape", {
  beforeEach() {
    clock = sinon.useFakeTimers();
    manager = HotkeyManager.getInstance();
  },
  afterEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Already destroyed
    }
    clock.restore();
  },
});

QUnit.test("Focus bounces to body, Escape still matches previous target", (assert) => {
  const target = document.createElement("div");
  const input = document.createElement("input");
  target.appendChild(input);
  document.body.appendChild(target);

  let fired = false;
  manager.register(
    "Escape",
    () => {
      fired = true;
    },
    { target },
  );

  // Focus the input (sets _lastFocusedElement = input via focusin handler)
  input.focus();

  // Blur — focus goes to body (generic root — _focusInHandler skips it)
  input.blur();

  // Fire Escape from document level — fallback should reconstruct path from _lastFocusedElement
  fireKey("Escape");

  assert.ok(fired, "Target-scoped hotkey fires via focus fallback after blur to body");

  target.remove();
});

QUnit.test("Blur-to-body fallback is one-shot for repeated Escape", (assert) => {
  const target = document.createElement("div");
  const input = document.createElement("input");
  target.appendChild(input);
  document.body.appendChild(target);

  let targetCount = 0;
  let untargetedCount = 0;

  manager.register("Escape", () => {
    untargetedCount++;
  });
  manager.register(
    "Escape",
    () => {
      targetCount++;
    },
    { target, stopPropagation: true },
  );

  input.focus();
  input.blur();

  fireKey("Escape");
  assert.strictEqual(targetCount, 1, "First Escape uses blur fallback target handler");
  assert.strictEqual(untargetedCount, 0, "First Escape does not reach untargeted handler");

  fireKey("Escape");

  assert.strictEqual(targetCount, 1, "First Escape uses blur fallback, second does not");
  assert.strictEqual(untargetedCount, 1, "Second Escape falls back to untargeted handler");

  target.remove();
});

QUnit.test("Focus moves to real non-target element — old target does NOT fire", (assert) => {
  const target = document.createElement("div");
  const input = document.createElement("input");
  const outside = document.createElement("input");
  target.appendChild(input);
  document.body.appendChild(target);
  document.body.appendChild(outside);

  let targetFired = false;
  let untargetedFired = false;

  manager.register("Escape", () => {
    untargetedFired = true;
  });
  manager.register(
    "Escape",
    () => {
      targetFired = true;
    },
    { target },
  );

  // Focus the input (sets _lastFocusedElement = input)
  input.focus();

  // Focus moves to a REAL element outside the target (not a generic root)
  // _lastFocusedElement updates to 'outside'
  outside.focus();

  // Fire Escape on the outside element — target should NOT match
  fireKeyOn(outside, "Escape");

  assert.notOk(targetFired, "Target-scoped hotkey does NOT fire (focus genuinely moved away)");
  assert.ok(untargetedFired, "Untargeted fallback fires instead");

  target.remove();
  outside.remove();
});

QUnit.test(`Fallback expires after TTL (${FOCUS_PATH_FALLBACK_TTL_MS} ms)`, (assert) => {
  const target = document.createElement("div");
  const input = document.createElement("input");
  target.appendChild(input);
  document.body.appendChild(target);

  let targetFired = false;
  let untargetedFired = false;

  manager.register("Escape", () => {
    untargetedFired = true;
  });
  manager.register(
    "Escape",
    () => {
      targetFired = true;
    },
    { target },
  );

  // Focus and blur within TTL — fallback would normally work
  input.focus();
  input.blur();

  // Advance time past the TTL
  clock.tick(FOCUS_PATH_FALLBACK_TTL_MS + 100);

  fireKey("Escape");

  assert.notOk(targetFired, "Target-scoped hotkey does NOT fire after TTL expiry");
  assert.ok(untargetedFired, "Untargeted handler fires instead");

  target.remove();
});

QUnit.test("Fallback does NOT activate for non-Escape keys", (assert) => {
  const target = document.createElement("div");
  const input = document.createElement("input");
  target.appendChild(input);
  document.body.appendChild(target);

  let targetFired = false;
  let untargetedFired = false;

  manager.register("F5", () => {
    untargetedFired = true;
  });
  manager.register(
    "F5",
    () => {
      targetFired = true;
    },
    { target },
  );

  // Same setup as the blur-to-body test, but with F5 instead of Escape
  input.focus();
  input.blur();

  fireKey("F5");

  assert.notOk(targetFired, "Target-scoped hotkey does NOT fire for non-Escape via focus fallback");
  assert.ok(untargetedFired, "Untargeted handler fires for F5");

  target.remove();
});

// ──────────────────────────────────────────────
// Generic root ID API
// ──────────────────────────────────────────────

QUnit.module("Generic root ID API", {
  beforeEach() {
    clock = sinon.useFakeTimers();
    manager = HotkeyManager.getInstance();
  },
  afterEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Already destroyed
    }
    clock.restore();
  },
});

QUnit.test("addGenericRootId makes element act as generic root for focus fallback", (assert) => {
  // Create a custom container that acts as a generic root (e.g. a shell container)
  const shell = document.createElement("div");
  shell.id = "myShellRoot";
  document.body.appendChild(shell);

  const target = document.createElement("div");
  const input = document.createElement("input");
  target.appendChild(input);
  shell.appendChild(target);

  let targetFired = false;
  manager.register(
    "Escape",
    () => {
      targetFired = true;
    },
    { target },
  );

  // Register the shell as a generic root
  manager.addGenericRootId("myShellRoot");

  // Make shell focusable so shell.focus() actually moves focus there
  shell.tabIndex = -1;

  // Focus input, then blur to the shell (now a generic root)
  input.focus();
  input.blur();
  shell.focus();

  // Fire Escape on the shell — fallback should reconstruct path from last focused element
  fireKeyOn(shell, "Escape");

  assert.ok(targetFired, "Target-scoped hotkey fires because shell is treated as generic root");

  target.remove();
  shell.remove();
});

QUnit.test("removeGenericRootId restores normal behavior for element", (assert) => {
  const container = document.createElement("div");
  container.id = "tempRoot";
  container.tabIndex = 0;
  document.body.appendChild(container);

  const target = document.createElement("div");
  const input = document.createElement("input");
  target.appendChild(input);
  container.appendChild(target);

  let targetFired = false;
  let untargetedFired = false;

  manager.register("Escape", () => {
    untargetedFired = true;
  });
  manager.register(
    "Escape",
    () => {
      targetFired = true;
    },
    { target },
  );

  // Register then remove as generic root
  manager.addGenericRootId("tempRoot");
  manager.removeGenericRootId("tempRoot");

  // Focus input then blur to the container (no longer generic root)
  input.focus();
  container.focus();

  // Container is a real element now — fallback should NOT activate
  fireKeyOn(container, "Escape");

  assert.notOk(targetFired, "Target-scoped hotkey does NOT fire after removeGenericRootId");
  assert.ok(untargetedFired, "Untargeted handler fires instead");

  target.remove();
  container.remove();
});

// ──────────────────────────────────────────────
// Disconnected activeElement guard
// ──────────────────────────────────────────────

QUnit.test("Disconnected activeElement does not augment path", (assert) => {
  const target = document.createElement("div");
  target.tabIndex = 0;
  document.body.appendChild(target);

  let fired = false;
  manager.register(
    "F5",
    () => {
      fired = true;
    },
    { target },
  );

  // Focus the element, then detach it from the DOM.
  // document.activeElement may still reference the detached element.
  target.focus();
  target.remove();

  fireKey("F5");
  assert.notOk(fired, "Hotkey does NOT fire when activeElement is disconnected from DOM");
});

// ──────────────────────────────────────────────
// Rapid Escape one-shot guard
// ──────────────────────────────────────────────

QUnit.test("Rapid Escape within TTL fires target handler only once (one-shot)", (assert) => {
  const target = document.createElement("div");
  const input = document.createElement("input");
  target.appendChild(input);
  document.body.appendChild(target);

  let callCount = 0;
  manager.register(
    "Escape",
    () => {
      callCount++;
    },
    { target, stopPropagation: false },
  );

  // Focus input inside target, then blur to body
  input.focus();
  input.blur();

  // First Escape — fires via focus fallback, consuming _blurSeq
  fireKey("Escape");
  assert.strictEqual(callCount, 1, "First Escape fires via focus fallback");

  // Second Escape immediately — hasUnconsumedBlur is false, fallback not used
  fireKey("Escape");
  assert.strictEqual(callCount, 1, "Second Escape does NOT fire — one-shot consumed");

  target.remove();
});

// ──────────────────────────────────────────────
// targetIdIndex merge dedup
// ──────────────────────────────────────────────

QUnit.test("targetIdIndex: replacing element with same id fires exactly once", (assert) => {
  const original = document.createElement("div");
  original.id = "merge-dedup-test";
  original.tabIndex = 0;
  document.body.appendChild(original);

  let callCount = 0;
  manager.register(
    "F7",
    () => {
      callCount++;
    },
    { target: original },
  );

  // Remove original, insert a new element with the same id
  original.remove();
  const replacement = document.createElement("div");
  replacement.id = "merge-dedup-test";
  replacement.tabIndex = 0;
  document.body.appendChild(replacement);

  // Focus the replacement and fire key — Set dedup prevents double-fire
  replacement.focus();
  fireKeyOn(replacement, "F7");

  assert.strictEqual(callCount, 1, "Fires exactly once despite element replacement with same id");

  replacement.remove();
});

// ──────────────────────────────────────────────
// Shadow DOM target matching
// ──────────────────────────────────────────────

QUnit.module("Shadow DOM target matching", {
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

QUnit.test("activeElement inside shadow DOM matches host-level target", (assert) => {
  // Create a host element with a shadow root containing an input
  const host = document.createElement("div");
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const shadowInput = document.createElement("input");
  shadow.appendChild(shadowInput);

  let fired = false;
  manager.register(
    "Escape",
    () => {
      fired = true;
    },
    { target: host },
  );

  // Focus the shadow input. document.activeElement is the host (browser
  // retargets across shadow boundaries), but the activeElement-augmentation
  // path still includes the host, which matches the target registration.
  shadowInput.focus();

  // Dispatch on the host (how the browser surfaces the event outside the
  // shadow boundary). composedPath includes [host, body, ...].
  fireKeyOn(host, "Escape");

  assert.ok(fired, "Target-scoped hotkey fires when focus is inside shadow DOM of target host");

  host.remove();
});

QUnit.test("nested shadow DOM: target on outer host matches when focus is two shadow roots deep", (assert) => {
  // outer host > shadow root > inner host > shadow root > input
  const outerHost = document.createElement("div");
  document.body.appendChild(outerHost);

  const outerShadow = outerHost.attachShadow({ mode: "open" });
  const innerHost = document.createElement("div");
  outerShadow.appendChild(innerHost);

  const innerShadow = innerHost.attachShadow({ mode: "open" });
  const deepInput = document.createElement("input");
  innerShadow.appendChild(deepInput);

  let fired = false;
  manager.register(
    "Escape",
    () => {
      fired = true;
    },
    { target: outerHost },
  );

  // Focus the deeply nested input. The activeElement-augmentation path
  // traverses both shadow boundaries via getRootNode().host, ultimately
  // reaching the outer host which matches the target registration.
  deepInput.focus();
  fireKeyOn(outerHost, "Escape");

  assert.ok(fired, "Target-scoped hotkey fires when focus is two shadow roots deep inside target host");

  outerHost.remove();
});

// ──────────────────────────────────────────────
// ActiveElement augmentation (non-Escape)
// ──────────────────────────────────────────────

QUnit.module("ActiveElement path augmentation", {
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

QUnit.test("Non-Escape key: activeElement inside target matches via augmentation (not focus fallback)", (assert) => {
  // Uses F5 (not Escape) to ensure only the activeElement augmentation path
  // is exercised — the focus fallback gates on event.key === "Escape".
  const target = document.createElement("div");
  const input = document.createElement("input");
  target.appendChild(input);
  document.body.appendChild(target);

  let targetFired = false;
  let untargetedFired = false;

  manager.register("F5", () => {
    untargetedFired = true;
  });
  manager.register(
    "F5",
    () => {
      targetFired = true;
    },
    { target, stopPropagation: true },
  );

  // Focus the input (activeElement = input, inside target)
  input.focus();

  // Dispatch from document — composedPath is [document, window] but
  // activeElement is still the input inside target.
  fireKey("F5");

  assert.ok(targetFired, "Target-scoped F5 fires via activeElement augmentation");
  assert.notOk(untargetedFired, "Untargeted F5 suppressed by stopPropagation");

  target.remove();
});

// ──────────────────────────────────────────────
// data-sap-ui-area generic root detection
// ──────────────────────────────────────────────

QUnit.module("UIArea generic root detection", {
  beforeEach() {
    clock = sinon.useFakeTimers();
    manager = HotkeyManager.getInstance();
  },
  afterEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Already destroyed
    }
    clock.restore();
  },
});

QUnit.test("Element with data-sap-ui-area is treated as generic root for focus fallback", (assert) => {
  // Simulate a UI5 UIArea root node
  const uiArea = document.createElement("div");
  uiArea.setAttribute("data-sap-ui-area", "");
  uiArea.id = "uiAreaRoot";
  document.body.appendChild(uiArea);

  const target = document.createElement("div");
  const input = document.createElement("input");
  target.appendChild(input);
  uiArea.appendChild(target);

  let targetFired = false;
  manager.register(
    "Escape",
    () => {
      targetFired = true;
    },
    { target },
  );

  // Focus input, then blur — focus bounces to UIArea root
  input.focus();
  input.blur();

  // Fire Escape on the UIArea root — should trigger focus fallback because
  // data-sap-ui-area marks it as a generic root node.
  fireKeyOn(uiArea, "Escape");

  assert.ok(targetFired, "Target-scoped Escape fires via focus fallback when event target is a UIArea root");

  target.remove();
  uiArea.remove();
});
