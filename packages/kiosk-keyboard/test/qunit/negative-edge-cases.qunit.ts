import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import { placeAndWait, waitForRender, tapKey, isShiftActive, isCapsLock } from "./test-helpers";

// ──────────────────────────────────────────────
// Layout switch while shift is active
// ──────────────────────────────────────────────

QUnit.module("Negative / Edge-Case - Layout switch + shift", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// kiosk-keyboard resets shift/caps-lock on a user {layout:*} switch, matching
// kiosk-keyboard-webc (cross-package parity, #98). A layout switch begins a new
// typing context: caps-lock that was meaningful on QWERTY has no meaning on a
// numeric/special layout, so it must not carry over. The mirror webc test is
// "clears caps lock when user switches layout via {layout:X} key".
// (Auto-release of one-shot shift after typing is covered separately in
// KioskKeyboard.qunit.ts and KioskKeyboard-renderer-blackbox.qunit.ts.)
QUnit.test("Caps lock resets on layout switch", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  // Activate caps lock (shift twice).
  tapKey(kb, "{shift}");
  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isCapsLock(kb), "Caps lock is active");

  // Switching layout clears caps lock immediately.
  tapKey(kb, "{layout:numeric}");
  await waitForRender();
  assert.notOk(isCapsLock(kb), "Caps lock cleared by the layout switch");

  // Still cleared after returning to the base layout.
  tapKey(kb, "{layout:base}");
  await waitForRender();
  assert.notOk(isCapsLock(kb), "Caps lock stays cleared after the round-trip");

  input.destroy();
  kb.destroy();
});

QUnit.test("Target switch resets shift regardless of current layout", async (assert) => {
  const input1 = new Input({ value: "" });
  const input2 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input1.getId(), input2.getId()] });
  await placeAndWait(kb);

  // Activate shift on base layout
  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Shift active on base layout");

  // Switch to numeric layout (shift persists internally but is not
  // observable: numeric layout has no shift key)
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  // Switch target while on numeric layout: the user pick is dropped for the
  // base layout, and shift must not be active on it
  input2.focus();
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "qwerty", "Target switch returned the dropped pick to the base layout");
  assert.notOk(isShiftActive(kb), "Shift not active after the target switch");
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
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Switching controls to new control after previous target was destroyed", async (assert) => {
  const input1 = new Input({ value: "old" });
  const input2 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input1.getId()] });
  await placeAndWait(kb);

  // Destroy old target
  input1.destroy();
  await waitForRender();

  // Switch to new target via controls - should not throw
  kb.setControls([input2.getId()]);

  // Typing should work on the new target (auto-targeted since single control)
  tapKey(kb, "x");
  assert.strictEqual(input2.getValue(), "x", "Typing works on new target after previous was destroyed");

  input2.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Rapid successive target switches
// ──────────────────────────────────────────────

QUnit.module("Negative / Edge-Case - Rapid target switching", {
  afterEach() {
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

  const kb = new KioskKeyboard({ controls: [input1.getId(), input2.getId(), input3.getId()] });
  await placeAndWait(kb);

  // Rapid-fire target switches via focus without awaiting renders
  input2.focus();
  input3.focus();
  input1.focus();
  input3.focus();

  assert.strictEqual(kb.getActiveControl()?.getId(), input3.getId(), "Final target is the last one set");

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

QUnit.test("Key taps without target are no-ops", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(kb.getActiveControl(), null, "No active control initially");

  // Key taps should be no-ops (no target to type into)
  tapKey(kb, "a");
  tapKey(kb, "b");
  tapKey(kb, "{backspace}");
  assert.strictEqual(kb.getActiveControl(), null, "Taps without a target did not spuriously establish one");

  kb.destroy();
});

// ──────────────────────────────────────────────
// handleBackspace at position 0 with no selection
// ──────────────────────────────────────────────

QUnit.module("Negative / Edge-Case - Backspace at position 0", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Backspace at position 0 is a silent no-op", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
  await placeAndWait(kb);
  kb.show();

  // Backspace on empty input should do nothing
  tapKey(kb, "{backspace}");
  assert.strictEqual(input.getValue(), "", "Empty input stays empty");

  // Backspace should not have set the dirty flag - no change event expected
  let changeFired = false;
  input.attachChange(() => {
    changeFired = true;
  });

  kb.close(); // Forces deferred change if dirty
  assert.notOk(changeFired, "No change event after backspace at position 0");

  input.destroy();
  kb.destroy();
});

QUnit.test("Backspace with the caret at position 0 of a non-empty value keeps the caret there", async (assert) => {
  const input = new Input({ value: "hello" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  // Caret at the very start of non-empty content (distinct from the empty-buffer
  // no-op above): there is nothing before the caret to delete.
  input.focus();
  (input.getFocusDomRef() as HTMLInputElement).setSelectionRange(0, 0);

  tapKey(kb, "{backspace}");

  // The caret stayed at 0, so the next character inserts at the start.
  tapKey(kb, "x");
  assert.strictEqual(input.getValue(), "xhello", "Typing after the no-op backspace inserts at the caret");

  input.destroy();
  kb.destroy();
});
