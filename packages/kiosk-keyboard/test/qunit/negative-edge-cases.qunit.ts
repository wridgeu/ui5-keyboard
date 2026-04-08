import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import TextArea from "sap/m/TextArea";
import Log from "sap/base/Log";
import { placeAndWait, waitForRender, tapKey, isShiftActive, isCapsLock } from "./test-helpers";

// ──────────────────────────────────────────────
// Layout switch while shift is active
// ──────────────────────────────────────────────

QUnit.module("Negative / Edge-Case - Layout switch + shift", {
  afterEach() {
    KioskKeyboard.resetCustomLayouts();
    KioskKeyboard.resetLocaleLayouts();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Shift persists across layout switch", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  // Activate shift
  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Shift is active after tap");

  // Switch to numeric layout (no shift key to observe) and back to base
  tapKey(kb, "{layout:numeric}");
  await waitForRender();
  tapKey(kb, "{layout:base}");
  await waitForRender();

  // Shift must still be active after the round-trip
  assert.ok(isShiftActive(kb), "Shift remains active after layout round-trip");

  input.destroy();
  kb.destroy();
});

QUnit.test("Caps lock persists across layout switch", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  // Activate caps lock (shift twice)
  tapKey(kb, "{shift}");
  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isCapsLock(kb), "Caps lock is active");

  // Switch to numeric layout (no shift key to observe) and back to base
  tapKey(kb, "{layout:numeric}");
  await waitForRender();
  tapKey(kb, "{layout:base}");
  await waitForRender();

  // Caps lock must still be active after the round-trip
  assert.ok(isCapsLock(kb), "Caps lock remains active after layout round-trip");

  input.destroy();
  kb.destroy();
});

QUnit.test("Shift auto-releases after typing in switched layout", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  // Activate shift, then switch to numeric
  tapKey(kb, "{shift}");
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  // Type a character in the numeric layout -- shift should auto-release
  tapKey(kb, "1");
  await waitForRender();

  // Switch back to base layout to verify shift was released
  tapKey(kb, "{layout:base}");
  await waitForRender();
  assert.notOk(isShiftActive(kb), "Shift auto-released after character typed in switched layout");

  input.destroy();
  kb.destroy();
});

QUnit.test("setTargetInput() resets shift regardless of current layout", async (assert) => {
  const input1 = new Input({ value: "" });
  const input2 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input1 });
  await placeAndWait(kb);

  // Activate shift on base layout
  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Shift active on base layout");

  // Switch to numeric layout (shift persists internally but is not
  // observable -- numeric layout has no shift key)
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  // Switch target while on numeric layout -- shift must reset
  kb.setTargetInput(input2);
  await waitForRender();

  // Switch back to base layout to observe that shift was cleared
  tapKey(kb, "{layout:base}");
  await waitForRender();
  assert.notOk(isShiftActive(kb), "Shift reset when target switches (verified after returning to base layout)");
  assert.notOk(isCapsLock(kb), "Caps lock also reset when target switches");

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Keyboard close when target control is destroyed
// ──────────────────────────────────────────────

QUnit.module("Negative / Edge-Case - Target control destroyed", {
  afterEach() {
    KioskKeyboard.resetCustomLayouts();
    KioskKeyboard.resetLocaleLayouts();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Keyboard stays functional after target control is destroyed", async (assert) => {
  const input = new Input({ value: "abc" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  // Type to verify keyboard works
  tapKey(kb, "d");
  assert.strictEqual(input.getValue(), "abcd", "Character typed before destroy");

  // Destroy the target control
  input.destroy();
  await waitForRender();

  // Keyboard should not throw when tapping keys after target is destroyed
  assert.ok(kb.getDomRef(), "Keyboard is still rendered");
  try {
    tapKey(kb, "e");
    tapKey(kb, "{backspace}");
    tapKey(kb, "{shift}");
  } catch (e) {
    assert.ok(false, `Key taps after target destruction threw: ${e}`);
  }
  assert.ok(kb.getDomRef(), "Keyboard still rendered after key taps on destroyed target");

  kb.destroy();
});

QUnit.test("Keyboard can close cleanly after target control is destroyed", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input, docked: true });
  await placeAndWait(kb);
  kb.show();

  assert.ok(kb.isOpen(), "Keyboard is open");

  // Destroy the target control while keyboard is open
  input.destroy();
  await waitForRender();

  // Close should not throw
  kb.close();
  assert.notOk(kb.isOpen(), "Keyboard closed without error after target destroy");

  kb.destroy();
});

QUnit.test("setTargetInput to new control after previous target was destroyed", async (assert) => {
  const input1 = new Input({ value: "old" });
  const input2 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input1 });
  await placeAndWait(kb);

  // Destroy old target
  input1.destroy();
  await waitForRender();

  // Switch to new target - should not throw
  kb.setTargetInput(input2);

  // Typing should work on the new target
  tapKey(kb, "x");
  assert.strictEqual(input2.getValue(), "x", "Typing works on new target after previous was destroyed");

  input2.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Rapid successive setTargetInput() calls
// ──────────────────────────────────────────────

QUnit.module("Negative / Edge-Case - Rapid setTargetInput()", {
  afterEach() {
    KioskKeyboard.resetCustomLayouts();
    KioskKeyboard.resetLocaleLayouts();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Rapid target switching settles on last target", async (assert) => {
  const input1 = new Input({ value: "" });
  const input2 = new Input({ value: "" });
  const input3 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");
  input3.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input1 });
  await placeAndWait(kb);

  // Rapid-fire target switches without awaiting renders
  kb.setTargetInput(input2);
  kb.setTargetInput(input3);
  kb.setTargetInput(input1);
  kb.setTargetInput(input3);

  assert.strictEqual(kb.getTargetInput(), input3.getId(), "Final target is the last one set");

  // Typing should go to the last target
  tapKey(kb, "z");
  assert.strictEqual(input3.getValue(), "z", "Character typed into final target");
  assert.strictEqual(input1.getValue(), "", "First input unchanged");
  assert.strictEqual(input2.getValue(), "", "Second input unchanged");

  input1.destroy();
  input2.destroy();
  input3.destroy();
  kb.destroy();
});

QUnit.test("Deferred change fires for dirty target on rapid switch", async (assert) => {
  const input1 = new Input({ value: "" });
  const input2 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input1 });
  await placeAndWait(kb);

  // Type into first input to make it dirty
  tapKey(kb, "a");
  tapKey(kb, "b");
  assert.strictEqual(input1.getValue(), "ab", "Typed into first target");

  let changeValue = "";
  input1.attachChange((event) => {
    changeValue = event.getParameter("value") as string;
  });

  // Immediately switch to second target - deferred change should fire for first
  kb.setTargetInput(input2);

  assert.strictEqual(changeValue, "ab", "Change event fired for dirty target on switch");

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

QUnit.test("Rapid switch resets shift state for each switch", async (assert) => {
  const input1 = new Input({ value: "" });
  const input2 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input1 });
  await placeAndWait(kb);

  // Activate shift
  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Shift active on first target");

  // Switch target - shift should reset
  kb.setTargetInput(input2);
  await waitForRender();
  assert.notOk(isShiftActive(kb), "Shift reset after switch to second target");

  // Activate shift again, then rapid switch back
  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Shift active on second target");

  kb.setTargetInput(input1);
  await waitForRender();
  assert.notOk(isShiftActive(kb), "Shift reset after switch back to first target");

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

QUnit.test("setTargetInput to empty string clears the target", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  tapKey(kb, "a");
  assert.strictEqual(input.getValue(), "a", "Typing works with target set");

  // Clear the target
  kb.setTargetInput("");
  assert.notOk(kb.getTargetInput(), "Target association cleared");

  // Key taps should be no-ops (no target to type into)
  tapKey(kb, "b");
  assert.strictEqual(input.getValue(), "a", "Input unchanged after target cleared");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// handleBackspace at position 0 with no selection
// ──────────────────────────────────────────────

QUnit.module("Negative / Edge-Case - Backspace at position 0", {
  afterEach() {
    KioskKeyboard.resetCustomLayouts();
    KioskKeyboard.resetLocaleLayouts();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Backspace at position 0 is a silent no-op", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  // Backspace on empty input should do nothing
  tapKey(kb, "{backspace}");
  assert.strictEqual(input.getValue(), "", "Empty input stays empty");

  // Backspace should not have set the dirty flag - no change event expected
  let changeFired = false;
  input.attachChange(() => {
    changeFired = true;
  });

  kb.setTargetInput(""); // Forces deferred change if dirty
  assert.notOk(changeFired, "No change event after backspace at position 0");

  input.destroy();
  kb.destroy();
});

QUnit.test("Backspace at position 0 with non-empty value does not truncate", async (assert) => {
  const input = new Input({ value: "hello" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  // Simulate cursor at position 0: delete all then retype to set cursor at start
  // Type into the input so the session tracks cursor, then delete all characters
  // to get cursor at position 0
  tapKey(kb, "{backspace}");
  tapKey(kb, "{backspace}");
  tapKey(kb, "{backspace}");
  tapKey(kb, "{backspace}");
  tapKey(kb, "{backspace}");
  assert.strictEqual(input.getValue(), "", "All characters deleted");

  // One more backspace at position 0
  tapKey(kb, "{backspace}");
  assert.strictEqual(input.getValue(), "", "Backspace at pos 0 does nothing");

  // Keyboard still works - type a new character
  tapKey(kb, "x");
  assert.strictEqual(input.getValue(), "x", "Typing still works after backspace at pos 0");

  input.destroy();
  kb.destroy();
});

QUnit.test("Multiple backspaces on empty TextArea are silent no-ops", async (assert) => {
  const textarea = new TextArea({ value: "" });
  textarea.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: textarea });
  await placeAndWait(kb);

  // Multiple backspaces on empty textarea
  tapKey(kb, "{backspace}");
  tapKey(kb, "{backspace}");
  tapKey(kb, "{backspace}");
  assert.strictEqual(textarea.getValue(), "", "TextArea stays empty");

  // Still functional
  tapKey(kb, "a");
  assert.strictEqual(textarea.getValue(), "a", "Typing works after repeated no-op backspaces");

  textarea.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// i18n API negative paths (facade smoke test)
//
// Detailed validation coverage is in i18n-registry.qunit.ts.
// This module only verifies that the KioskKeyboard facade
// delegates validation to the registry (no crash, warning logged).
// ──────────────────────────────────────────────

const i18nSandbox = sinon.createSandbox();

QUnit.module("Negative / Edge-Case - i18n API", {
  afterEach() {
    i18nSandbox.restore();
    KioskKeyboard.setI18nResolver(null);
    KioskKeyboard.resetCustomLayouts();
    KioskKeyboard.resetLocaleLayouts();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("setI18nResolver with non-function argument is silently rejected", (assert) => {
  const spy = i18nSandbox.spy(Log, "warning");

  KioskKeyboard.setI18nResolver("not a function" as never);
  assert.ok(spy.calledOnce, "Warning logged for non-function argument");
});
