import KeyStateTracker from "ui5/hotkeys/KeyStateTracker";
import { Platform } from "ui5/hotkeys/library";
import {
  createHotkeyManager,
  destroyHotkeyManager,
  fireBlur,
  fireKey,
  fireKeyUp,
  trustedKeyEvent,
} from "./test-helpers";

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

QUnit.test("A trusted key event releases held modifiers its flags report as up", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker() as KeyStateTracker;

  fireKey("Control", { ctrlKey: true, code: "ControlLeft" });
  fireKey("Alt", { altKey: true, code: "AltRight" });
  fireKey("Shift", { shiftKey: true, code: "ShiftLeft" });
  fireKey("Meta", { metaKey: true, code: "MetaLeft" });

  // AltGraph still reports down: the right Alt stays held.
  tracker.processKeyDown(trustedKeyEvent("a", { code: "KeyA", ctrlKey: true, shiftKey: true, altGraph: true }));
  assert.ok(tracker.isCodeHeld("AltRight"), "AltRight kept while AltGraph is down");
  assert.notOk(tracker.isCodeHeld("MetaLeft"), "MetaLeft released: metaKey is false");

  tracker.processKeyUp(trustedKeyEvent("a", { code: "KeyA", ctrlKey: true }));
  assert.notOk(tracker.isCodeHeld("AltRight"), "AltRight released: neither altKey nor AltGraph");
  assert.notOk(tracker.isKeyHeld("Alt"), "Alt no longer reported as held");
  assert.notOk(tracker.isCodeHeld("ShiftLeft"), "ShiftLeft released: shiftKey is false");
  assert.ok(tracker.isCodeHeld("ControlLeft"), "ControlLeft kept: ctrlKey is true");
  assert.deepEqual(tracker.getHeldKeys(), ["Control"], "Only Control remains held");
});

QUnit.test("A trusted modifier keyup releases it and stuck keys in one change on macOS", (assert) => {
  const tracker = createHotkeyManager(Platform.Mac).getKeyStateTracker() as KeyStateTracker;
  const changes: string[][] = [];

  fireKey("Meta", { metaKey: true, code: "MetaLeft" });
  fireKey("Tab", { metaKey: true, code: "Tab" });
  tracker.setChangeCallback((keys) => changes.push([...keys]));

  tracker.processKeyUp(trustedKeyEvent("Meta", { code: "MetaLeft" }));
  assert.deepEqual(changes, [[]], "One change releases Meta and the stuck Tab together");
});

QUnit.test("Synthetic key events do not release held modifiers", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker() as KeyStateTracker;

  fireKey("Alt", { altKey: true, code: "AltRight" });
  fireKey("a", { code: "KeyA" });
  assert.ok(tracker.isCodeHeld("AltRight"), "Untrusted keydown without altKey keeps AltRight held");
});

QUnit.test("Hiding the document clears all held keys", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker() as KeyStateTracker;
  let visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });

  try {
    fireKey("a");
    fireKey("Alt", { altKey: true, code: "AltRight" });

    document.dispatchEvent(new Event("visibilitychange"));
    assert.strictEqual(tracker.getHeldKeys().length, 2, "A visible visibilitychange keeps held keys");

    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    assert.strictEqual(tracker.getHeldKeys().length, 0, "All keys cleared once hidden");
    assert.notOk(tracker.isCodeHeld("AltRight"), "AltRight cleared once hidden");
  } finally {
    delete (document as unknown as Record<string, unknown>).visibilityState;
  }
});

QUnit.test("macOS modifier-release clears non-modifier keys", (assert) => {
  const manager = createHotkeyManager(Platform.Mac);
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

QUnit.test("Destroy clears held keys and stops tracking", (assert) => {
  const manager = createHotkeyManager();
  const tracker = manager.getKeyStateTracker();

  fireKey("a");
  assert.ok(tracker.isKeyHeld("a"), "Key held before destroy");

  manager.destroy();
  assert.strictEqual(tracker.getHeldKeys().length, 0, "Held keys cleared by destroy");

  fireKey("b");
  assert.strictEqual(tracker.getHeldKeys().length, 0, "Destroyed tracker ignores later keydowns");
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

QUnit.test("Held keys keep first-press order across overlapping presses and releases", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker();
  const changes: string[][] = [];
  tracker.setChangeCallback((keys) => changes.push([...keys]));

  fireKey("Shift", { code: "ShiftLeft", shiftKey: true });
  fireKey("A", { code: "KeyA", shiftKey: true });
  fireKey("b", { code: "KeyB", shiftKey: true });
  fireKey("Shift", { code: "ShiftRight", shiftKey: true }); // second Shift: count 2, no change
  fireKey("A", { code: "KeyA", shiftKey: true, repeat: true }); // auto-repeat: no change
  fireKeyUp("Shift", { code: "ShiftLeft", shiftKey: true }); // count 1, still held
  fireKeyUp("a", { code: "KeyA" });
  fireKey("a", { code: "KeyA" });
  fireKeyUp("Shift", { code: "ShiftRight" });
  fireKey("Shift", { code: "ShiftLeft", shiftKey: true });

  assert.deepEqual(
    changes,
    [
      ["Shift"],
      ["Shift", "A"],
      ["Shift", "A", "b"],
      ["Shift", "b"],
      ["Shift", "b", "a"],
      ["b", "a"],
      ["b", "a", "Shift"],
    ],
    "Each change reports keys in first-press order; releases and re-presses move only the affected key",
  );
  assert.deepEqual(tracker.getHeldKeys(), ["b", "a", "Shift"], "getHeldKeys matches the last change");
  assert.ok(tracker.isKeyHeld("Shift"), "Re-pressed Shift is held");
  assert.notOk(tracker.isKeyHeld("A"), "Released shifted key is not held");
});

QUnit.test("Keyup removes held key by code when key value changed", (assert) => {
  const tracker = createHotkeyManager().getKeyStateTracker();

  // "!" and "1" are not case variants of each other, so only the code can pair them.
  fireKey("!", { code: "Digit1", shiftKey: true });
  assert.ok(tracker.isKeyHeld("!"), "Shifted symbol is tracked while Shift is held");

  fireKeyUp("1", { code: "Digit1" });
  assert.notOk(tracker.isKeyHeld("!"), "Held key is cleared using physical key code");
  assert.strictEqual(tracker.getHeldKeys().length, 0, "No held keys remain");
});

QUnit.test("Direct instantiation throws without INTERNAL_TOKEN", (assert) => {
  assert.throws(
    () => {
      // oxlint-disable-next-line no-new -- assert.throws requires the side effect
      new KeyStateTracker(Platform.Windows, Symbol() as never);
    },
    /cannot be instantiated directly/i,
    "Direct construction is blocked",
  );
});
