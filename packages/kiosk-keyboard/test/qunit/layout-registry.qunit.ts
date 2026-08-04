import CustomLayout from "ui5/kiosk/CustomLayout";
import {
  getRegisteredLayout,
  getLayoutOrDefault,
  getRegisteredLayoutNames,
  isBuiltInLayout,
  getLocaleLayout,
} from "ui5/kiosk/internal/layout-registry";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import type { LayoutDefinition } from "ui5/kiosk/types";
import Localization from "sap/base/i18n/Localization";
import type LanguageTag from "sap/base/i18n/LanguageTag";
import Log from "sap/base/Log";
import { placeAndWait, getRenderedLayoutKeys } from "./test-helpers";

// ─── Helpers ─────────────────────────────────────

/** Minimal valid layout definition for instance overrides. */
function makeLayout(label = "a"): LayoutDefinition {
  return [[{ value: label }]];
}

/** Minimal LanguageTag stub for Localization.getLanguageTag() tests. */
function langTag(language: string, region = ""): LanguageTag {
  return { language, region } as unknown as LanguageTag;
}

const BUILTIN_NAMES = [
  "qwerty",
  "qwertz-de",
  "numeric",
  "special",
  "numpad",
  "fkeys",
  "nav",
  "ja-romaji",
  "ja-kana",
  "ja-kana-compact",
  "arabic",
  "ko-hangul",
  "qwerty-es",
];

/** Shared sandbox - every module restores it in afterEach so stubs never leak. */
const sandbox = sinon.createSandbox();

function commonAfterEach() {
  sandbox.restore();
}

// ──────────────────────────────────────────────────
// normalizeLowerString edge cases (exercised through getRegisteredLayout)
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - normalizeLowerString", { afterEach: commonAfterEach });

QUnit.test("Rejects non-string input (number, null, undefined)", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  for (const bad of [42, null, undefined]) {
    const label = String(bad);
    assert.strictEqual(getRegisteredLayout(bad as unknown as string), undefined, `${label} input rejected`);
    assert.ok(spy.called, `Warning logged for ${label} input`);
    assert.ok(spy.lastCall.args[0].includes("expected a string"), `Warning message for ${label} is about string type`);
  }
});

QUnit.test("Rejects empty string", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  assert.strictEqual(getRegisteredLayout(""), undefined, "Empty string rejected");
  assert.ok(spy.called, "Warning logged for empty string");
  assert.ok(spy.firstCall.args[0].includes("non-empty string"), "Warning message is about empty string");
});

QUnit.test("Rejects whitespace-only string", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  assert.strictEqual(getRegisteredLayout("   \t  "), undefined, "Whitespace-only rejected");
  assert.ok(spy.called, "Warning logged for whitespace-only string");
});

QUnit.test("Trims and lowercases input when matching built-ins", (assert) => {
  const result = getRegisteredLayout("  QWERTY  ");
  assert.ok(result, "Built-in retrieved with normalized name");
});

// ──────────────────────────────────────────────────
// Instance map - shadows built-ins, accepts unsafe keys
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - instance map", { afterEach: commonAfterEach });

QUnit.test("Instance map shadows built-in layout of same name", (assert) => {
  const custom = makeLayout("instance");
  const instanceMap = new Map([["qwerty", custom]]);
  const result = getRegisteredLayout("qwerty", instanceMap);
  assert.deepEqual(result, custom, "Instance entry wins over built-in qwerty");
});

QUnit.test("Falls through to built-in when instance map lacks the name", (assert) => {
  const instanceMap = new Map([["unrelated", makeLayout()]]);
  const result = getRegisteredLayout("qwerty", instanceMap);
  assert.ok(result, "Falls back to built-in qwerty");
  assert.notStrictEqual(result, instanceMap.get("unrelated"), "Result is not the unrelated entry");
});

QUnit.test("Accepts __proto__ / prototype / constructor in instance map", (assert) => {
  for (const name of ["__proto__", "prototype", "constructor"]) {
    const layout = makeLayout(name);
    const instanceMap = new Map([[name, layout]]);
    assert.deepEqual(getRegisteredLayout(name, instanceMap), layout, `Key "${name}" is accepted`);
  }
});

// ──────────────────────────────────────────────────
// getLocaleLayout - resolution order
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - getLocaleLayout resolution", { afterEach: commonAfterEach });

const BUILTIN_LOCALE_CASES: Array<[string, string]> = [
  ["de", "qwertz-de"],
  ["ja", "ja-romaji"],
  ["ar", "arabic"],
  ["ko", "ko-hangul"],
  ["es", "qwerty-es"],
];

for (const [lang, expected] of BUILTIN_LOCALE_CASES) {
  QUnit.test(`Resolves ${lang} to ${expected} via built-in locale mapping`, (assert) => {
    sandbox.stub(Localization, "getLanguageTag").returns(langTag(lang));
    assert.strictEqual(getLocaleLayout(), expected, `${lang} locale resolves to ${expected}`);
  });
}

QUnit.test("Falls back to DEFAULT_LAYOUT when no mapping matches", (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("zh"));
  assert.strictEqual(getLocaleLayout(), "qwerty", "Unmapped language returns qwerty default");
});

QUnit.test("Falls back to language prefix when no exact region match", (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de", "AT"));
  assert.strictEqual(getLocaleLayout(), "qwertz-de", "de-AT falls back to de prefix");
});

QUnit.test("Region is lowercased for matching", (assert) => {
  const instanceLocale = new Map([["de-ch", "swiss-de"]]);
  const instanceLayouts = new Map([["swiss-de", makeLayout()]]);
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de", "CH"));
  assert.strictEqual(getLocaleLayout(instanceLocale, instanceLayouts), "swiss-de", "Lowercase region key matches");
});

QUnit.test("Skips exact match when region is empty", (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));
  assert.strictEqual(getLocaleLayout(), "qwertz-de", "Empty region uses prefix");
});

QUnit.test("Instance locale map shadows built-in locale map", (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));
  const instanceLocale = new Map([["de", "qwerty"]]);
  assert.strictEqual(getLocaleLayout(instanceLocale), "qwerty", "Instance map shadows built-in de mapping");
});

QUnit.test("Instance locale map can resolve to instance-only layout", (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("xx"));
  const instanceLocale = new Map([["xx", "warehouse"]]);
  const instanceLayouts = new Map([["warehouse", makeLayout("w")]]);
  assert.strictEqual(getLocaleLayout(instanceLocale, instanceLayouts), "warehouse", "Resolves to instance-only name");
});

QUnit.test("Does not resolve mapping when target layout is not registered", (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("xx"));
  const instanceLocale = new Map([["xx", "missing-layout"]]);
  assert.strictEqual(getLocaleLayout(instanceLocale), "qwerty", "Falls back to default when target missing");
});

QUnit.test("Exact BCP-47 match takes precedence over language prefix", (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de", "CH"));
  const instanceLocale = new Map([
    ["de", "qwertz-de"],
    ["de-ch", "qwerty"],
  ]);
  assert.strictEqual(getLocaleLayout(instanceLocale), "qwerty", "Exact de-ch wins over de prefix");
});

// ──────────────────────────────────────────────────
// getLayoutOrDefault
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - getLayoutOrDefault", { afterEach: commonAfterEach });

QUnit.test("Returns built-in layout for known name", (assert) => {
  const result = getLayoutOrDefault("qwerty");
  assert.ok(result, "Returns layout for qwerty");
});

QUnit.test("Falls back to default when name is unknown", (assert) => {
  const fallback = getRegisteredLayout("qwerty");
  assert.deepEqual(getLayoutOrDefault("unknown-name"), fallback, "Unknown name returns default qwerty");
});

QUnit.test("Instance map shadows built-in for known name", (assert) => {
  const custom = makeLayout("custom");
  const instanceMap = new Map([["qwerty", custom]]);
  assert.deepEqual(getLayoutOrDefault("qwerty", instanceMap), custom, "Instance map wins for known name");
});

QUnit.test("Falls back to instance default when both built-in default and instance entry exist", (assert) => {
  const customDefault = makeLayout("custom-default");
  const instanceMap = new Map([["qwerty", customDefault]]);
  assert.deepEqual(
    getLayoutOrDefault("unknown-name", instanceMap),
    customDefault,
    "Unknown name falls back to instance default qwerty",
  );
});

// ──────────────────────────────────────────────────
// isBuiltInLayout
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - isBuiltInLayout", { afterEach: commonAfterEach });

QUnit.test("Returns true for all built-in layouts", (assert) => {
  for (const name of BUILTIN_NAMES) {
    assert.ok(isBuiltInLayout(name), `"${name}" is built-in`);
  }
});

QUnit.test("Returns false for non-existent layouts", (assert) => {
  assert.notOk(isBuiltInLayout("does-not-exist"), "Unknown layout is not built-in");
});

QUnit.test("Returns false for invalid input", (assert) => {
  assert.notOk(isBuiltInLayout(""), "Empty string is not built-in");
  assert.notOk(isBuiltInLayout(null as unknown as string), "null is not built-in");
});

// ──────────────────────────────────────────────────
// Built-in layout structural integrity
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - built-in layout structure", { afterEach: commonAfterEach });

QUnit.test("All built-in layouts are retrievable via getRegisteredLayout", (assert) => {
  for (const name of BUILTIN_NAMES) {
    const layout = getRegisteredLayout(name);
    assert.ok(layout, `Built-in layout "${name}" is retrievable`);
    assert.ok(Array.isArray(layout), `"${name}" is an array`);
  }
});

QUnit.test("All built-in layouts have valid row/key structure", (assert) => {
  for (const name of BUILTIN_NAMES) {
    const layout = getRegisteredLayout(name)!;
    assert.ok(layout.length > 0, `"${name}" has at least one row`);
    for (let r = 0; r < layout.length; r++) {
      const row = layout[r];
      assert.ok(Array.isArray(row) && row.length > 0, `"${name}" row ${r} is a non-empty array`);
      for (let k = 0; k < row.length; k++) {
        const key = row[k];
        assert.strictEqual(typeof key.value, "string", `"${name}" row ${r} key ${k} has string value`);
        assert.ok(key.value.length > 0, `"${name}" row ${r} key ${k} value is non-empty`);
      }
    }
  }
});

QUnit.test("getRegisteredLayoutNames includes all built-in layouts", (assert) => {
  const names = getRegisteredLayoutNames();
  for (const name of BUILTIN_NAMES) {
    assert.ok(names.includes(name), `"${name}" appears in getRegisteredLayoutNames()`);
  }
});

QUnit.test("getRegisteredLayoutNames does not include instance-only layouts", (assert) => {
  // The view is intentionally global-only; instance names are scoped per control.
  const names = getRegisteredLayoutNames();
  assert.notOk(names.includes("instance-only"), "Instance-only names not in global view");
});

// ──────────────────────────────────────────────────
// KioskKeyboard static facade - read-only consumer DX
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - KioskKeyboard facade", {
  afterEach() {
    sandbox.restore();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Static getRegisteredLayout returns built-in layouts", (assert) => {
  assert.ok(KioskKeyboard.getRegisteredLayout("qwerty"), "Built-in qwerty retrievable via facade");
  assert.strictEqual(KioskKeyboard.getRegisteredLayout("nonexistent"), undefined, "Unknown name returns undefined");
});

QUnit.test("Static getRegisteredLayoutNames includes all built-ins", (assert) => {
  const names = KioskKeyboard.getRegisteredLayoutNames();
  for (const name of BUILTIN_NAMES) {
    assert.ok(names.includes(name), `Built-in "${name}" in facade names list`);
  }
});

QUnit.test("Static isBuiltInLayout distinguishes built-in from non-existent", (assert) => {
  assert.ok(KioskKeyboard.isBuiltInLayout("qwerty"), "qwerty is built-in via facade");
  assert.notOk(KioskKeyboard.isBuiltInLayout("nonexistent"), "Unknown is not built-in via facade");
});

QUnit.test("Static getLocaleLayout resolves the current UI5 locale", (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));
  assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "Locale resolves via facade");
});

// ──────────────────────────────────────────────────
// KioskKeyboard layout fallback (getLayoutOrDefault via control)
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - KioskKeyboard layout fallback", {
  afterEach() {
    sandbox.restore();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Unknown layout name falls back to qwerty", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()], layout: "nonexistent-layout" });
  await placeAndWait(kb);

  const qwertyLayout = KioskKeyboard.getRegisteredLayout("qwerty")!;
  const renderedKeys = getRenderedLayoutKeys(kb);
  const expectedKeys = qwertyLayout.map((row: any) => row.map((k: any) => k.value));
  assert.deepEqual(renderedKeys, expectedKeys, "Unknown layout falls back to qwerty");

  input.destroy();
  kb.destroy();
});

QUnit.test("Instance layout renders correctly when configured at construction", async (assert) => {
  const customLayout: LayoutDefinition = [[{ value: "x" }, { value: "y" }, { value: "z" }]];

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    customLayouts: [new CustomLayout({ name: "xyz-layout", rows: customLayout })],
    layout: "xyz-layout",
  });
  await placeAndWait(kb);

  const renderedKeys = getRenderedLayoutKeys(kb);
  const expectedKeys = customLayout.map((row) => row.map((k) => k.value));
  assert.deepEqual(renderedKeys, expectedKeys, "Instance layout is used by control");

  input.destroy();
  kb.destroy();
});
