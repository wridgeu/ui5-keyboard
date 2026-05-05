import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import { getText } from "ui5/kiosk/internal/i18n-registry";
import { getKeyElement, placeAndWait, waitForRender } from "./test-helpers";

const DOM = KioskKeyboard.DOM;

QUnit.module("KioskKeyboard - i18n integration", {
  afterEach() {
    KioskKeyboard.setI18nResolver(null);
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Resolver can change KIOSK_KEYBOARD_LABEL on rendered control", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  KioskKeyboard.setI18nResolver((key) => {
    if (key === "KIOSK_KEYBOARD_LABEL") return "Custom Keyboard Label";
    return undefined;
  });
  await waitForRender();

  const dom = kb.getDomRef();
  assert.ok(dom, "Keyboard is rendered");
  assert.strictEqual(dom?.getAttribute("aria-label"), "Custom Keyboard Label", "aria-label reflects resolver");

  input.destroy();
  kb.destroy();
});

QUnit.test("Setting resolver to null restores base labels", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  const originalLabel = kb.getDomRef()?.getAttribute("aria-label");

  KioskKeyboard.setI18nResolver((key) => {
    if (key === "KIOSK_KEYBOARD_LABEL") return "Overridden";
    return undefined;
  });
  await waitForRender();

  assert.strictEqual(kb.getDomRef()?.getAttribute("aria-label"), "Overridden", "Resolver applied");

  KioskKeyboard.setI18nResolver(null);
  await waitForRender();

  assert.strictEqual(kb.getDomRef()?.getAttribute("aria-label"), originalLabel, "Original label restored");

  input.destroy();
  kb.destroy();
});

QUnit.test("Resolver can override special key labels", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  KioskKeyboard.setI18nResolver((key) => {
    const map: Record<string, string> = {
      KEY_SHIFT: "Umschalt",
      KEY_ENTER: "Eingabe",
      KEY_BACKSPACE: "L\u00F6schen",
    };
    return map[key];
  });
  await waitForRender();

  const shiftKey = getKeyElement(kb, "{shift}");
  const enterKey = getKeyElement(kb, "{enter}");
  const backspaceKey = getKeyElement(kb, "{backspace}");

  assert.strictEqual(
    shiftKey?.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "Umschalt",
    "Shift key label overridden",
  );
  assert.strictEqual(
    enterKey?.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "Eingabe",
    "Enter key label overridden",
  );
  assert.strictEqual(
    backspaceKey?.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "L\u00F6schen",
    "Backspace key label overridden",
  );

  input.destroy();
  kb.destroy();
});

QUnit.test("Resolver receives base-bundle resolved text", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  KioskKeyboard.setI18nResolver((key, _locale, resolvedText) => {
    if (key === "KIOSK_KEYBOARD_LABEL") return resolvedText + " (custom)";
    if (key === "KEY_SHIFT") return resolvedText.toUpperCase();
    return undefined;
  });
  await waitForRender();

  const dom = kb.getDomRef();
  assert.ok(dom?.getAttribute("aria-label")?.endsWith("(custom)"), "Resolver receives and transforms base text");

  const shiftKey = getKeyElement(kb, "{shift}");
  assert.strictEqual(
    shiftKey?.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "SHIFT",
    "Resolver uppercases base-bundle shift label",
  );

  input.destroy();
  kb.destroy();
});

QUnit.test("Destroying last instance auto-clears resolver", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  KioskKeyboard.setI18nResolver(() => "Hooked");
  assert.strictEqual(getText("KEY_SHIFT", "Shift"), "Hooked", "Resolver active before destroy");

  input.destroy();
  kb.destroy();

  assert.strictEqual(getText("KEY_SHIFT", "Shift"), "Shift", "Resolver auto-cleared after last instance destroyed");

  // Verify cleared by rendering a fresh keyboard
  const input2 = new Input({ value: "" });
  input2.placeAt("qunit-fixture");
  const kb2 = new KioskKeyboard({ controls: [input2.getId()] });
  await placeAndWait(kb2);

  const shiftKey = getKeyElement(kb2, "{shift}");
  assert.strictEqual(
    shiftKey?.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "Shift",
    "Fresh keyboard uses default labels",
  );

  input2.destroy();
  kb2.destroy();
});

QUnit.test("Destroying one of two instances does NOT clear resolver", async (assert) => {
  const input1 = new Input({ value: "" });
  const input2 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");
  const kb1 = new KioskKeyboard({ controls: [input1.getId()] });
  const kb2 = new KioskKeyboard({ controls: [input2.getId()] });
  await placeAndWait(kb1);
  await placeAndWait(kb2);

  KioskKeyboard.setI18nResolver(() => "Hooked");

  input1.destroy();
  kb1.destroy();

  assert.strictEqual(
    getText("KEY_SHIFT", "Shift"),
    "Hooked",
    "Resolver still active after destroying one of two instances",
  );

  input2.destroy();
  kb2.destroy();

  assert.strictEqual(getText("KEY_SHIFT", "Shift"), "Shift", "Resolver cleared after last instance destroyed");
});

QUnit.test("Destroying last instance clears global target resolver", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  const fakeResolver = (el: HTMLElement) => el.querySelector<HTMLInputElement>("input");
  KioskKeyboard.setGlobalTargetResolver(fakeResolver);

  assert.strictEqual(KioskKeyboard.getGlobalTargetResolver(), fakeResolver, "Resolver set before destroy");

  input.destroy();
  kb.destroy();

  assert.strictEqual(
    KioskKeyboard.getGlobalTargetResolver(),
    null,
    "Resolver auto-cleared after last instance destroyed",
  );
});
