import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { fireKey } from "./test-helpers";

QUnit.module("Dialog & Fragment Scopes", {
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

QUnit.test("Dialog scope push/pop with same hotkey", (assert) => {
  const manager = HotkeyManager.getInstance();
  let globalEscapeCalled = false;
  let dialogEscapeCalled = false;

  manager.register("Escape", () => {
    globalEscapeCalled = true;
  });
  manager.register(
    "Escape",
    () => {
      dialogEscapeCalled = true;
    },
    { scope: "dialog" },
  );

  // Push dialog scope — dialog Escape should take priority
  manager.pushScope("dialog");
  fireKey("Escape");
  assert.ok(dialogEscapeCalled, "Dialog-scoped Escape fired");
  assert.notOk(globalEscapeCalled, "Global Escape suppressed by dialog scope");

  // Pop dialog scope — global Escape should fire again
  dialogEscapeCalled = false;
  manager.popScope("dialog");
  fireKey("Escape");
  assert.ok(globalEscapeCalled, "Global Escape fires after dialog scope popped");
  assert.notOk(dialogEscapeCalled, "Dialog Escape does not fire after pop");
});

QUnit.test("Same hotkey in view vs dialog scope", (assert) => {
  const manager = HotkeyManager.getInstance();
  let mainSaveCalled = false;
  let dialogSaveCalled = false;

  manager.register(
    "Ctrl+S",
    () => {
      mainSaveCalled = true;
    },
    { scope: "main" },
  );
  manager.register(
    "Ctrl+S",
    () => {
      dialogSaveCalled = true;
    },
    { scope: "confirmDialog" },
  );

  // Push main (view) scope, then dialog scope on top
  manager.pushScope("main");
  manager.pushScope("confirmDialog");

  fireKey("s", { ctrlKey: true });
  assert.ok(dialogSaveCalled, "Ctrl+S fires in dialog scope (top of stack)");
  assert.notOk(mainSaveCalled, "Ctrl+S does not fire in view scope (shadowed)");
});

QUnit.test("suppressInPopups with mocked _hasOpenPopup", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  manager.register(
    "Ctrl+S",
    () => {
      called = true;
    },
    { suppressInPopups: true },
  );

  // Mock popup as open
  (manager as any)._hasOpenPopup = () => true;
  fireKey("s", { ctrlKey: true });
  assert.notOk(called, "Ctrl+S suppressed when popup is open");

  // Close popup
  (manager as any)._hasOpenPopup = () => false;
  fireKey("s", { ctrlKey: true });
  assert.ok(called, "Ctrl+S fires when popup is closed");
});

QUnit.test("Nested dialog scopes", (assert) => {
  const manager = HotkeyManager.getInstance();
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
  const manager = HotkeyManager.getInstance();
  let globalCtrlSCalled = false;

  // Global Ctrl+S — no dialog-scoped version
  manager.register("Ctrl+S", () => {
    globalCtrlSCalled = true;
  });

  // Push dialog scope — no Ctrl+S registered there
  manager.pushScope("myDialog");
  fireKey("s", { ctrlKey: true });
  assert.ok(globalCtrlSCalled, "Global Ctrl+S fires as fallthrough when no dialog-scoped match");
});

QUnit.test("Fragment popup lifecycle: push, register, fire, unregister, pop", (assert) => {
  const manager = HotkeyManager.getInstance();
  let fragmentCalled = false;

  // Simulate opening a fragment popup
  manager.pushScope("myFragment");

  const handle = manager.register(
    "Enter",
    () => {
      fragmentCalled = true;
    },
    { scope: "myFragment" },
  );

  fireKey("Enter");
  assert.ok(fragmentCalled, "Fragment-scoped Enter fires");

  // Simulate closing the fragment
  handle.unregister();
  manager.popScope("myFragment");

  fragmentCalled = false;
  fireKey("Enter");
  assert.notOk(fragmentCalled, "Fragment Enter does not fire after cleanup");
});
