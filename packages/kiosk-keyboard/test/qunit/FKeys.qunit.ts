import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import fkeyRow from "ui5/kiosk/layouts/fkey-row";
import Input from "sap/m/Input";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import {
  getKeyElement,
  getRequiredKeyElement,
  getRowElements,
  hasKeyClass,
  isShiftActive,
  placeAndWait,
  tapKey,
  waitForRender,
} from "./test-helpers";

const DOM = KioskKeyboard.DOM;

// Composite layout for tests that need both shift and F-key rows.
// Consumers build these inline now that pre-built combined layouts are removed.
const qwertyBase = KioskKeyboard.getRegisteredLayout("qwerty")!;

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

QUnit.module("FKeys", {
  beforeEach() {
    KioskKeyboard.resetCustomLayouts();
    KioskKeyboard.registerLayout("test-qwerty-fk", [fkeyRow, ...qwertyBase]);
  },
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// Layout registration
// ──────────────────────────────────────────────

QUnit.test("fkeys is a registered built-in layout", (assert) => {
  assert.ok(KioskKeyboard.isBuiltInLayout("fkeys"), "fkeys is built-in");

  const names = KioskKeyboard.getRegisteredLayoutNames();
  assert.ok(names.includes("fkeys"), "fkeys in registered names");
});

QUnit.test("fkey-row module exports F1-F12 key definitions", (assert) => {
  assert.strictEqual(fkeyRow.length, 12, "Row has 12 keys");
  assert.strictEqual(fkeyRow[0].value, "{fkey:F1}", "First key is F1");
  assert.strictEqual(fkeyRow[11].value, "{fkey:F12}", "Last key is F12");
  assert.strictEqual(fkeyRow[0].type, "modifier", "F-key row uses modifier key styling");
});

QUnit.test("fkeys is a secondary layout (does not become base)", (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty" });

  // Switch to fkeys - should not update the base layout
  kb.setLayout("fkeys");
  // Switch back to base - should return to qwerty, not fkeys
  kb.setLayout("qwerty");
  assert.strictEqual(kb.getLayout(), "qwerty", "Base layout preserved after fkeys switch");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Standalone fkeys layout rendering
// ──────────────────────────────────────────────

QUnit.test("Standalone fkeys layout renders 3 rows", async (assert) => {
  const kb = new KioskKeyboard({ layout: "fkeys" });
  await placeAndWait(kb);

  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 3, "fkeys layout has 3 rows");

  kb.destroy();
});

QUnit.test("Standalone fkeys layout contains F1-F12 + ABC + Enter", async (assert) => {
  const kb = new KioskKeyboard({ layout: "fkeys" });
  await placeAndWait(kb);

  // Check all F-keys are present
  for (let i = 1; i <= 12; i++) {
    const el = getKeyElement(kb, `{fkey:F${i}}`);
    assert.ok(el, `F${i} key is rendered`);
  }

  // ABC button
  const abc = getKeyElement(kb, "{layout:base}");
  assert.ok(abc, "ABC layout switch is rendered");

  // Enter button
  const enter = getKeyElement(kb, "{enter}");
  assert.ok(enter, "Enter key is rendered");

  kb.destroy();
});

// ──────────────────────────────────────────────
// F-key press events
// ──────────────────────────────────────────────

QUnit.test("F-key tap fires keyPress with correct key name", async (assert) => {
  const kb = new KioskKeyboard({ layout: "fkeys" });
  await placeAndWait(kb);

  const events: Array<{ key: string; shiftKey: boolean }> = [];
  kb.attachEvent("keyPress", (e: any) => {
    events.push({ key: e.getParameter("key"), shiftKey: e.getParameter("shiftKey") });
  });

  tapKey(kb, "{fkey:F1}");
  tapKey(kb, "{fkey:F8}");
  tapKey(kb, "{fkey:F12}");

  assert.strictEqual(events.length, 3, "Three keyPress events fired");
  assert.strictEqual(events[0].key, "F1", "First event key is F1");
  assert.strictEqual(events[1].key, "F8", "Second event key is F8");
  assert.strictEqual(events[2].key, "F12", "Third event key is F12");

  kb.destroy();
});

QUnit.test("F-key tap does NOT insert text", async (assert) => {
  const input = new Input({ value: "test" });
  const kb = new KioskKeyboard({ layout: "fkeys", targetInput: input });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  input.focus();
  await waitForRender();

  tapKey(kb, "{fkey:F1}");
  tapKey(kb, "{fkey:F5}");
  await waitForRender();

  assert.strictEqual(input.getValue(), "test", "Input value unchanged after F-key taps");

  input.destroy();
  kb.destroy();
});

QUnit.test("F-key tap does NOT auto-release shift", async (assert) => {
  const kb = new KioskKeyboard({ layout: "test-qwerty-fk" });
  await placeAndWait(kb);

  // Activate shift
  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Shift is active before F-key tap");

  tapKey(kb, "{fkey:F3}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Shift remains active after F-key tap");

  kb.destroy();
});

QUnit.test("F-key tap fires keyPress with shiftKey=true when shift active", async (assert) => {
  const kb = new KioskKeyboard({ layout: "test-qwerty-fk" });
  await placeAndWait(kb);

  let shiftKey = false;
  kb.attachEvent("keyPress", (e: any) => {
    shiftKey = e.getParameter("shiftKey");
  });

  // Activate shift
  tapKey(kb, "{shift}");
  tapKey(kb, "{fkey:F5}");

  assert.ok(shiftKey, "keyPress reports shiftKey=true");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Fn button on base layouts
// ──────────────────────────────────────────────

QUnit.test("QWERTY bottom row has Fn button that switches to fkeys", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty" });
  await placeAndWait(kb);

  const fnKey = getKeyElement(kb, "{layout:fkeys}");
  assert.ok(fnKey, "Fn button exists on qwerty layout");
  assert.strictEqual(fnKey!.textContent!.trim(), "Fn", "Fn button shows Fn label");

  // Tap Fn to switch to fkeys layout
  tapKey(kb, "{layout:fkeys}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "fkeys", "Layout switched to fkeys");

  // Verify fkeys layout is rendered
  const f1 = getKeyElement(kb, "{fkey:F1}");
  assert.ok(f1, "F1 key visible after Fn tap");

  kb.destroy();
});

QUnit.test("QWERTZ-DE bottom row has Fn button that switches to fkeys", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwertz-de" });
  await placeAndWait(kb);

  const fnKey = getKeyElement(kb, "{layout:fkeys}");
  assert.ok(fnKey, "Fn button exists on qwertz-de layout");

  tapKey(kb, "{layout:fkeys}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "fkeys", "Layout switched to fkeys");

  kb.destroy();
});

QUnit.test("ABC button on fkeys layout returns to base layout", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty" });
  await placeAndWait(kb);

  // Switch to fkeys
  tapKey(kb, "{layout:fkeys}");
  await waitForRender();
  assert.strictEqual(kb.getLayout(), "fkeys", "Switched to fkeys");

  // Tap ABC to return
  tapKey(kb, "{layout:base}");
  await waitForRender();
  assert.strictEqual(kb.getLayout(), "qwerty", "Returned to qwerty base layout");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Physical keyboard highlight mapping
// ──────────────────────────────────────────────

QUnit.test("Physical F-key highlights virtual F-key", async (assert) => {
  const input = new Input();
  const kb = new KioskKeyboard({ layout: "test-qwerty-fk", targetInput: input });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  const f5El = getRequiredKeyElement(kb, "{fkey:F5}");
  assert.ok(f5El, "F5 key exists");

  // Simulate physical keydown via the highlight delegation
  input.focus();
  const keydown = new KeyboardEvent("keydown", { key: "F5", bubbles: true });
  input.getFocusDomRef()!.dispatchEvent(keydown);
  await nextUIUpdate();

  assert.ok(hasKeyClass(kb, "{fkey:F5}", DOM.classes.keyHighlight), "F5 key highlighted on physical keydown");

  // Simulate keyup
  const keyup = new KeyboardEvent("keyup", { key: "F5", bubbles: true });
  input.getFocusDomRef()!.dispatchEvent(keyup);
  await nextUIUpdate();

  assert.notOk(hasKeyClass(kb, "{fkey:F5}", DOM.classes.keyHighlight), "F5 key unhighlighted on physical keyup");

  input.destroy();
  kb.destroy();
});

QUnit.test("Native fKeyMode dispatches keydown and runs native action", async (assert) => {
  const input = new Input();
  const kb = new KioskKeyboard({
    layout: "test-qwerty-fk",
    targetInput: input,
  });
  kb.setFKeyMode("Native");
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  let observedKey = "";
  let observedShift = false;
  input.getFocusDomRef()!.addEventListener("keydown", (e) => {
    observedKey = (e as KeyboardEvent).key;
    observedShift = (e as KeyboardEvent).shiftKey;
  });

  let pressedKey = "";
  kb.attachEvent("keyPress", (e: any) => {
    pressedKey = e.getParameter("key");
  });

  const statics = KioskKeyboard as unknown as {
    _executeNativeFKeyAction: (fkeyName: string) => void;
  };
  const originalAction = statics._executeNativeFKeyAction;
  let nativeAction = "";
  statics._executeNativeFKeyAction = (fkeyName: string) => {
    nativeAction = fkeyName;
  };

  try {
    tapKey(kb, "{shift}");
    tapKey(kb, "{fkey:F5}");

    assert.strictEqual(observedKey, "F5", "Synthetic keydown dispatched to target element");
    assert.ok(observedShift, "Synthetic keydown preserves shiftKey");
    assert.strictEqual(nativeAction, "F5", "Native action executed when event is not prevented");
    assert.strictEqual(pressedKey, "F5", "keyPress still fires in Native mode");
  } finally {
    statics._executeNativeFKeyAction = originalAction;
  }

  input.destroy();
  kb.destroy();
});

QUnit.test("Native fKeyMode skips native action when keydown is prevented", async (assert) => {
  const input = new Input();
  const kb = new KioskKeyboard({
    layout: "fkeys",
    targetInput: input,
  });
  kb.setFKeyMode("Native");
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  input.getFocusDomRef()!.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "F5") {
      e.preventDefault();
    }
  });

  let pressedKey = "";
  kb.attachEvent("keyPress", (e: any) => {
    pressedKey = e.getParameter("key");
  });

  const statics = KioskKeyboard as unknown as {
    _executeNativeFKeyAction: (fkeyName: string) => void;
  };
  const originalAction = statics._executeNativeFKeyAction;
  let actionCalls = 0;
  statics._executeNativeFKeyAction = () => {
    actionCalls += 1;
  };

  try {
    tapKey(kb, "{fkey:F5}");

    assert.strictEqual(actionCalls, 0, "Native action not executed when synthetic keydown is prevented");
    assert.strictEqual(pressedKey, "F5", "keyPress still fires when native action is blocked");
  } finally {
    statics._executeNativeFKeyAction = originalAction;
  }

  input.destroy();
  kb.destroy();
});

QUnit.test("keyPress preventDefault prevents native dispatch and native action", async (assert) => {
  const input = new Input();
  const kb = new KioskKeyboard({
    layout: "fkeys",
    targetInput: input,
  });
  kb.setFKeyMode("Native");
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  let dispatched = 0;
  input.getFocusDomRef()!.addEventListener("keydown", () => {
    dispatched += 1;
  });

  kb.attachEvent("keyPress", (e: any) => {
    e.preventDefault();
  });

  const statics = KioskKeyboard as unknown as {
    _executeNativeFKeyAction: (fkeyName: string) => void;
  };
  const originalAction = statics._executeNativeFKeyAction;
  let actionCalls = 0;
  statics._executeNativeFKeyAction = () => {
    actionCalls += 1;
  };

  try {
    tapKey(kb, "{fkey:F5}");

    assert.strictEqual(dispatched, 0, "No synthetic keydown dispatched when keyPress is prevented");
    assert.strictEqual(actionCalls, 0, "No native action when keyPress is prevented");
  } finally {
    statics._executeNativeFKeyAction = originalAction;
  }

  input.destroy();
  kb.destroy();
});

QUnit.test("Native fKeyMode does not dispatch unsupported custom fkey names", async (assert) => {
  const input = new Input();
  const kb = new KioskKeyboard({
    layout: "qwerty",
    targetInput: input,
  });
  kb.setFKeyMode("Native");

  KioskKeyboard.registerLayout("test-custom-native-fkey", [
    [{ value: "{fkey:CustomAction}", label: "Do", type: "modifier" }],
  ]);
  kb.setLayout("test-custom-native-fkey");

  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  let dispatched = 0;
  input.getFocusDomRef()!.addEventListener("keydown", () => {
    dispatched += 1;
  });

  let pressedKey = "";
  kb.attachEvent("keyPress", (e: any) => {
    pressedKey = e.getParameter("key");
  });

  tapKey(kb, "{fkey:CustomAction}");
  await waitForRender();

  assert.strictEqual(dispatched, 0, "No synthetic keydown dispatched for unsupported custom fkey name");
  assert.strictEqual(pressedKey, "CustomAction", "keyPress still fires for custom fkey names");

  input.destroy();
  kb.destroy();
});
