import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { LayoutDefinition } from "ui5/kiosk/types";
import Input from "sap/m/Input";
import Localization from "sap/base/i18n/Localization";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import {
  createFakeKeyElement,
  getKeyElements,
  getRenderedLayoutKeys,
  getRowElements,
  getRowKeyValues,
  hasKeyboardClass,
  placeAndWait,
  simulateTap,
  tapKey,
  waitForRender,
} from "./test-helpers";

const DOM = KioskKeyboard.DOM;

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

QUnit.module("KioskKeyboard layout management", {
  afterEach() {
    KioskKeyboard.resetCustomLayouts();
    KioskKeyboard.resetLocaleLayouts();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// Layout resolution
// ──────────────────────────────────────────────

QUnit.test("Default layout renders QWERTY", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 5, "QWERTY has 5 rows");
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "1", "First key in number row is 1");
  kb.destroy();
});

QUnit.test("KeyboardType 'Numpad' renders numpad keys", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType("Numpad");
  await placeAndWait(kb);
  const rows = getRowElements(kb);
  assert.ok(rows.length <= 5, "Numpad has reasonable row count");
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "7", "Numpad starts with 7");
  kb.destroy();
});

QUnit.test("KeyboardType 'Numpad' renders numpad layout", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType("Numpad");
  await placeAndWait(kb);

  assert.ok(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "Has numpad CSS class");

  const keys = getKeyElements(kb);
  assert.ok(keys.length > 0, "Numpad keys rendered");

  const keyValues = Array.from(keys).map((k) => k.dataset.key);
  assert.notOk(keyValues.includes("q"), "No alphabetic keys in numpad");
  assert.ok(keyValues.includes("7"), "Numpad has 7");
  assert.ok(keyValues.includes("0"), "Numpad has 0");

  kb.destroy();
});

QUnit.test("Layout property switches full keyboard layout", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("numeric");
  await placeAndWait(kb);

  const firstKey = getRowKeyValues(kb, 0)[0];
  assert.strictEqual(firstKey, "1", "Numeric layout starts with 1");
  const allValues = getRenderedLayoutKeys(kb).flat();
  assert.notOk(allValues.includes("q"), "Numeric layout has no alphabetic keys");

  kb.destroy();
});

QUnit.test("KeyboardType 'Numeric' has numeric CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType("Numeric");
  await placeAndWait(kb);

  assert.ok(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numeric")), "Has numeric CSS class");
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "No numpad class");

  kb.destroy();
});

QUnit.test("Full keyboardType has no type-specific CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "No numpad class on Full");
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numeric")), "No numeric class on Full");

  kb.destroy();
});

QUnit.test("setLayout with unregistered name is ignored and keeps current layout", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const before = kb.getLayout();
  kb.setLayout("nonexistent-layout");

  assert.strictEqual(kb.getLayout(), before, "getLayout() still returns the previous layout");
  const firstKey = getRowKeyValues(kb, 0)[0];
  assert.strictEqual(firstKey, "1", "QWERTY layout still rendered (number row starts with 1)");
  assert.strictEqual(getRowElements(kb).length, 5, "QWERTY layout has 5 rows");

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("q"), "QWERTY keys rendered - unregistered name had no effect");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Layout switching
// ──────────────────────────────────────────────

QUnit.test("Layout switch fires layoutChange event", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const done = assert.async();
  kb.attachEvent("layoutChange", (event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("layout"), "numeric", "Layout changed to numeric");
    done();
  });

  tapKey(kb, "{layout:numeric}");
  kb.destroy();
});

QUnit.test("Layout switch updates rendered keys", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Initially QWERTY - has alphabetic keys
  let keys = getKeyElements(kb);
  const initialKeyValues = Array.from(keys).map((k) => k.dataset.key);
  assert.ok(initialKeyValues.includes("q"), "QWERTY has 'q' key");

  // Switch to numeric
  tapKey(kb, "{layout:numeric}");

  // Wait for re-render
  await waitForRender();

  keys = getKeyElements(kb);
  const numericKeyValues = Array.from(keys).map((k) => k.dataset.key);
  assert.notOk(numericKeyValues.includes("q"), "Numeric layout has no 'q' key");

  kb.destroy();
});

QUnit.test("Layout switch ignored when keyboardType is Numpad", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType("Numpad");
  await placeAndWait(kb);

  let layoutChanged = false;
  kb.attachEvent("layoutChange", () => {
    layoutChanged = true;
  });

  // Create a fake layout switch key and tap it
  const fakeEl = createFakeKeyElement("{layout:numeric}", "fake-layout");

  simulateTap(kb, fakeEl);

  assert.notOk(layoutChanged, "Layout switch ignored in Numpad mode");

  kb.destroy();
});

QUnit.test("Layout switch does not fire layoutChange for invalid or unchanged layout", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const initialLayout = kb.getLayout();
  let changeCount = 0;
  kb.attachEvent("layoutChange", () => {
    changeCount++;
  });

  const invalidLayoutEl = createFakeKeyElement("{layout:not-registered}", "fake-layout-invalid");
  simulateTap(kb, invalidLayoutEl);

  const sameLayoutEl = createFakeKeyElement(`{layout:${initialLayout}}`, "fake-layout-same");
  simulateTap(kb, sameLayoutEl);

  assert.strictEqual(changeCount, 0, "No layoutChange event for invalid or unchanged layout");
  assert.strictEqual(kb.getLayout(), initialLayout, "Layout remains unchanged");

  kb.destroy();
});

// ──────────────────────────────────────────────
// German QWERTZ layout
// ──────────────────────────────────────────────

QUnit.test("QWERTZ-DE layout resolves correctly", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 5, "QWERTZ-DE has 5 rows");

  const row2Values = getRowKeyValues(kb, 1);
  assert.ok(row2Values.includes("z"), "Row 2 contains 'z' (QWERTZ arrangement)");
  assert.notOk(row2Values.includes("y"), "Row 2 does not contain 'y'");

  assert.ok(row2Values.includes("\u00FC"), "Row 2 contains \u00FC");
  const row3Values = getRowKeyValues(kb, 2);
  assert.ok(row3Values.includes("\u00F6"), "Row 3 contains \u00F6");
  assert.ok(row3Values.includes("\u00E4"), "Row 3 contains \u00E4");

  const row4Values = getRowKeyValues(kb, 3);
  assert.ok(row4Values.includes("\u00DF"), "Row 4 contains \u00DF");

  kb.destroy();
});

QUnit.test("QWERTZ-DE renders correctly", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("z"), "Has z key");
  assert.ok(keys.includes("\u00FC"), "Has \u00FC key");
  assert.ok(keys.includes("\u00F6"), "Has \u00F6 key");
  assert.ok(keys.includes("\u00E4"), "Has \u00E4 key");
  assert.ok(keys.includes("\u00DF"), "Has \u00DF key");
  assert.notOk(keys.includes("y") && keys.indexOf("y") < keys.indexOf("z"), "Y not before Z (QWERTZ)");

  kb.destroy();
});

QUnit.test("QWERTZ-DE German number row shift symbols", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  kb.setTargetInput(input);
  await nextUIUpdate();

  // Shift+2 should produce " (double quote) in German layout
  tapKey(kb, "{shift}");

  const done = assert.async();
  kb.attachEvent("keyPress", (event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("key"), '"', 'Shift+2 produces " in German layout');
    done();
  });

  tapKey(kb, "2");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Base layout tracking ({layout:base})
// ──────────────────────────────────────────────

QUnit.test("Switching to numeric and back returns to base layout", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  // Switch to numeric
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "numeric", "Layout is now numeric");

  // Switch back via ABC (which uses {layout:base})
  tapKey(kb, "{layout:base}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "qwertz-de", "Layout returned to qwertz-de (not qwerty)");

  // Verify QWERTZ keys are present
  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("z"), "QWERTZ z key is back");
  assert.ok(keys.includes("\u00FC"), "\u00FC is back");

  kb.destroy();
});

QUnit.test("Base layout defaults to qwerty", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Switch to numeric
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  // Switch back via ABC ({layout:base})
  tapKey(kb, "{layout:base}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "qwerty", "Default base layout is qwerty");

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("q"), "QWERTY q key is present");

  kb.destroy();
});

QUnit.test("getBaseLayout tracks last non-secondary layout", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(kb.getBaseLayout(), "qwerty", "Initial base layout is qwerty");

  kb.setLayout("qwertz-de");
  assert.strictEqual(kb.getBaseLayout(), "qwertz-de", "Base updates on non-secondary layout");

  kb.setLayout("numeric");
  assert.strictEqual(kb.getBaseLayout(), "qwertz-de", "Base is preserved when switching to secondary layout");

  kb.destroy();
});

QUnit.test("resetLayout returns from secondary layout to base", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  kb.setLayout("numeric");
  assert.strictEqual(kb.getLayout(), "numeric", "Secondary layout is active before reset");

  kb.resetLayout();
  assert.strictEqual(kb.getLayout(), "qwertz-de", "resetLayout restores the tracked base layout");

  kb.destroy();
});

QUnit.test("Base layout roundtrip: qwertz-de -> numeric -> special -> base", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  // Go to numeric
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  // Go to special from numeric
  tapKey(kb, "{layout:special}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "special", "Now on special layout");

  // Go back via ABC ({layout:base})
  tapKey(kb, "{layout:base}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "qwertz-de", "Returned to qwertz-de after special");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Custom layout registration (registerLayout)
// ──────────────────────────────────────────────

QUnit.test("registerLayout registers a custom layout usable by name", async (assert) => {
  // Register a minimal custom layout
  KioskKeyboard.registerLayout("test-custom", [[{ value: "x" }, { value: "y" }, { value: "z" }]]);

  const kb = new KioskKeyboard();
  kb.setLayout("test-custom");
  await placeAndWait(kb);

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.deepEqual(keys, ["x", "y", "z"], "Custom layout keys rendered");

  kb.destroy();
});

QUnit.test("getRegisteredLayout retrieves a registered layout", (assert) => {
  const custom = [[{ value: "a" }, { value: "b" }]];
  KioskKeyboard.registerLayout("test-retrieve", custom);

  const retrieved = KioskKeyboard.getRegisteredLayout("test-retrieve");
  assert.deepEqual(retrieved, custom, "Retrieved layout matches registered definition");

  assert.strictEqual(
    KioskKeyboard.getRegisteredLayout("nonexistent"),
    undefined,
    "Returns undefined for unregistered layout",
  );
});

QUnit.test("Custom layout works as base layout for {layout:base} roundtrip", async (assert) => {
  KioskKeyboard.registerLayout("test-roundtrip", [
    [
      { value: "m" },
      { value: "n" },
      {
        value: "{layout:numeric}",
        label: "123",
        type: "modifier",
      },
    ],
  ]);

  const kb = new KioskKeyboard();
  kb.setLayout("test-roundtrip");
  await placeAndWait(kb);

  // Switch to numeric
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "numeric", "On numeric now");

  // Switch back via {layout:base}
  tapKey(kb, "{layout:base}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "test-roundtrip", "Returned to custom layout");

  kb.destroy();
});

QUnit.test("registerLayout rejects overwrite of built-in layout", (assert) => {
  const original = KioskKeyboard.getRegisteredLayout("qwerty");
  assert.ok(original, "qwerty exists before overwrite attempt");

  // Attempt to overwrite built-in
  KioskKeyboard.registerLayout("qwerty", [[{ value: "HACKED" }]]);

  // Should still be the original
  const after = KioskKeyboard.getRegisteredLayout("qwerty");
  assert.deepEqual(after, original, "Built-in qwerty layout was NOT overwritten");
});

QUnit.test("unregisterLayout removes a custom layout", (assert) => {
  KioskKeyboard.registerLayout("test-remove-custom", [[{ value: "x" }]]);
  assert.ok(KioskKeyboard.getRegisteredLayout("test-remove-custom"), "Custom layout exists before removal");

  KioskKeyboard.unregisterLayout("test-remove-custom");

  assert.strictEqual(
    KioskKeyboard.getRegisteredLayout("test-remove-custom"),
    undefined,
    "Custom layout removed successfully",
  );
});

QUnit.test("unregisterLayout keeps built-in layout intact", (assert) => {
  const before = KioskKeyboard.getRegisteredLayout("qwerty");

  KioskKeyboard.unregisterLayout("qwerty");

  const after = KioskKeyboard.getRegisteredLayout("qwerty");
  assert.deepEqual(after, before, "Built-in layout cannot be removed");
});

QUnit.test("resetCustomLayouts removes all custom layouts", (assert) => {
  KioskKeyboard.registerLayout("test-reset-custom-a", [[{ value: "a" }]]);
  KioskKeyboard.registerLayout("test-reset-custom-b", [[{ value: "b" }]]);
  assert.ok(KioskKeyboard.getRegisteredLayout("test-reset-custom-a"), "First custom layout registered");
  assert.ok(KioskKeyboard.getRegisteredLayout("test-reset-custom-b"), "Second custom layout registered");

  KioskKeyboard.resetCustomLayouts();

  assert.strictEqual(
    KioskKeyboard.getRegisteredLayout("test-reset-custom-a"),
    undefined,
    "First custom layout removed",
  );
  assert.strictEqual(
    KioskKeyboard.getRegisteredLayout("test-reset-custom-b"),
    undefined,
    "Second custom layout removed",
  );
  assert.ok(KioskKeyboard.getRegisteredLayout("qwerty"), "Built-in layout remains available");
});

QUnit.test("registerLayout accepts formerly forbidden map keys (Map-safe)", (assert) => {
  for (const name of ["__proto__", "prototype", "constructor"]) {
    const layout: LayoutDefinition = [[{ value: "x" }]];
    KioskKeyboard.registerLayout(name, layout);
    assert.deepEqual(KioskKeyboard.getRegisteredLayout(name), layout, `Key "${name}" is accepted`);
  }

  const names = KioskKeyboard.getRegisteredLayoutNames();
  assert.ok(names.includes("__proto__"), "__proto__ is listed");
  assert.ok(names.includes("prototype"), "prototype is listed");
  assert.ok(names.includes("constructor"), "constructor is listed");
});

// ──────────────────────────────────────────────
// Locale-based default layout
// ──────────────────────────────────────────────

QUnit.test("getLocaleLayout returns layout based on UI5 locale", (assert) => {
  // The actual result depends on the test runner's language setting,
  // but the method should always return a string
  const layout = KioskKeyboard.getLocaleLayout();
  assert.strictEqual(typeof layout, "string", "getLocaleLayout returns a string");
  assert.ok(layout.length > 0, "Layout name is non-empty");
});

QUnit.test("getLocaleLayout returns qwertz-de for German locale", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "German locale maps to qwertz-de");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("getLocaleLayout returns qwerty for English locale", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("en");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwerty", "English locale maps to qwerty");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("getLocaleLayout resolves ja to ja-romaji", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("ja");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "ja-romaji", "Japanese resolves to ja-romaji");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("getLocaleLayout resolves ar to arabic", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("ar");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "arabic", "Arabic resolves to arabic");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("getLocaleLayout falls back to qwerty for unmapped locale", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("zh");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwerty", "Chinese (unmapped) falls back to qwerty");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("registerLocaleLayout extends the locale map", (assert) => {
  const currentLang = Localization.getLanguage();
  KioskKeyboard.registerLayout("test-locale-layout", [[{ value: "x" }]]);
  KioskKeyboard.registerLocaleLayout("xx", "test-locale-layout");

  try {
    Localization.setLanguage("xx");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "test-locale-layout", "Custom locale maps to custom layout");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("unregisterLocaleLayout removes custom locale mapping", (assert) => {
  const currentLang = Localization.getLanguage();
  KioskKeyboard.registerLayout("test-locale-remove-layout", [[{ value: "x" }]]);
  KioskKeyboard.registerLocaleLayout("xy", "test-locale-remove-layout");

  try {
    Localization.setLanguage("xy");
    assert.strictEqual(
      KioskKeyboard.getLocaleLayout(),
      "test-locale-remove-layout",
      "Custom locale mapping is active before removal",
    );

    KioskKeyboard.unregisterLocaleLayout("xy");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwerty", "Locale mapping removed and fallback is used");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("resetLocaleLayouts restores built-in locale mappings", (assert) => {
  const currentLang = Localization.getLanguage();
  KioskKeyboard.registerLayout("test-reset-locale-layout", [[{ value: "x" }]]);
  KioskKeyboard.registerLocaleLayout("yy", "test-reset-locale-layout");

  try {
    Localization.setLanguage("yy");
    assert.strictEqual(
      KioskKeyboard.getLocaleLayout(),
      "test-reset-locale-layout",
      "Custom mapping active before reset",
    );

    KioskKeyboard.resetLocaleLayouts();

    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwerty", "Custom mapping removed after reset");

    Localization.setLanguage("de");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "Built-in locale mapping restored after reset");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("registerLocaleLayout accepts formerly forbidden locale keys (Map-safe)", (assert) => {
  const localization = Localization as unknown as {
    getLanguageTag: () => { language: string; region?: string | null };
  };
  const originalGetLanguageTag = localization.getLanguageTag;

  for (const locale of ["__proto__", "prototype", "constructor"]) {
    KioskKeyboard.registerLocaleLayout(locale, "qwertz-de");
  }

  try {
    localization.getLanguageTag = () => ({ language: "__proto__", region: undefined });
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "Locale key __proto__ resolves correctly");

    localization.getLanguageTag = () => ({ language: "prototype", region: undefined });
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "Locale key prototype resolves correctly");

    localization.getLanguageTag = () => ({ language: "constructor", region: undefined });
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "Locale key constructor resolves correctly");
  } finally {
    localization.getLanguageTag = originalGetLanguageTag;
  }
});

QUnit.test("Unknown locale mapping falls back to default layout", (assert) => {
  const currentLang = Localization.getLanguage();
  KioskKeyboard.registerLocaleLayout("zz", "layout-does-not-exist");

  try {
    Localization.setLanguage("zz");
    assert.strictEqual(
      KioskKeyboard.getLocaleLayout(),
      "qwerty",
      "Unknown layout mapping falls back to default layout",
    );
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("Unknown exact locale mapping falls back to valid language prefix", (assert) => {
  const currentLang = Localization.getLanguage();
  KioskKeyboard.registerLocaleLayout("de-ch", "layout-does-not-exist");

  try {
    Localization.setLanguage("de-CH");
    assert.strictEqual(
      KioskKeyboard.getLocaleLayout(),
      "qwertz-de",
      "Invalid exact de-ch mapping falls back to valid de prefix mapping",
    );
  } finally {
    Localization.setLanguage(currentLang);
  }
});

// ──────────────────────────────────────────────
// ja-kana layout
// ──────────────────────────────────────────────

QUnit.test("ja-kana layout renders 5 rows with correct key counts", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 5, "ja-kana has 5 rows");
  assert.strictEqual(getRowKeyValues(kb, 0).length, 12, "Row 1 has 12 keys");
  assert.strictEqual(getRowKeyValues(kb, 1).length, 12, "Row 2 has 12 keys");
  assert.strictEqual(getRowKeyValues(kb, 2).length, 12, "Row 3 has 12 keys");
  assert.strictEqual(getRowKeyValues(kb, 3).length, 12, "Row 4 has 12 keys");
  assert.strictEqual(getRowKeyValues(kb, 4).length, 6, "Row 5 has 6 keys");
  kb.destroy();
});

QUnit.test("ja-kana first key is ぬ (hiragana nu)", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "\u306C", "First key is ぬ");
  kb.destroy();
});

QUnit.test("ja-kana has dakuten and handakuten on base layer", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  const allKeys = getRowKeyValues(kb, 1);
  assert.ok(allKeys.includes("\u309B"), "Row 2 contains dakuten ゛");
  assert.ok(allKeys.includes("\u309C"), "Row 2 contains handakuten ゜");
  kb.destroy();
});

QUnit.test("ja-kana has layout toggle to ja-romaji", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  const row5Keys = getRowKeyValues(kb, 4);
  assert.ok(row5Keys.includes("{layout:ja-romaji}"), "Row 5 contains ja-romaji toggle");
  kb.destroy();
});

QUnit.test("ja-kana: all base values are hiragana, special keys, or punctuation", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  const hiraganaRange = /^[\u3040-\u309F]$/;
  const specialKeys = new Set(["{backspace}", "{enter}", "{shift}", " "]);
  const punctuation = new Set(["\u309B", "\u309C", "\u30FC", "\u3002"]);
  const layoutKeys = new Set(["{layout:numeric}", "{layout:ja-romaji}", "{layout:fkeys}"]);

  for (let r = 0; r < 5; r++) {
    for (const val of getRowKeyValues(kb, r)) {
      const isValid = hiraganaRange.test(val) || specialKeys.has(val) || punctuation.has(val) || layoutKeys.has(val);
      assert.ok(isValid, `key "${val}" (U+${val.codePointAt(0)?.toString(16)}) is valid`);
    }
  }
  kb.destroy();
});

QUnit.test("ja-kana: small kana shift variants on correct keys", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();

  const row1Shifted = getRowKeyValues(kb, 0);
  assert.ok(row1Shifted.includes("\u3041"), "Row 1 shifted contains \u3041");
  assert.ok(row1Shifted.includes("\u3045"), "Row 1 shifted contains \u3045");
  assert.ok(row1Shifted.includes("\u3047"), "Row 1 shifted contains \u3047");
  assert.ok(row1Shifted.includes("\u3049"), "Row 1 shifted contains \u3049");
  assert.ok(row1Shifted.includes("\u3083"), "Row 1 shifted contains \u3083");
  assert.ok(row1Shifted.includes("\u3085"), "Row 1 shifted contains \u3085");
  assert.ok(row1Shifted.includes("\u3087"), "Row 1 shifted contains \u3087");
  assert.ok(row1Shifted.includes("\u3092"), "Row 1 shifted contains \u3092");

  const row2Shifted = getRowKeyValues(kb, 1);
  assert.ok(row2Shifted.includes("\u3043"), "Row 2 shifted contains \u3043");

  const row4Shifted = getRowKeyValues(kb, 3);
  assert.ok(row4Shifted.includes("\u3063"), "Row 4 shifted contains \u3063");

  kb.destroy();
});

QUnit.test("ja-kana: row 4 punctuation shift variants", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();

  const row4 = getRowKeyValues(kb, 3);
  assert.ok(row4.includes("\u3001"), "Shifted row 4 contains \u3001");
  assert.ok(row4.includes("\u3002"), "Shifted row 4 contains \u3002");
  assert.ok(row4.includes("\u30FB"), "Shifted row 4 contains \u30FB");

  kb.destroy();
});

QUnit.test("ja-kana: backspace, enter, shift, space have correct types", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);

  const allKeys = Array.from(getKeyElements(kb));
  const backspace = allKeys.find((el) => el.dataset.key === "{backspace}");
  const enter = allKeys.find((el) => el.dataset.key === "{enter}");
  const shift = allKeys.find((el) => el.dataset.key === "{shift}");
  const space = allKeys.find((el) => el.dataset.key === " ");

  assert.ok(backspace?.classList.contains(DOM.classes.keyAction), "Backspace has action type");
  assert.ok(enter?.classList.contains(DOM.classes.keyAction), "Enter has action type");
  assert.ok(shift?.classList.contains(DOM.classes.keyModifier), "Shift has modifier type");
  assert.ok(space?.classList.contains(DOM.classes.keySpace), "Space has space type");

  kb.destroy();
});

QUnit.test("applySettings injects locale layout when no explicit layout", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");
    const kb = new KioskKeyboard();
    assert.strictEqual(kb.getLayout(), "qwertz-de", "Locale layout injected automatically");
    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("Explicit layout overrides locale detection", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");
    const kb = new KioskKeyboard({ layout: "qwerty" });
    assert.strictEqual(kb.getLayout(), "qwerty", "Explicit layout takes priority over locale");
    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("getLocaleLayout matches language prefix for regional variant", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    // de-AT has no exact entry, should fall through to "de" → "qwertz-de"
    Localization.setLanguage("de-AT");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "de-AT falls back to de prefix");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("registerLocaleLayout exact region match takes priority over prefix", (assert) => {
  const currentLang = Localization.getLanguage();
  KioskKeyboard.registerLayout("test-de-at", [[{ value: "a" }]]);
  KioskKeyboard.registerLocaleLayout("de-at", "test-de-at");

  try {
    Localization.setLanguage("de-AT");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "test-de-at", "Exact de-at match wins over de prefix");

    // de (no region) still uses the prefix match
    Localization.setLanguage("de");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "de without region still maps to qwertz-de");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("Locale layout used as base layout for {layout:base} roundtrip", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");

    const kb = new KioskKeyboard();
    assert.strictEqual(kb.getLayout(), "qwertz-de", "Starts with locale layout");
    await placeAndWait(kb);

    // Switch to numeric
    tapKey(kb, "{layout:numeric}");
    await waitForRender();
    assert.strictEqual(kb.getLayout(), "numeric", "Switched to numeric");

    // Switch back via {layout:base}
    tapKey(kb, "{layout:base}");
    await waitForRender();
    assert.strictEqual(kb.getLayout(), "qwertz-de", "Returned to locale-detected qwertz-de");

    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("Locale layout renders correct keys", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");

    const kb = new KioskKeyboard();
    await placeAndWait(kb);

    const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.ok(keys.includes("z"), "German locale keyboard has z key (QWERTZ)");
    assert.ok(keys.includes("\u00FC"), "German locale keyboard has \u00FC key");

    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

// ──────────────────────────────────────────────
// Static API: getRegisteredLayoutNames / isBuiltInLayout
// ──────────────────────────────────────────────

QUnit.test("getRegisteredLayoutNames returns all built-in layouts", (assert) => {
  const names = KioskKeyboard.getRegisteredLayoutNames();
  assert.ok(names.includes("qwerty"), "Contains qwerty");
  assert.ok(names.includes("qwertz-de"), "Contains qwertz-de");
  assert.ok(names.includes("numeric"), "Contains numeric");
  assert.ok(names.includes("special"), "Contains special");
  assert.ok(names.includes("numpad"), "Contains numpad");
});

QUnit.test("getRegisteredLayoutNames includes custom layouts", (assert) => {
  KioskKeyboard.registerLayout("test-names-check", [[{ value: "z" }]]);
  const names = KioskKeyboard.getRegisteredLayoutNames();
  assert.ok(names.includes("test-names-check"), "Custom layout appears in list");
});

QUnit.test("isBuiltInLayout returns true for built-in layouts", (assert) => {
  assert.ok(KioskKeyboard.isBuiltInLayout("qwerty"), "qwerty is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("qwertz-de"), "qwertz-de is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("numeric"), "numeric is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("special"), "special is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("numpad"), "numpad is built-in");
});

QUnit.test("isBuiltInLayout returns false for custom layouts", (assert) => {
  KioskKeyboard.registerLayout("test-builtin-check", [[{ value: "a" }]]);
  assert.notOk(KioskKeyboard.isBuiltInLayout("test-builtin-check"), "Custom layout is not built-in");
  assert.notOk(KioskKeyboard.isBuiltInLayout("nonexistent"), "Nonexistent layout is not built-in");
});

// ──────────────────────────────────────────────
// registerLayout validation
// ──────────────────────────────────────────────

QUnit.test("registerLayout rejects non-array definition", (assert) => {
  KioskKeyboard.registerLayout("test-invalid-1", "not-an-array" as never);
  assert.strictEqual(KioskKeyboard.getRegisteredLayout("test-invalid-1"), undefined, "Non-array definition rejected");
});

QUnit.test("registerLayout rejects empty array", (assert) => {
  KioskKeyboard.registerLayout("test-invalid-2", []);
  assert.strictEqual(KioskKeyboard.getRegisteredLayout("test-invalid-2"), undefined, "Empty array rejected");
});

QUnit.test("registerLayout rejects row with empty array", (assert) => {
  KioskKeyboard.registerLayout("test-invalid-3", [[]]);
  assert.strictEqual(KioskKeyboard.getRegisteredLayout("test-invalid-3"), undefined, "Empty row rejected");
});

QUnit.test("registerLayout rejects key without value property", (assert) => {
  KioskKeyboard.registerLayout("test-invalid-4", [[{ label: "x" } as never]]);
  assert.strictEqual(KioskKeyboard.getRegisteredLayout("test-invalid-4"), undefined, "Key without value rejected");
});

QUnit.test("registerLayout rejects key with non-string value", (assert) => {
  KioskKeyboard.registerLayout("test-invalid-5", [[{ value: 123 } as never]]);
  assert.strictEqual(KioskKeyboard.getRegisteredLayout("test-invalid-5"), undefined, "Key with numeric value rejected");
});

QUnit.test("registerLayout keeps existing custom layout when re-registration payload is invalid", (assert) => {
  const layoutName = "test-invalid-overwrite-guard";
  const originalLayout = [[{ value: "a" }, { value: "b" }]];

  KioskKeyboard.registerLayout(layoutName, originalLayout);
  assert.deepEqual(KioskKeyboard.getRegisteredLayout(layoutName), originalLayout, "Initial custom layout registered");

  KioskKeyboard.registerLayout(layoutName, [[{ value: "x" }], []]);
  assert.deepEqual(
    KioskKeyboard.getRegisteredLayout(layoutName),
    originalLayout,
    "Invalid re-registration does not clobber existing custom layout",
  );
});

QUnit.test("layout registry APIs handle non-string arguments safely", (assert) => {
  KioskKeyboard.registerLayout(123 as never, [[{ value: "x" }]]);
  KioskKeyboard.unregisterLayout(123 as never);

  assert.strictEqual(
    KioskKeyboard.getRegisteredLayout(123 as never),
    undefined,
    "getRegisteredLayout returns undefined for non-string names",
  );
  assert.notOk(KioskKeyboard.isBuiltInLayout(123 as never), "isBuiltInLayout returns false for non-string names");
  assert.ok(KioskKeyboard.getRegisteredLayout("qwerty"), "Built-in layouts remain intact after invalid calls");
});

QUnit.test("locale registry APIs handle non-string arguments safely", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    KioskKeyboard.registerLocaleLayout(123 as never, "qwertz-de");
    KioskKeyboard.registerLocaleLayout("de", 123 as never);
    KioskKeyboard.unregisterLocaleLayout(123 as never);

    Localization.setLanguage("de");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "Built-in locale mapping remains intact");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

// ──────────────────────────────────────────────
// Cross-Layout Special Char Consistency
// ──────────────────────────────────────────────

QUnit.test("Numeric layout keys identical regardless of base layout (qwerty vs qwertz-de)", async (assert) => {
  const kbQwerty = new KioskKeyboard({ layout: "qwerty", keyboardType: "Numeric" });
  const kbQwertz = new KioskKeyboard({ layout: "qwertz-de", keyboardType: "Numeric" });
  await placeAndWait(kbQwerty);
  kbQwertz.placeAt("qunit-fixture");
  await waitForRender();

  const keysQwerty = Array.from(getKeyElements(kbQwerty)).map((el) => el.dataset.key);
  const keysQwertz = Array.from(getKeyElements(kbQwertz)).map((el) => el.dataset.key);

  assert.deepEqual(keysQwerty, keysQwertz, "Same key values in same order");

  kbQwerty.destroy();
  kbQwertz.destroy();
});
