import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import { reloadBundles, getI18nConfiguration, hasConfiguredEnhancements } from "ui5/kiosk/internal/i18n-registry";
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

QUnit.test("Enhancement bundle + override hook combined on rendered control", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  // Enhancement bundle provides a custom label
  const fakeBundle = {
    getText(key: string) {
      const map: Record<string, string> = {
        KIOSK_KEYBOARD_LABEL: "Enhanced Label",
        KEY_SHIFT: "Umschalt",
      };
      return map[key] ?? null;
    },
  } as ResourceBundle;

  i18nSandbox.stub(ResourceBundle, "create").returns(Promise.resolve(fakeBundle) as never);

  await KioskKeyboard.configureI18n({
    enhanceWith: [{ bundleName: "test.combined" }],
  });
  await waitForRender();

  assert.strictEqual(kb.getDomRef()?.getAttribute("aria-label"), "Enhanced Label", "Enhancement applied");

  // Override hook further modifies the enhanced text
  KioskKeyboard.setI18nOverrideHook((ctx) => {
    if (ctx.key === "KIOSK_KEYBOARD_LABEL") {
      return ctx.resolvedText + " (hooked)";
    }
    if (ctx.key === "KEY_SHIFT") {
      return ctx.resolvedText.toUpperCase();
    }
    return undefined;
  });
  await waitForRender();

  assert.strictEqual(
    kb.getDomRef()?.getAttribute("aria-label"),
    "Enhanced Label (hooked)",
    "Hook receives enhanced text as resolvedText and further modifies it",
  );

  const shiftKey = kb.getDomRef()!.querySelector('[data-key="{shift}"]');
  assert.strictEqual(shiftKey?.getAttribute("aria-label"), "UMSCHALT", "Hook uppercases enhanced shift label");

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

QUnit.test("resetI18nConfiguration reverts rendered keyboard to base labels", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  const originalLabel = kb.getDomRef()?.getAttribute("aria-label");

  const fakeBundle = {
    getText(key: string) {
      if (key === "KIOSK_KEYBOARD_LABEL") return "Enhanced Label";
      return null;
    },
  } as ResourceBundle;

  i18nSandbox.stub(ResourceBundle, "create").returns(Promise.resolve(fakeBundle) as never);

  await KioskKeyboard.configureI18n({
    enhanceWith: [{ bundleName: "test.bundle" }],
  });
  await waitForRender();

  assert.strictEqual(kb.getDomRef()?.getAttribute("aria-label"), "Enhanced Label", "Enhanced label applied");

  KioskKeyboard.resetI18nConfiguration();
  await waitForRender();

  assert.strictEqual(
    kb.getDomRef()?.getAttribute("aria-label"),
    originalLabel,
    "Label reverts to base after resetI18nConfiguration",
  );

  input.destroy();
  kb.destroy();
});

QUnit.test("Destroying last instance auto-resets i18n config and hook", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  const fakeBundle = {
    getText(key: string) {
      if (key === "KIOSK_KEYBOARD_LABEL") return "Enhanced";
      return null;
    },
  } as ResourceBundle;

  i18nSandbox.stub(ResourceBundle, "create").returns(Promise.resolve(fakeBundle) as never);

  await KioskKeyboard.configureI18n({
    enhanceWith: [{ bundleName: "test.bundle" }],
  });
  KioskKeyboard.setI18nOverrideHook(() => "Hooked");

  assert.ok(hasConfiguredEnhancements(), "Enhancements active before destroy");
  assert.notStrictEqual(getI18nConfiguration(), null, "Config active before destroy");

  input.destroy();
  kb.destroy();

  assert.strictEqual(getI18nConfiguration(), null, "Config auto-cleared after last instance destroyed");
  assert.ok(!hasConfiguredEnhancements(), "Enhancements auto-cleared after last instance destroyed");
});

QUnit.test("Re-created instance works after auto-reset when configureI18n is re-applied", async (assert) => {
  // Phase 1: create, configure, destroy → triggers auto-reset
  const input1 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  const kb1 = new KioskKeyboard({ targetInput: input1 });
  await placeAndWait(kb1);

  const fakeBundle = {
    getText(key: string) {
      if (key === "KIOSK_KEYBOARD_LABEL") return "Enhanced";
      return null;
    },
  } as ResourceBundle;

  i18nSandbox.stub(ResourceBundle, "create").returns(Promise.resolve(fakeBundle) as never);

  await KioskKeyboard.configureI18n({
    enhanceWith: [{ bundleName: "test.bundle" }],
  });

  input1.destroy();
  kb1.destroy();

  assert.strictEqual(getI18nConfiguration(), null, "Config cleared after last instance destroyed");

  // Phase 2: re-create and re-configure
  const input2 = new Input({ value: "" });
  input2.placeAt("qunit-fixture");
  const kb2 = new KioskKeyboard({ targetInput: input2 });
  await placeAndWait(kb2);

  await KioskKeyboard.configureI18n({
    enhanceWith: [{ bundleName: "test.bundle" }],
  });
  await waitForRender();

  assert.strictEqual(
    kb2.getDomRef()?.getAttribute("aria-label"),
    "Enhanced",
    "Re-created instance picks up re-applied config",
  );

  input2.destroy();
  kb2.destroy();
});

QUnit.test("Destroying one of two instances does NOT auto-reset i18n", async (assert) => {
  const input1 = new Input({ value: "" });
  const input2 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");
  const kb1 = new KioskKeyboard({ targetInput: input1 });
  const kb2 = new KioskKeyboard({ targetInput: input2 });
  await placeAndWait(kb1);
  await placeAndWait(kb2);

  const fakeBundle = {
    getText(key: string) {
      if (key === "KIOSK_KEYBOARD_LABEL") return "Enhanced";
      return null;
    },
  } as ResourceBundle;

  i18nSandbox.stub(ResourceBundle, "create").returns(Promise.resolve(fakeBundle) as never);

  await KioskKeyboard.configureI18n({
    enhanceWith: [{ bundleName: "test.bundle" }],
  });
  KioskKeyboard.setI18nOverrideHook(() => "Hooked");

  // Destroy first instance — second still alive, so NO auto-reset
  input1.destroy();
  kb1.destroy();

  assert.ok(hasConfiguredEnhancements(), "Enhancements still active after destroying one of two instances");
  assert.notStrictEqual(getI18nConfiguration(), null, "Config still active after destroying one of two instances");

  // Destroy second instance — now auto-reset triggers
  input2.destroy();
  kb2.destroy();

  assert.strictEqual(getI18nConfiguration(), null, "Config auto-cleared after last instance destroyed");
  assert.ok(!hasConfiguredEnhancements(), "Enhancements auto-cleared after last instance destroyed");
});

QUnit.test("init() without i18n config does not spuriously invalidate existing instances", async (assert) => {
  // First keyboard, fully rendered
  const input1 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  const kb1 = new KioskKeyboard({ targetInput: input1 });
  await placeAndWait(kb1);

  // Spy on kb1's invalidate AFTER it's fully rendered
  const invalidateSpy = i18nSandbox.spy(kb1, "invalidate");

  // Create a second keyboard — no i18n enhancements configured
  const input2 = new Input({ value: "" });
  input2.placeAt("qunit-fixture");
  const kb2 = new KioskKeyboard({ targetInput: input2 });
  await placeAndWait(kb2);

  // Let any stale-reload microtasks settle
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.strictEqual(
    invalidateSpy.callCount,
    0,
    "Existing instance not spuriously invalidated when new keyboard inits without i18n config",
  );

  input1.destroy();
  kb1.destroy();
  input2.destroy();
  kb2.destroy();
});

QUnit.test("onLocalizationChanged triggers bundle reload and re-render", async (assert) => {
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

  // Simulate language change through the actual lifecycle hook
  bundleVersion = "v2";
  kb.onLocalizationChanged();
  // Wait for the async reload + re-render triggered by the hook
  await reloadBundles();
  await waitForRender();

  assert.strictEqual(
    kb.getDomRef()?.getAttribute("aria-label"),
    "Label-v2",
    "Label updated after onLocalizationChanged",
  );

  input.destroy();
  kb.destroy();
});
