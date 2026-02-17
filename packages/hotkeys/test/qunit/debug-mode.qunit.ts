import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { fireKey } from "./test-helpers";

QUnit.module("Debug Mode", {
  beforeEach() {
    const existing = HotkeyManager.getInstance();
    existing.destroy();
  },
  afterEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Already destroyed
    }
  },
});

QUnit.test("Debug mode is off by default", (assert) => {
  const manager = HotkeyManager.getInstance();
  assert.notOk(manager.isDebugMode(), "Debug mode is false by default");
});

QUnit.test("setDebugMode / isDebugMode round-trip", (assert) => {
  const manager = HotkeyManager.getInstance();

  manager.setDebugMode(true);
  assert.ok(manager.isDebugMode(), "Debug mode is true after enabling");

  manager.setDebugMode(false);
  assert.notOk(manager.isDebugMode(), "Debug mode is false after disabling");
});

QUnit.test("Debug mode survives across keypresses", (assert) => {
  const manager = HotkeyManager.getInstance();
  let count = 0;

  manager.register("Escape", () => {
    count++;
  });

  manager.setDebugMode(true);

  fireKey("Escape");
  fireKey("Escape");
  // ignoreRepeat is true by default but these are separate events (not repeat)
  assert.strictEqual(count, 2, "Both presses handled");
  assert.ok(manager.isDebugMode(), "Debug mode still enabled after keypresses");
});

QUnit.test("Disabling debug mode stops debug logging", (assert) => {
  const manager = HotkeyManager.getInstance();
  let count = 0;

  manager.register("Escape", () => {
    count++;
  });

  manager.setDebugMode(true);
  manager.setDebugMode(false);

  fireKey("Escape");
  assert.strictEqual(count, 1, "Hotkey still fires with debug off");
  assert.notOk(manager.isDebugMode(), "Debug mode is off");
});

QUnit.test("Debug mode does not interfere with dispatch", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  manager.register(
    "Ctrl+S",
    () => {
      called = true;
    },
    { description: "Save" },
  );

  manager.setDebugMode(true);
  fireKey("s", { ctrlKey: true });
  assert.ok(called, "Ctrl+S fires normally with debug mode on");
});
