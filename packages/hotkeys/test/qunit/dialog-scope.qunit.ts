import { hasOpenPopup } from "ui5/hotkeys/internal/runtime";
import { createHotkeyManager, destroyHotkeyManager, fireKey } from "./test-helpers";

QUnit.module("Dialog & Fragment Scopes", {
  beforeEach() {
    destroyHotkeyManager();
  },
  afterEach() {
    destroyHotkeyManager();
  },
});

QUnit.test("Nested dialog scopes", (assert) => {
  const manager = createHotkeyManager();
  let dialog1Called = false;
  let dialog2Called = false;

  manager.register(
    "Escape",
    () => {
      dialog1Called = true;
    },
    { scope: "dialog1" },
  );
  manager.register(
    "Escape",
    () => {
      dialog2Called = true;
    },
    { scope: "dialog2" },
  );

  // Push nested dialogs
  manager.pushScope("dialog1");
  manager.pushScope("dialog2");
  assert.strictEqual(manager.getActiveScope(), "dialog2");

  fireKey("Escape");
  assert.ok(dialog2Called, "Inner dialog Escape fires");
  assert.notOk(dialog1Called, "Outer dialog Escape does not fire");

  // Pop inner dialog
  dialog2Called = false;
  manager.popScope("dialog2");
  fireKey("Escape");
  assert.ok(dialog1Called, "Outer dialog Escape fires after inner popped");
  assert.notOk(dialog2Called, "Inner dialog Escape does not fire after pop");
});

QUnit.test("Dialog scope with global fallthrough", (assert) => {
  const manager = createHotkeyManager();
  let globalCtrlSCalled = false;

  // Global Ctrl+S - no dialog-scoped version
  manager.register("Ctrl+S", () => {
    globalCtrlSCalled = true;
  });

  // Push dialog scope - no Ctrl+S registered there
  manager.pushScope("myDialog");
  fireKey("s", { ctrlKey: true });
  assert.ok(globalCtrlSCalled, "Global Ctrl+S fires as fallthrough when no dialog-scoped match");
});

QUnit.test("hasOpenPopup reports false when no UI5 popup is open", (assert) => {
  // Exercises the real probe (not the InstanceManager stub other tests install):
  // it reads sap.m.InstanceManager on each call and reports false when nothing is open.
  assert.notOk(hasOpenPopup(), "No dialog or popover open");
});
