import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import InvisibleText from "sap/ui/core/InvisibleText";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import {
  getKeyElement,
  getKeyElements,
  getRequiredKeyElement,
  hasKeyClass,
  placeAndWait,
  tapKey,
  waitForRender,
} from "./test-helpers";

const DOM = KioskKeyboard.DOM;

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

QUnit.test("Each key has role=button and either visible label or aria-label", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const keys = getKeyElements(kb);
  keys.forEach((key) => {
    assert.strictEqual(key.getAttribute("role"), "button", `Key ${key.dataset.key} has role=button`);
    const visibleLabel = key.querySelector(`.${DOM.classes.keyLabel}`)?.textContent;
    const ariaLabel = key.getAttribute("aria-label");
    assert.ok(
      (visibleLabel && visibleLabel.length > 0) || (ariaLabel && ariaLabel.length > 0),
      `Key ${key.dataset.key} has visible label or aria-label`,
    );
  });

  kb.destroy();
});

QUnit.test("Shift key has aria-pressed", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const shiftKey = getKeyElement(kb, "{shift}");
  assert.ok(shiftKey, "Shift key exists");
  assert.strictEqual(shiftKey!.getAttribute("aria-pressed"), "false", "Initially aria-pressed=false");

  tapKey(kb, "{shift}");
  await waitForRender();

  const updatedShift = getKeyElement(kb, "{shift}");
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

  const shiftKey = getKeyElement(kb, "{shift}");
  assert.ok(shiftKey, "Shift key found");
  assert.ok(hasKeyClass(kb, "{shift}", DOM.classes.keyModifier), "Shift has modifier class");

  const layoutKey = getKeyElement(kb, "{layout:numeric}");
  assert.ok(layoutKey, "Layout switch key found");
  assert.ok(hasKeyClass(kb, "{layout:numeric}", DOM.classes.keyModifier), "Layout switch has modifier class");

  kb.destroy();
});

QUnit.test("Action keys have action CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const enterKey = getKeyElement(kb, "{enter}");
  assert.ok(enterKey, "Enter key found");
  assert.ok(hasKeyClass(kb, "{enter}", DOM.classes.keyAction), "Enter has action class");

  const backspaceKey = getKeyElement(kb, "{backspace}");
  assert.ok(backspaceKey, "Backspace key found");
  assert.ok(hasKeyClass(kb, "{backspace}", DOM.classes.keyAction), "Backspace has action class");

  kb.destroy();
});

QUnit.test("Space key has space CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const spaceKey = getKeyElement(kb, " ");
  assert.ok(spaceKey, "Space key found");
  assert.ok(hasKeyClass(kb, " ", DOM.classes.keySpace), "Space has space width class");

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

QUnit.test("aria-controls points to active target on initial render", async (assert) => {
  const input = new Input("a11y-target");
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  input.focus();
  await nextUIUpdate();

  assert.strictEqual(
    kb.getDomRef()!.getAttribute("aria-controls"),
    input.getId(),
    "aria-controls set to target input ID",
  );

  input.destroy();
  kb.destroy();
});

QUnit.test("aria-controls absent when no active target", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.notOk(kb.getDomRef()!.hasAttribute("aria-controls"), "No aria-controls without target");

  kb.destroy();
});

QUnit.test("aria-controls updates when _setActiveTarget is called", async (assert) => {
  const input1 = new Input("a11y-input1");
  const input2 = new Input("a11y-input2");
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");
  await nextUIUpdate();

  const kb = new KioskKeyboard({ controls: [input1.getId()] });
  await placeAndWait(kb);

  input1.focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getDomRef()!.getAttribute("aria-controls"), input1.getId(), "Initially points to input1");

  (kb as any)._setActiveTarget(input2);
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
// Rendered labels for Keys (visible text or aria-label)
// ──────────────────────────────────────────────

QUnit.test('Rendered visible label: {backspace} \u2192 "Backspace"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(
    getRequiredKeyElement(kb, "{backspace}").querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "Backspace",
  );

  kb.destroy();
});

QUnit.test('Rendered visible label: {enter} \u2192 "Enter"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(
    getRequiredKeyElement(kb, "{enter}").querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "Enter",
  );

  kb.destroy();
});

QUnit.test('Rendered visible label: {shift} \u2192 "Shift"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(
    getRequiredKeyElement(kb, "{shift}").querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "Shift",
  );

  kb.destroy();
});

QUnit.test('Rendered visible label: " " \u2192 "Space"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(getRequiredKeyElement(kb, " ").querySelector(`.${DOM.classes.keyLabel}`)?.textContent, "Space");

  kb.destroy();
});

QUnit.test('Rendered visible label: "a" \u2192 "a"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(getRequiredKeyElement(kb, "a").querySelector(`.${DOM.classes.keyLabel}`)?.textContent, "a");

  kb.destroy();
});

QUnit.test('Rendered visible label after shift: "a" \u2192 "A", "1" \u2192 "!"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();

  assert.strictEqual(
    getRequiredKeyElement(kb, "a").querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "A",
    "'a' becomes 'A' with shift",
  );
  assert.strictEqual(
    getRequiredKeyElement(kb, "1").querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "!",
    "'1' with shiftLabel '!' becomes '!' with shift",
  );

  kb.destroy();
});
