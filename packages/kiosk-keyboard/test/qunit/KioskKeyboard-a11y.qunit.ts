import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import InvisibleText from "sap/ui/core/InvisibleText";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import { placeAndWait, waitForRender, tapKey, getKeyElements, getKeyAriaLabel } from "./test-helpers";

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

QUnit.module("KioskKeyboard accessibility", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// Key roles and ARIA
// ──────────────────────────────────────────────

QUnit.test("Each key has role=button and aria-label", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const keys = getKeyElements(kb);
  keys.forEach((key) => {
    assert.strictEqual(key.getAttribute("role"), "button", `Key ${key.dataset.key} has role=button`);
    const label = key.getAttribute("aria-label");
    assert.ok(label && label.length > 0, `Key ${key.dataset.key} has aria-label`);
  });

  kb.destroy();
});

QUnit.test("Shift key has aria-pressed", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const shiftKey = kb.getDomRef()!.querySelector('[data-key="{shift}"]');
  assert.ok(shiftKey, "Shift key exists");
  assert.strictEqual(shiftKey!.getAttribute("aria-pressed"), "false", "Initially aria-pressed=false");

  tapKey(kb, "{shift}");
  await waitForRender();

  const updatedShift = kb.getDomRef()!.querySelector('[data-key="{shift}"]');
  assert.strictEqual(updatedShift!.getAttribute("aria-pressed"), "true", "After shift: aria-pressed=true");

  kb.destroy();
});

QUnit.test("getAccessibilityInfo returns correct data", (assert) => {
  const kb = new KioskKeyboard();
  const info = kb.getAccessibilityInfo();

  assert.strictEqual(info.role, "group", "Role is group");
  assert.strictEqual(info.type, "Virtual Keyboard", "Type is Virtual Keyboard (from i18n)");
  assert.strictEqual(info.description, "Virtual Keyboard", "Description resolves from i18n when ariaLabel is empty");
  assert.strictEqual(info.focusable, true, "Is focusable");
  assert.strictEqual(info.enabled, true, "Is enabled");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Modifier / Action / Width styling
// ──────────────────────────────────────────────

QUnit.test("Modifier keys have modifier CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const shiftKey = kb.getDomRef()!.querySelector('[data-key="{shift}"]');
  assert.ok(shiftKey, "Shift key found");
  assert.ok(shiftKey!.classList.contains("ui5KioskKey--modifier"), "Shift has modifier class");

  const layoutKey = kb.getDomRef()!.querySelector('[data-key="{layout:numeric}"]');
  assert.ok(layoutKey, "Layout switch key found");
  assert.ok(layoutKey!.classList.contains("ui5KioskKey--modifier"), "Layout switch has modifier class");

  kb.destroy();
});

QUnit.test("Action keys have action CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const enterKey = kb.getDomRef()!.querySelector('[data-key="{enter}"]');
  assert.ok(enterKey, "Enter key found");
  assert.ok(enterKey!.classList.contains("ui5KioskKey--action"), "Enter has action class");

  const backspaceKey = kb.getDomRef()!.querySelector('[data-key="{backspace}"]');
  assert.ok(backspaceKey, "Backspace key found");
  assert.ok(backspaceKey!.classList.contains("ui5KioskKey--action"), "Backspace has action class");

  kb.destroy();
});

QUnit.test("Space key has space CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const spaceKey = kb.getDomRef()!.querySelector('[data-key=" "]');
  assert.ok(spaceKey, "Space key found");
  assert.ok(spaceKey!.classList.contains("ui5KioskKey--space"), "Space has space width class");

  kb.destroy();
});

// ──────────────────────────────────────────────
// ARIA live region for shift state
// ──────────────────────────────────────────────

QUnit.test("Live region announces Shift state", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const sId = kb.getId();
  let liveRegion = document.getElementById(`${sId}-liveState`);
  assert.ok(liveRegion, "Live region element exists");
  assert.strictEqual(liveRegion!.textContent, "", "Empty when shift is off");

  // Activate shift
  tapKey(kb, "{shift}");
  await waitForRender();

  liveRegion = document.getElementById(`${sId}-liveState`);
  assert.strictEqual(liveRegion!.textContent, "Shift on", "Announces Shift on");

  // Activate caps lock
  tapKey(kb, "{shift}");
  await waitForRender();

  liveRegion = document.getElementById(`${sId}-liveState`);
  assert.strictEqual(liveRegion!.textContent, "Caps Lock on", "Announces Caps Lock on");

  // Deactivate
  tapKey(kb, "{shift}");
  await waitForRender();

  liveRegion = document.getElementById(`${sId}-liveState`);
  assert.strictEqual(liveRegion!.textContent, "", "Empty after shift off");

  kb.destroy();
});

QUnit.test("Live region announces open and close", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  const sId = kb.getId();
  let liveRegion = document.getElementById(`${sId}-liveState`);
  assert.ok(liveRegion, "Live region element exists");

  kb.show();
  liveRegion = document.getElementById(`${sId}-liveState`);
  assert.strictEqual(liveRegion!.textContent, "Virtual keyboard opened", "Announces open");

  kb.close();
  liveRegion = document.getElementById(`${sId}-liveState`);
  assert.strictEqual(liveRegion!.textContent, "Virtual keyboard closed", "Announces close");

  kb.destroy();
});

// ──────────────────────────────────────────────
// ARIA Associations
// ──────────────────────────────────────────────

QUnit.test("ariaLabelledBy renders aria-labelledby attribute on root DOM", async (assert) => {
  const label = new InvisibleText({ text: "My Keyboard" });
  label.placeAt("qunit-fixture");
  const kb = new KioskKeyboard();
  kb.addAriaLabelledBy(label);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  assert.ok(dom.getAttribute("aria-labelledby")?.includes(label.getId()), "aria-labelledby contains label ID");

  label.destroy();
  kb.destroy();
});

QUnit.test("ariaDescribedBy renders aria-describedby attribute", async (assert) => {
  const desc = new InvisibleText({ text: "Use arrow keys to navigate" });
  desc.placeAt("qunit-fixture");
  const kb = new KioskKeyboard();
  kb.addAriaDescribedBy(desc);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  assert.ok(dom.getAttribute("aria-describedby")?.includes(desc.getId()), "aria-describedby contains description ID");

  desc.destroy();
  kb.destroy();
});

QUnit.test("Multiple ariaLabelledBy IDs render space-separated", async (assert) => {
  const label1 = new InvisibleText({ text: "Label 1" });
  const label2 = new InvisibleText({ text: "Label 2" });
  label1.placeAt("qunit-fixture");
  label2.placeAt("qunit-fixture");
  const kb = new KioskKeyboard();
  kb.addAriaLabelledBy(label1);
  kb.addAriaLabelledBy(label2);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const attr = dom.getAttribute("aria-labelledby") ?? "";
  assert.ok(attr.includes(label1.getId()), "Contains first label ID");
  assert.ok(attr.includes(label2.getId()), "Contains second label ID");

  label1.destroy();
  label2.destroy();
  kb.destroy();
});

QUnit.test("ariaLabel + ariaLabelledBy coexist", async (assert) => {
  const label = new InvisibleText({ text: "External label" });
  label.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ ariaLabel: "Custom Keyboard" });
  kb.addAriaLabelledBy(label);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const labelledBy = dom.getAttribute("aria-labelledby") ?? "";
  assert.ok(labelledBy.includes(label.getId()), "ariaLabelledBy ID included in aria-labelledby");

  label.destroy();
  kb.destroy();
});

QUnit.test("removeAriaLabelledBy clears attribute after re-render", async (assert) => {
  const label = new InvisibleText({ text: "Removable label" });
  label.placeAt("qunit-fixture");
  const kb = new KioskKeyboard();
  kb.addAriaLabelledBy(label);
  await placeAndWait(kb);

  let attr = kb.getDomRef()!.getAttribute("aria-labelledby") ?? "";
  assert.ok(attr.includes(label.getId()), "Label ID initially present");

  kb.removeAriaLabelledBy(label);
  await waitForRender();

  attr = kb.getDomRef()!.getAttribute("aria-labelledby") ?? "";
  assert.notOk(attr.includes(label.getId()), "Label ID removed after re-render");

  label.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// aria-controls
// ──────────────────────────────────────────────

QUnit.test("aria-controls points to targetInput on initial render", async (assert) => {
  const input = new Input("a11y-target");
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  assert.strictEqual(
    kb.getDomRef()!.getAttribute("aria-controls"),
    input.getId(),
    "aria-controls set to target input ID",
  );

  input.destroy();
  kb.destroy();
});

QUnit.test("aria-controls absent when no targetInput", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.notOk(kb.getDomRef()!.hasAttribute("aria-controls"), "No aria-controls without target");

  kb.destroy();
});

QUnit.test("aria-controls updates when setTargetInput is called", async (assert) => {
  const input1 = new Input("a11y-input1");
  const input2 = new Input("a11y-input2");
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");
  await nextUIUpdate();

  const kb = new KioskKeyboard({ targetInput: input1 });
  await placeAndWait(kb);

  assert.strictEqual(kb.getDomRef()!.getAttribute("aria-controls"), input1.getId(), "Initially points to input1");

  kb.setTargetInput(input2);
  assert.strictEqual(
    kb.getDomRef()!.getAttribute("aria-controls"),
    input2.getId(),
    "Updated to input2 without re-render",
  );

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Static API: getKeyIcon
// ──────────────────────────────────────────────

QUnit.test('getKeyIcon: {shift} \u2192 "sap-icon://arrow-top"', (assert) => {
  assert.strictEqual(KioskKeyboard.getKeyIcon("{shift}"), "sap-icon://arrow-top");
});

QUnit.test('getKeyIcon: {enter} \u2192 "sap-icon://accept"', (assert) => {
  assert.strictEqual(KioskKeyboard.getKeyIcon("{enter}"), "sap-icon://accept");
});

QUnit.test('getKeyIcon: {backspace} \u2192 "sap-icon://arrow-left"', (assert) => {
  assert.strictEqual(KioskKeyboard.getKeyIcon("{backspace}"), "sap-icon://arrow-left");
});

QUnit.test('getKeyIcon: "a" \u2192 undefined', (assert) => {
  assert.strictEqual(KioskKeyboard.getKeyIcon("a"), undefined);
});

QUnit.test('getKeyIcon: " " \u2192 undefined', (assert) => {
  assert.strictEqual(KioskKeyboard.getKeyIcon(" "), undefined);
});

// ──────────────────────────────────────────────
// getKeyAriaLabel for Special Keys
// ──────────────────────────────────────────────

QUnit.test('getKeyAriaLabel: {backspace} (label: "") \u2192 "Backspace"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(getKeyAriaLabel(kb, { value: "{backspace}", label: "" }), "Backspace");

  kb.destroy();
});

QUnit.test('getKeyAriaLabel: {enter} (label: "") \u2192 "Enter"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(getKeyAriaLabel(kb, { value: "{enter}", label: "" }), "Enter");

  kb.destroy();
});

QUnit.test('getKeyAriaLabel: {shift} (label: "") \u2192 "Shift"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(getKeyAriaLabel(kb, { value: "{shift}", label: "" }), "Shift");

  kb.destroy();
});

QUnit.test('getKeyAriaLabel: " " \u2192 "Space"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(getKeyAriaLabel(kb, { value: " " }), "Space");

  kb.destroy();
});

QUnit.test('getKeyAriaLabel: "a" \u2192 "a"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(getKeyAriaLabel(kb, { value: "a" }), "a");

  kb.destroy();
});

QUnit.test('getKeyAriaLabel after shift: "a" \u2192 "A", "1" with shiftLabel "!" \u2192 "!"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");

  assert.strictEqual(getKeyAriaLabel(kb, { value: "a" }), "A", "'a' becomes 'A' with shift");
  assert.strictEqual(
    getKeyAriaLabel(kb, { value: "1", shiftLabel: "!" }),
    "!",
    "'1' with shiftLabel '!' becomes '!' with shift",
  );

  kb.destroy();
});
