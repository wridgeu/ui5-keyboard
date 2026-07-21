import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import InvisibleText from "sap/ui/core/InvisibleText";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import {
  getKeyElement,
  getKeyElements,
  getRequiredKeyElement,
  getKeyAttr,
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
  assert.strictEqual(getKeyAttr(kb, "{shift}", DOM.attributes.keyType), "modifier", "Shift has modifier type");

  const layoutKey = getKeyElement(kb, "{layout:numeric}");
  assert.ok(layoutKey, "Layout switch key found");
  assert.strictEqual(
    getKeyAttr(kb, "{layout:numeric}", DOM.attributes.keyType),
    "modifier",
    "Layout switch has modifier type",
  );

  kb.destroy();
});

QUnit.test("Action keys have action CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const enterKey = getKeyElement(kb, "{enter}");
  assert.ok(enterKey, "Enter key found");
  assert.strictEqual(getKeyAttr(kb, "{enter}", DOM.attributes.keyType), "action", "Enter has action type");

  const backspaceKey = getKeyElement(kb, "{backspace}");
  assert.ok(backspaceKey, "Backspace key found");
  assert.strictEqual(getKeyAttr(kb, "{backspace}", DOM.attributes.keyType), "action", "Backspace has action type");

  kb.destroy();
});

QUnit.test("Space key has the space width span", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const spaceKey = getKeyElement(kb, " ");
  assert.ok(spaceKey, "Space key found");
  assert.strictEqual(getKeyAttr(kb, " ", DOM.attributes.keySpan), "space", "Space has the space width span");

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

QUnit.test("Root aria-label defers to ariaLabelledBy but honors an explicit ariaLabel", async (assert) => {
  // No ariaLabelledBy: the default fallback names the group.
  const kbDefault = new KioskKeyboard();
  await placeAndWait(kbDefault);
  assert.strictEqual(
    kbDefault.getDomRef()!.getAttribute("aria-label"),
    "Virtual Keyboard",
    "default aria-label is present when nothing else names the group",
  );
  kbDefault.destroy();

  const label = new InvisibleText({ text: "External label" });
  label.placeAt("qunit-fixture");

  // ariaLabelledBy set, no explicit ariaLabel: the default is suppressed so it
  // does not compete with aria-labelledby (which wins per WAI-ARIA).
  const kbLabelledBy = new KioskKeyboard();
  kbLabelledBy.addAriaLabelledBy(label);
  await placeAndWait(kbLabelledBy);
  const domLabelledBy = kbLabelledBy.getDomRef()!;
  assert.ok(domLabelledBy.getAttribute("aria-labelledby")?.includes(label.getId()), "aria-labelledby names the group");
  assert.notOk(domLabelledBy.hasAttribute("aria-label"), "default aria-label is suppressed when ariaLabelledBy is set");
  kbLabelledBy.destroy();

  // An explicit ariaLabel is still honored even with ariaLabelledBy present.
  const kbBoth = new KioskKeyboard({ ariaLabel: "PIN entry" });
  kbBoth.addAriaLabelledBy(label);
  await placeAndWait(kbBoth);
  assert.strictEqual(kbBoth.getDomRef()!.getAttribute("aria-label"), "PIN entry", "explicit ariaLabel is preserved");
  kbBoth.destroy();

  label.destroy();
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

QUnit.test("aria-controls updates when active target changes via focus", async (assert) => {
  const input1 = new Input("a11y-input1");
  const input2 = new Input("a11y-input2");
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");
  await nextUIUpdate();

  const kb = new KioskKeyboard({ controls: [input1.getId(), input2.getId()] });
  await placeAndWait(kb);

  input1.focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getDomRef()!.getAttribute("aria-controls"), input1.getId(), "Initially points to input1");

  input2.focus();
  await nextUIUpdate();
  assert.strictEqual(
    kb.getDomRef()!.getAttribute("aria-controls"),
    input2.getId(),
    "Updated to input2 without re-render",
  );

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

QUnit.test("aria-controls survives re-render for a non-Control target", async (assert) => {
  // A target whose id does not resolve to a UI5 Control (a plain DOM input, or
  // an association left transiently dangling by aggregation churn) makes
  // getActiveControl() return null while _getActiveTargetId() still holds the id.
  // The renderer must emit the raw association id so it does not diverge from the
  // aria-controls that _setActiveTarget writes imperatively.
  const domInput = document.createElement("input");
  domInput.id = "plain-dom-target";
  document.getElementById("qunit-fixture")!.appendChild(domInput);

  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const internals = kb as unknown as {
    _setActiveTarget: (target?: string) => void;
    _getActiveTargetId: () => string;
  };
  internals._setActiveTarget("plain-dom-target");
  await nextUIUpdate();

  // Precondition: the target is a non-Control DOM element.
  assert.strictEqual(kb.getActiveControl(), null, "target does not resolve to a Control");
  assert.strictEqual(internals._getActiveTargetId(), "plain-dom-target", "association holds the raw id");
  assert.strictEqual(
    kb.getDomRef()!.getAttribute("aria-controls"),
    "plain-dom-target",
    "imperative path set aria-controls to the raw id",
  );

  // Force a full re-render: the renderer, not the imperative path, now owns aria-controls.
  kb.invalidate();
  await nextUIUpdate();

  assert.strictEqual(
    kb.getDomRef()!.getAttribute("aria-controls"),
    "plain-dom-target",
    "aria-controls retained after re-render (renderer reads _getActiveTargetId, not getActiveControl)",
  );

  kb.destroy();
});

// ──────────────────────────────────────────────
// Static API: getKeyIcon
// ──────────────────────────────────────────────

QUnit.test("getKeyIcon: maps icon keys and returns undefined for plain characters", (assert) => {
  const cases: [string, string | undefined][] = [
    ["{shift}", "sap-icon://arrow-top"],
    ["{enter}", "sap-icon://accept"],
    ["{backspace}", "sap-icon://arrow-left"],
    ["a", undefined],
    [" ", undefined],
  ];

  cases.forEach(([input, expected]) => {
    assert.strictEqual(KioskKeyboard.getKeyIcon(input), expected, `getKeyIcon(${JSON.stringify(input)})`);
  });
});

// ──────────────────────────────────────────────
// Rendered labels for Keys (visible text or aria-label)
// ──────────────────────────────────────────────

QUnit.test("Rendered visible labels for special and plain keys", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  try {
    const cases: [string, string][] = [
      ["{backspace}", "Backspace"],
      ["{enter}", "Enter"],
      ["{shift}", "Shift"],
      [" ", "Space"],
      ["a", "a"],
    ];

    cases.forEach(([keyValue, expectedLabel]) => {
      assert.strictEqual(
        getRequiredKeyElement(kb, keyValue).querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
        expectedLabel,
        `key ${JSON.stringify(keyValue)} renders label "${expectedLabel}"`,
      );
    });
  } finally {
    kb.destroy();
  }
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
