import KeyStateTracker from "ui5/hotkeys/KeyStateTracker";
import { Platform } from "ui5/hotkeys/library";
import { runtimeHooks } from "ui5/hotkeys/internal/runtime";
import { createHotkeyManager, destroyHotkeyManager, fireBlur, fireKey, fireKeyUp } from "./test-helpers";

const sandbox = sinon.createSandbox();

QUnit.module("KeyStateTracker", {
  beforeEach() {
    destroyHotkeyManager();
  },
  afterEach() {
    sandbox.restore();
    destroyHotkeyManager();
  },
});

QUnit.test("getKeyStateTracker returns same instance", (assert) => {
  const manager = createHotkeyManager();
  const a = manager.getKeyStateTracker();
  const b = manager.getKeyStateTracker();
  assert.strictEqual(a, b, "Same instance returned");
});

QUnit.test("Keydown adds key, keyup removes key", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker();

  fireKey("a");
  assert.ok(tracker.isKeyHeld("a"), "Key 'a' is held after keydown");

  fireKeyUp("a");
  assert.notOk(tracker.isKeyHeld("a"), "Key 'a' released after keyup");
});

QUnit.test("isKeyHeld returns correct state", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker();

  assert.notOk(tracker.isKeyHeld("Control"), "Control not held initially");

  fireKey("Control", { ctrlKey: true });
  assert.ok(tracker.isKeyHeld("Control"), "Control held after keydown");

  fireKeyUp("Control");
  assert.notOk(tracker.isKeyHeld("Control"), "Control released after keyup");
});

QUnit.test("getHeldKeys returns snapshot", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker();

  fireKey("a");
  fireKey("b");

  const held = tracker.getHeldKeys();
  assert.ok(held.includes("a"), "Snapshot includes 'a'");
  assert.ok(held.includes("b"), "Snapshot includes 'b'");
  assert.strictEqual(held.length, 2, "Two keys held");

  fireKeyUp("a");
  const held2 = tracker.getHeldKeys();
  assert.strictEqual(held2.length, 1, "One key held after release");
  assert.ok(held2.includes("b"), "Only 'b' remains");
});

QUnit.test("Change callback fires on key changes", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker();
  const changes: string[][] = [];

  tracker.setChangeCallback((keys) => {
    changes.push([...keys]);
  });

  fireKey("a");
  fireKey("b");
  fireKeyUp("a");

  assert.strictEqual(changes.length, 3, "Three changes recorded");
  assert.deepEqual(changes[0], ["a"], "First change: a pressed");
  assert.deepEqual(changes[1], ["a", "b"], "Second change: b pressed");
  assert.deepEqual(changes[2], ["b"], "Third change: a released");
});

QUnit.test("Blur clears all held keys", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker();

  fireKey("a");
  fireKey("Control", { ctrlKey: true });
  assert.strictEqual(tracker.getHeldKeys().length, 2, "Two keys held");

  fireBlur();
  assert.strictEqual(tracker.getHeldKeys().length, 0, "All keys cleared after blur");
});

QUnit.test("macOS modifier-release clears non-modifier keys", (assert) => {
  sandbox.stub(runtimeHooks, "detectPlatform").returns(Platform.Mac);
  const manager = createHotkeyManager();
  const tracker = manager.getKeyStateTracker();

  fireKey("Meta", { metaKey: true });
  fireKey("Tab");

  assert.ok(tracker.isKeyHeld("Meta"), "Meta held");
  assert.ok(tracker.isKeyHeld("Tab"), "Tab held");

  // Release Meta - should clear Tab too (macOS Cmd+Tab fix)
  fireKeyUp("Meta");

  assert.notOk(tracker.isKeyHeld("Meta"), "Meta released");
  assert.notOk(tracker.isKeyHeld("Tab"), "Tab cleared by modifier-release fix");
});

QUnit.test("Destroy cleans up and allows fresh instance", (assert) => {
  const manager = createHotkeyManager();
  const tracker = manager.getKeyStateTracker();

  fireKey("a");
  assert.ok(tracker.isKeyHeld("a"), "Key held before destroy");

  manager.destroy();

  // New instance should have fresh tracker
  const newManager = createHotkeyManager();
  const newTracker = newManager.getKeyStateTracker();
  assert.strictEqual(newTracker.getHeldKeys().length, 0, "New instance has no held keys");

  // Old events should not affect new instance
  fireKey("b");
  assert.ok(newTracker.isKeyHeld("b"), "New instance tracks new keys");
});

// ──────────────────────────────────────────────
// Edge cases (C12)
// ──────────────────────────────────────────────

QUnit.test("setChangeCallback(null) removes callback", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker();
  let callCount = 0;

  tracker.setChangeCallback(() => {
    callCount++;
  });

  fireKey("a");
  assert.strictEqual(callCount, 1, "Callback fired once");

  tracker.setChangeCallback(null);
  fireKey("b");
  assert.strictEqual(callCount, 1, "Callback not fired after setting to null");
});

QUnit.test("Change callback errors are isolated", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker();
  let safeCallbackCalls = 0;

  tracker.setChangeCallback(() => {
    throw new Error("intentional callback failure");
  });

  assert.ok(true, "Setup complete");
  fireKey("a");

  tracker.setChangeCallback(() => {
    safeCallbackCalls++;
  });
  fireKey("b");

  assert.strictEqual(safeCallbackCalls, 1, "Tracker remains operational after callback error");
});

QUnit.test("Repeated keydown does not duplicate held set", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker();

  fireKey("a");
  fireKey("a"); // Same key again
  fireKey("a"); // And again

  const held = tracker.getHeldKeys();
  assert.strictEqual(held.length, 1, "Only one entry for repeated key");
  assert.ok(held.includes("a"), "Key 'a' is held");
});

QUnit.test("Keyup removes held key by code when key value changed", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker();

  fireKey("A", { code: "KeyA", shiftKey: true });
  assert.ok(tracker.isKeyHeld("A"), "Uppercase key is tracked while Shift is held");

  fireKeyUp("a", { code: "KeyA" });
  assert.notOk(tracker.isKeyHeld("A"), "Held key is cleared using physical key code");
  assert.strictEqual(tracker.getHeldKeys().length, 0, "No held keys remain");
});

QUnit.test("Direct instantiation throws without INTERNAL_TOKEN", (assert) => {
  assert.throws(
    () => {
      // eslint-disable-next-line no-new -- assert.throws requires the side effect
      new KeyStateTracker(Platform.Windows, Symbol() as never);
    },
    /cannot be instantiated directly/i,
    "Direct construction is blocked",
  );
});
