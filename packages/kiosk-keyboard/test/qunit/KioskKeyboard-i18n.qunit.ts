import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import { reloadBundles } from "ui5/kiosk/internal/i18n-registry";
import { placeAndWait, waitForRender } from "./test-helpers";

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

const i18nSandbox = sinon.createSandbox();

QUnit.module("KioskKeyboard — i18n integration", {
  afterEach() {
    i18nSandbox.restore();
    KioskKeyboard.resetI18nConfiguration();
    KioskKeyboard.clearI18nOverrideHook();
    KioskKeyboard.resetCustomLayouts();
    KioskKeyboard.resetLocaleLayouts();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Override hook can change KIOSK_KEYBOARD_LABEL on rendered control", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  KioskKeyboard.setI18nOverrideHook((ctx) => {
    if (ctx.key === "KIOSK_KEYBOARD_LABEL") {
      return "Custom Keyboard Label";
    }
    return undefined;
  });
  await waitForRender();

  const dom = kb.getDomRef();
  assert.ok(dom, "Keyboard is rendered");
  const ariaLabel = dom?.getAttribute("aria-label");
  assert.strictEqual(ariaLabel, "Custom Keyboard Label", "aria-label reflects override hook");

  input.destroy();
  kb.destroy();
});

QUnit.test("Clearing hook restores non-overridden behaviour", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  const originalLabel = kb.getDomRef()?.getAttribute("aria-label");

  KioskKeyboard.setI18nOverrideHook((ctx) => {
    if (ctx.key === "KIOSK_KEYBOARD_LABEL") return "Overridden";
    return undefined;
  });
  await waitForRender();

  assert.strictEqual(kb.getDomRef()?.getAttribute("aria-label"), "Overridden", "Hook applied");

  KioskKeyboard.clearI18nOverrideHook();
  await waitForRender();

  assert.strictEqual(kb.getDomRef()?.getAttribute("aria-label"), originalLabel, "Original label restored");

  input.destroy();
  kb.destroy();
});

QUnit.test("Enhancement bundle updates aria-label and aria-roledescription", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  const fakeBundle = {
    getText(key: string) {
      const map: Record<string, string> = {
        KIOSK_KEYBOARD_LABEL: "Custom Label",
        KIOSK_KEYBOARD_ROLEDESCRIPTION: "custom-role",
      };
      return map[key] ?? null;
    },
  } as ResourceBundle;

  i18nSandbox.stub(ResourceBundle, "create").returns(Promise.resolve(fakeBundle) as never);

  await KioskKeyboard.configureI18n({
    enhanceWith: [{ bundleName: "test.bundle" }],
  });
  await waitForRender();

  const dom = kb.getDomRef();
  assert.strictEqual(dom?.getAttribute("aria-label"), "Custom Label", "aria-label reflects enhancement");
  assert.strictEqual(
    dom?.getAttribute("aria-roledescription"),
    "custom-role",
    "aria-roledescription reflects enhancement",
  );

  input.destroy();
  kb.destroy();
});

QUnit.test("Special key labels reflect enhancement text", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  const fakeBundle = {
    getText(key: string) {
      const map: Record<string, string> = {
        KEY_SHIFT: "Umschalt",
        KEY_ENTER: "Eingabe",
        KEY_BACKSPACE: "L\u00F6schen",
      };
      return map[key] ?? null;
    },
  } as ResourceBundle;

  i18nSandbox.stub(ResourceBundle, "create").returns(Promise.resolve(fakeBundle) as never);

  await KioskKeyboard.configureI18n({
    enhanceWith: [{ bundleName: "test.keys" }],
  });
  await waitForRender();

  const dom = kb.getDomRef()!;
  const shiftKey = dom.querySelector('[data-key="{shift}"]');
  const enterKey = dom.querySelector('[data-key="{enter}"]');
  const backspaceKey = dom.querySelector('[data-key="{backspace}"]');

  assert.strictEqual(shiftKey?.getAttribute("aria-label"), "Umschalt", "Shift key label enhanced");
  assert.strictEqual(enterKey?.getAttribute("aria-label"), "Eingabe", "Enter key label enhanced");
  assert.strictEqual(backspaceKey?.getAttribute("aria-label"), "L\u00F6schen", "Backspace key label enhanced");

  input.destroy();
  kb.destroy();
});

QUnit.test("Language switch re-renders with updated labels", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  let bundleVersion = "v1";
  const fakeBundle = {
    getText(key: string) {
      if (key === "KIOSK_KEYBOARD_LABEL") return `Label-${bundleVersion}`;
      return null;
    },
  } as ResourceBundle;

  i18nSandbox.stub(ResourceBundle, "create").returns(Promise.resolve(fakeBundle) as never);

  await KioskKeyboard.configureI18n({
    enhanceWith: [{ bundleName: "test.locale" }],
  });
  await waitForRender();

  assert.strictEqual(kb.getDomRef()?.getAttribute("aria-label"), "Label-v1", "Initial enhanced label");

  // Simulate language change — reload bundles deterministically
  bundleVersion = "v2";
  await reloadBundles();
  kb.invalidate();
  await waitForRender();

  assert.strictEqual(kb.getDomRef()?.getAttribute("aria-label"), "Label-v2", "Label updated after locale change");

  input.destroy();
  kb.destroy();
});
