import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { KeyboardType } from "ui5/kiosk/library";
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
  kb.setKeyboardType(KeyboardType.Numpad);
  await placeAndWait(kb);
  const rows = getRowElements(kb);
  assert.ok(rows.length <= 5, "Numpad has reasonable row count");
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "7", "Numpad starts with 7");
  kb.destroy();
});

QUnit.test("KeyboardType 'Numpad' renders numpad layout", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType(KeyboardType.Numpad);
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
  kb.setKeyboardType(KeyboardType.Numeric);
  await placeAndWait(kb);

  assert.ok(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numeric")), "Has numeric CSS class");
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "No numpad class");

  kb.destroy();
});

QUnit.test("KeyboardType 'Numeric' filters out {layout:base} keys (handler is gated to Full)", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType(KeyboardType.Numeric);
  await placeAndWait(kb);

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.notOk(keys.includes("{layout:base}"), "ABC key not rendered in Numeric mode");
  assert.ok(keys.includes("0"), "Numeric digit keys still rendered");

  kb.destroy();
});

QUnit.test("KeyboardType 'Numeric' filter applies to overridden numeric layout too", async (assert) => {
  const customNumeric: LayoutDefinition = [
    [{ value: "1" }, { value: "2" }, { value: "3" }],
    [
      { value: "{layout:base}", label: "ABC", type: "modifier" },
      { value: "{enter}", type: "action" },
    ],
  ];
  const kb = new KioskKeyboard({ instanceLayouts: { numeric: customNumeric } });
  kb.setKeyboardType(KeyboardType.Numeric);
  await placeAndWait(kb);

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.notOk(keys.includes("{layout:base}"), "Custom numeric override has ABC filtered out too");
  assert.ok(keys.includes("{enter}"), "Other action keys preserved");

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
  kb.setKeyboardType(KeyboardType.Numpad);
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
  kb.setControls([input.getId()]);
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
// Per-instance layout overrides
// ──────────────────────────────────────────────

QUnit.test("instanceLayouts entry is usable by name", async (assert) => {
  const customLayout: LayoutDefinition = [[{ value: "x" }, { value: "y" }, { value: "z" }]];
  const kb = new KioskKeyboard({ instanceLayouts: { "test-custom": customLayout }, layout: "test-custom" });
  await placeAndWait(kb);

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.deepEqual(keys, ["x", "y", "z"], "Custom layout keys rendered");

  kb.destroy();
});

QUnit.test("Custom layout works as base layout for {layout:base} roundtrip", async (assert) => {
  const customLayout: LayoutDefinition = [
    [
      { value: "m" },
      { value: "n" },
      {
        value: "{layout:numeric}",
        label: "123",
        type: "modifier",
      },
    ],
  ];

  const kb = new KioskKeyboard({
    instanceLayouts: { "test-roundtrip": customLayout },
    layout: "test-roundtrip",
  });
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

QUnit.test("instanceLayouts shadow built-in layouts for the controlling instance", async (assert) => {
  const custom: LayoutDefinition = [[{ value: "CUSTOM" }]];

  const kb = new KioskKeyboard({ instanceLayouts: { qwerty: custom }, layout: "qwerty" });
  await placeAndWait(kb);

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.deepEqual(keys, ["CUSTOM"], "Built-in qwerty shadowed by instance override");

  kb.destroy();
});

QUnit.test("instanceLayouts accepts formerly forbidden map keys (Map-safe)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x" }]];
  for (const name of ["__proto__", "prototype", "constructor"]) {
    const kb = new KioskKeyboard({ instanceLayouts: { [name]: layout }, layout: name });
    await placeAndWait(kb);

    const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.deepEqual(keys, ["x"], `Key "${name}" is accepted in instanceLayouts`);

    kb.destroy();
  }
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

QUnit.test("instanceLocaleLayouts extends the locale map for the controlling instance", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("xx");
    const kb = new KioskKeyboard({
      instanceLayouts: { "test-locale-layout": [[{ value: "x" }]] },
      instanceLocaleLayouts: { xx: "test-locale-layout" },
    });
    await placeAndWait(kb);

    assert.strictEqual(kb.getLayout(), "test-locale-layout", "Custom locale maps to custom layout via instance map");

    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("instanceLocaleLayouts accepts formerly forbidden locale keys (Map-safe)", async (assert) => {
  const localization = Localization as unknown as {
    getLanguageTag: () => { language: string; region?: string | null };
  };
  const originalGetLanguageTag = localization.getLanguageTag;

  try {
    for (const locale of ["__proto__", "prototype", "constructor"]) {
      localization.getLanguageTag = () => ({ language: locale, region: undefined });

      const kb = new KioskKeyboard({
        instanceLocaleLayouts: { [locale]: "qwertz-de" },
      });
      await placeAndWait(kb);

      assert.strictEqual(kb.getLayout(), "qwertz-de", `Locale key "${locale}" resolves correctly`);
      kb.destroy();
    }
  } finally {
    localization.getLanguageTag = originalGetLanguageTag;
  }
});

QUnit.test("Unknown locale mapping falls back to default layout", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("zz");
    const kb = new KioskKeyboard({
      instanceLocaleLayouts: { zz: "layout-does-not-exist" },
    });
    await placeAndWait(kb);

    assert.strictEqual(kb.getLayout(), "qwerty", "Unknown layout mapping falls back to default layout");
    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("Unknown exact locale mapping falls back to valid language prefix", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de-CH");
    const kb = new KioskKeyboard({
      instanceLocaleLayouts: { "de-ch": "layout-does-not-exist" },
    });
    await placeAndWait(kb);

    assert.strictEqual(
      kb.getLayout(),
      "qwertz-de",
      "Invalid exact de-ch mapping falls back to valid de prefix mapping",
    );
    kb.destroy();
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
  assert.strictEqual(getRowKeyValues(kb, 4).length, 7, "Row 5 has 7 keys");
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

  // Verify shift variants via data-shift-value attribute (renderer stores them on the DOM)
  const allKeys = Array.from(getKeyElements(kb));
  const expectedShifts: Record<string, string> = {
    "\u3042": "\u3041", // あ → ぁ
    "\u3046": "\u3045", // う → ぅ
    "\u3048": "\u3047", // え → ぇ
    "\u304A": "\u3049", // お → ぉ
    "\u3084": "\u3083", // や → ゃ
    "\u3086": "\u3085", // ゆ → ゅ
    "\u3088": "\u3087", // よ → ょ
    "\u308F": "\u3092", // わ → を
    "\u3044": "\u3043", // い → ぃ
    "\u3064": "\u3063", // つ → っ
    "\u307B": "\u3078", // ほ → へ
  };

  for (const [base, expectedSmall] of Object.entries(expectedShifts)) {
    const keyEl = allKeys.find((el) => el.dataset.key === base);
    assert.ok(keyEl, `key for ${base} exists`);
    assert.strictEqual(
      keyEl?.getAttribute(DOM.attributes.shiftValue),
      expectedSmall,
      `shift of ${base} should be ${expectedSmall}`,
    );
  }

  kb.destroy();
});

QUnit.test("ja-kana: row 4 punctuation shift variants", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);

  // Verify JIS punctuation shift variants via data-shift-value on row 4 keys
  const allKeys = Array.from(getKeyElements(kb));
  const ne = allKeys.find((el) => el.dataset.key === "\u306D"); // ね
  const ru = allKeys.find((el) => el.dataset.key === "\u308B"); // る
  const me = allKeys.find((el) => el.dataset.key === "\u3081"); // め

  assert.strictEqual(ne?.getAttribute(DOM.attributes.shiftValue), "\u3001", "ね shift is 、 (ideographic comma)");
  assert.strictEqual(ru?.getAttribute(DOM.attributes.shiftValue), "\u3002", "る shift is 。 (ideographic period)");
  assert.strictEqual(me?.getAttribute(DOM.attributes.shiftValue), "\u30FB", "め shift is ・ (middle dot)");

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

QUnit.test("instanceLocaleLayouts exact region match takes priority over prefix", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de-AT");
    const kbAt = new KioskKeyboard({
      instanceLayouts: { "test-de-at": [[{ value: "a" }]] },
      instanceLocaleLayouts: { "de-at": "test-de-at" },
    });
    await placeAndWait(kbAt);
    assert.strictEqual(kbAt.getLayout(), "test-de-at", "Exact de-at match wins over de prefix");
    kbAt.destroy();

    // de (no region) still uses the built-in prefix match
    Localization.setLanguage("de");
    const kbDe = new KioskKeyboard();
    await placeAndWait(kbDe);
    assert.strictEqual(kbDe.getLayout(), "qwertz-de", "de without region still maps to qwertz-de");
    kbDe.destroy();
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

QUnit.test("isBuiltInLayout returns true for built-in layouts", (assert) => {
  assert.ok(KioskKeyboard.isBuiltInLayout("qwerty"), "qwerty is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("qwertz-de"), "qwertz-de is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("numeric"), "numeric is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("special"), "special is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("numpad"), "numpad is built-in");
});

QUnit.test("isBuiltInLayout returns false for non-existent layouts", (assert) => {
  assert.notOk(KioskKeyboard.isBuiltInLayout("nonexistent"), "Nonexistent layout is not built-in");
});

// ──────────────────────────────────────────────
// instanceLayouts validation
// ──────────────────────────────────────────────

QUnit.test("instanceLayouts filters invalid entries and falls back to default", async (assert) => {
  const cases: Array<[string, unknown]> = [
    ["non-array", "not-an-array"],
    ["empty-array", []],
    ["empty-row", [[]]],
    ["missing-value", [[{ label: "x" }]]],
    ["non-string-value", [[{ value: 123 }]]],
  ];

  for (const [name, def] of cases) {
    const kb = new KioskKeyboard({
      instanceLayouts: { [name]: def as LayoutDefinition },
      layout: name,
    });
    await placeAndWait(kb);
    assert.strictEqual(kb.getLayout(), "qwerty", `Invalid "${name}" entry rejected, falls back to qwerty`);
    kb.destroy();
  }
});

QUnit.test("instanceLocaleLayouts ignores non-string entries", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");
    const kb = new KioskKeyboard({
      instanceLocaleLayouts: { de: 123 as never } as Record<string, string>,
    });
    await placeAndWait(kb);
    assert.strictEqual(kb.getLayout(), "qwertz-de", "Built-in locale mapping remains intact when value is non-string");
    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

// ──────────────────────────────────────────────
// Cross-Layout Special Char Consistency
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// ko-hangul layout
// ──────────────────────────────────────────────

QUnit.test("ko-hangul layout renders 5 rows with correct key counts", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ko-hangul" });
  await placeAndWait(kb);
  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 5, "ko-hangul has 5 rows");
  assert.strictEqual(getRowKeyValues(kb, 0).length, 11, "Row 1 has 11 keys (digits + backspace)");
  assert.strictEqual(getRowKeyValues(kb, 1).length, 10, "Row 2 has 10 keys (Q-P jamo)");
  assert.strictEqual(getRowKeyValues(kb, 2).length, 9, "Row 3 has 9 keys (A-L jamo)");
  assert.strictEqual(getRowKeyValues(kb, 3).length, 11, "Row 4 has 11 keys (shift + Z-M + , . + enter)");
  assert.strictEqual(getRowKeyValues(kb, 4).length, 5, "Row 5 has 5 keys");
  kb.destroy();
});

QUnit.test("ko-hangul home row contains standard Dubeolsik jamo", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ko-hangul" });
  await placeAndWait(kb);
  const homeRow = getRowKeyValues(kb, 2);
  const expected = ["\u3141", "\u3134", "\u3147", "\u3139", "\u314E", "\u3157", "\u3153", "\u314F", "\u3163"];
  assert.deepEqual(homeRow, expected, "Home row matches A-L Dubeolsik positions");
  kb.destroy();
});

QUnit.test("ko-hangul has ABC toggle to qwerty", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ko-hangul" });
  await placeAndWait(kb);
  const row5Keys = getRowKeyValues(kb, 4);
  assert.ok(row5Keys.includes("{layout:qwerty}"), "Row 5 contains qwerty toggle (ABC)");
  kb.destroy();
});

QUnit.test("ko-hangul has standard slash with ?-on-shift", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ko-hangul" });
  await placeAndWait(kb);
  const row5 = getRowKeyValues(kb, 4);
  assert.ok(row5.includes("/"), "Row 5 contains / key");
  kb.destroy();
});

QUnit.test("ko-hangul: backspace, enter, shift, space have correct types", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ko-hangul" });
  await placeAndWait(kb);
  const root = kb.getDomRef()!;
  assert.ok(
    root.querySelector('[data-key="{backspace}"]')!.classList.contains(DOM.classes.keyAction),
    "Backspace is action",
  );
  assert.ok(root.querySelector('[data-key="{enter}"]')!.classList.contains(DOM.classes.keyAction), "Enter is action");
  assert.ok(
    root.querySelector('[data-key="{shift}"]')!.classList.contains(DOM.classes.keyModifier),
    "Shift is modifier",
  );
  assert.ok(root.querySelector('[data-key=" "]')!.classList.contains(DOM.classes.keySpace), "Space is space");
  kb.destroy();
});

// ──────────────────────────────────────────────
// qwerty-es layout
// ──────────────────────────────────────────────

QUnit.test("qwerty-es layout renders 5 rows with correct key counts", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty-es" });
  await placeAndWait(kb);
  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 5, "qwerty-es has 5 rows");
  assert.strictEqual(getRowKeyValues(kb, 0).length, 11, "Row 1 has 11 keys (digits + backspace)");
  assert.strictEqual(getRowKeyValues(kb, 1).length, 10, "Row 2 has 10 keys (Q-P)");
  assert.strictEqual(getRowKeyValues(kb, 2).length, 10, "Row 3 has 10 keys (A-L + ñ)");
  assert.strictEqual(getRowKeyValues(kb, 3).length, 9, "Row 4 has 9 keys (shift + Z-M + enter)");
  assert.strictEqual(getRowKeyValues(kb, 4).length, 6, "Row 5 has 6 keys");
  kb.destroy();
});

QUnit.test("qwerty-es has dedicated ñ on home row", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty-es" });
  await placeAndWait(kb);
  const homeRow = getRowKeyValues(kb, 2);
  assert.ok(homeRow.includes("\u00F1"), "Home row contains ñ");
  assert.strictEqual(homeRow[homeRow.length - 1], "\u00F1", "ñ is the last key in home row");
  kb.destroy();
});

QUnit.test("qwerty-es has inverted punctuation ¿ with ¡ on shift", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty-es" });
  await placeAndWait(kb);
  const root = kb.getDomRef()!;
  const invQuestion = root.querySelector('[data-key="\u00BF"]');
  assert.ok(invQuestion, "¿ key exists");
  assert.strictEqual(invQuestion!.getAttribute("data-shift-value"), "\u00A1", "Shift of ¿ is ¡");
  kb.destroy();
});

QUnit.test("qwerty-es: backspace, enter, shift, space have correct types", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty-es" });
  await placeAndWait(kb);
  const root = kb.getDomRef()!;
  assert.ok(
    root.querySelector('[data-key="{backspace}"]')!.classList.contains(DOM.classes.keyAction),
    "Backspace is action",
  );
  assert.ok(root.querySelector('[data-key="{enter}"]')!.classList.contains(DOM.classes.keyAction), "Enter is action");
  assert.ok(
    root.querySelector('[data-key="{shift}"]')!.classList.contains(DOM.classes.keyModifier),
    "Shift is modifier",
  );
  assert.ok(root.querySelector('[data-key=" "]')!.classList.contains(DOM.classes.keySpace), "Space is space");
  kb.destroy();
});

QUnit.test("Numeric layout keys identical regardless of base layout (qwerty vs qwertz-de)", async (assert) => {
  const kbQwerty = new KioskKeyboard({ layout: "qwerty", keyboardType: KeyboardType.Numeric });
  const kbQwertz = new KioskKeyboard({ layout: "qwertz-de", keyboardType: KeyboardType.Numeric });
  await placeAndWait(kbQwerty);
  kbQwertz.placeAt("qunit-fixture");
  await waitForRender();

  const keysQwerty = Array.from(getKeyElements(kbQwerty)).map((el) => el.dataset.key);
  const keysQwertz = Array.from(getKeyElements(kbQwertz)).map((el) => el.dataset.key);

  assert.deepEqual(keysQwerty, keysQwertz, "Same key values in same order");

  kbQwerty.destroy();
  kbQwertz.destroy();
});
