import {
  registerLayout,
  unregisterLayout,
  resetCustomLayouts,
  getRegisteredLayout,
  getRegisteredLayoutNames,
  isBuiltInLayout,
  registerLocaleLayout,
  unregisterLocaleLayout,
  resetLocaleLayouts,
  getLocaleLayout,
} from "ui5/kiosk/layout-registry";
import type { LayoutDefinition } from "ui5/kiosk/types";
import Localization from "sap/base/i18n/Localization";
import Log from "sap/base/Log";

// ─── Helpers ─────────────────────────────────────

/** Minimal valid layout definition for registration. */
function makeLayout(label = "a"): LayoutDefinition {
  return [[{ value: label }]];
}

const BUILTIN_NAMES = [
  "qwerty",
  "qwertz-de",
  "numeric",
  "special",
  "numpad",
  "fkeys",
  "nav",
  "qwerty-fk",
  "qwertz-de-fk",
  "qwerty-nav",
  "qwertz-de-nav",
];

/** Shared sandbox — every module restores it in afterEach so stubs never leak. */
const sandbox = sinon.createSandbox();

function commonAfterEach() {
  sandbox.restore();
  resetCustomLayouts();
  resetLocaleLayouts();
}

// ──────────────────────────────────────────────────
// normalizeLowerString edge cases (exercised through public API)
// ──────────────────────────────────────────────────

QUnit.module("layout-registry — normalizeLowerString", { afterEach: commonAfterEach });

QUnit.test("Rejects non-string input (number)", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLayout(42 as unknown as string, makeLayout());
  assert.ok(spy.calledOnce, "Warning logged for numeric input");
  assert.ok(spy.firstCall.args[0].includes("expected a string"), "Warning message is about string type");
});

QUnit.test("Rejects non-string input (null)", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLayout(null as unknown as string, makeLayout());
  assert.ok(spy.calledOnce, "Warning logged for null input");
});

QUnit.test("Rejects non-string input (undefined)", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLayout(undefined as unknown as string, makeLayout());
  assert.ok(spy.calledOnce, "Warning logged for undefined input");
});

QUnit.test("Rejects empty string", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLayout("", makeLayout());
  assert.ok(spy.calledOnce, "Warning logged for empty string");
  assert.ok(spy.firstCall.args[0].includes("non-empty string"), "Warning message is about empty string");
});

QUnit.test("Rejects whitespace-only string", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLayout("   \t  ", makeLayout());
  assert.ok(spy.calledOnce, "Warning logged for whitespace-only string");
  assert.ok(spy.firstCall.args[0].includes("non-empty string"), "Warning message is about empty string");
});

QUnit.test("Trims and lowercases input", (assert) => {
  registerLayout("  My-Layout  ", makeLayout("trimmed"));
  const result = getRegisteredLayout("my-layout");
  assert.ok(result, "Layout retrieved with normalized name");
  assert.strictEqual(result![0][0].value, "trimmed", "Correct layout definition stored");
});

// ──────────────────────────────────────────────────
// isSafeMapKey — prototype-pollution guard
// ──────────────────────────────────────────────────

QUnit.module("layout-registry — isSafeMapKey", { afterEach: commonAfterEach });

QUnit.test("Rejects __proto__ as layout name", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLayout("__proto__", makeLayout());
  assert.strictEqual(getRegisteredLayout("__proto__"), undefined, "Layout not registered");
  assert.ok(spy.calledOnce, "Warning logged");
});

QUnit.test("Rejects prototype as layout name", (assert) => {
  sandbox.spy(Log, "warning");

  registerLayout("prototype", makeLayout());
  assert.strictEqual(getRegisteredLayout("prototype"), undefined, "Layout not registered");
});

QUnit.test("Rejects constructor as layout name", (assert) => {
  sandbox.spy(Log, "warning");

  registerLayout("constructor", makeLayout());
  assert.strictEqual(getRegisteredLayout("constructor"), undefined, "Layout not registered");
});

QUnit.test("Rejects __proto__ as locale map key", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLocaleLayout("__proto__", "qwerty");
  assert.ok(spy.called, "Warning logged for forbidden locale key");
});

QUnit.test("Rejects __proto__ as locale map value", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLocaleLayout("xx", "__proto__");
  assert.ok(spy.called, "Warning logged for forbidden layout value");
});

// ──────────────────────────────────────────────────
// registerLocaleLayout / unregisterLocaleLayout / resetLocaleLayouts
// ──────────────────────────────────────────────────

QUnit.module("layout-registry — registerLocaleLayout", { afterEach: commonAfterEach });

QUnit.test("Registers a locale mapping to a known layout", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLocaleLayout("fr", "qwerty");
  assert.notOk(spy.called, "No warning when layout exists");
});

QUnit.test("Warns but stores mapping when layout is not yet registered", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLocaleLayout("fr", "azerty-fr");
  assert.ok(spy.calledOnce, "Warning logged for unknown layout");
  assert.ok(spy.firstCall.args[0].includes("unknown layout"), "Warning message references unknown layout");
  assert.ok(spy.firstCall.args[0].includes("azerty-fr"), "Warning message includes layout name");

  // Now register the layout — the mapping should resolve
  registerLayout("azerty-fr", makeLayout());
  sandbox.stub(Localization, "getLanguageTag").returns({ language: "fr", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "azerty-fr", "Mapping resolves after layout is registered");
});

QUnit.test("Normalizes locale key (trim + lowercase)", (assert) => {
  registerLocaleLayout("  FR  ", "qwerty");

  sandbox.stub(Localization, "getLanguageTag").returns({ language: "fr", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "qwerty", "Mapping found with normalized key");
});

QUnit.test("Overwrites existing locale mapping", (assert) => {
  registerLocaleLayout("fr", "qwerty");
  registerLocaleLayout("fr", "qwertz-de");

  sandbox.stub(Localization, "getLanguageTag").returns({ language: "fr", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "qwertz-de", "Second registration overwrites first");
});

QUnit.test("Rejects non-string locale", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLocaleLayout(123 as unknown as string, "qwerty");
  assert.ok(spy.calledOnce, "Warning logged for non-string locale");
});

QUnit.test("Rejects non-string layout", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLocaleLayout("fr", null as unknown as string);
  assert.ok(spy.calledOnce, "Warning logged for non-string layout");
});

// ──────────────────────────────────────────────────

QUnit.module("layout-registry — unregisterLocaleLayout", { afterEach: commonAfterEach });

QUnit.test("Removes a previously registered locale mapping", (assert) => {
  registerLocaleLayout("fr", "qwerty");
  unregisterLocaleLayout("fr");

  sandbox.stub(Localization, "getLanguageTag").returns({ language: "fr", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "qwerty", "Falls back to default when mapping removed");
});

QUnit.test("Removes the built-in de mapping", (assert) => {
  unregisterLocaleLayout("de");

  sandbox.stub(Localization, "getLanguageTag").returns({ language: "de", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "qwerty", "Falls back to default after removing built-in mapping");
});

QUnit.test("No-ops for non-existent locale", (assert) => {
  unregisterLocaleLayout("zz");
  assert.ok(true, "No error for non-existent locale");
});

QUnit.test("Rejects forbidden key", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  unregisterLocaleLayout("__proto__");
  assert.ok(spy.called, "Warning logged for forbidden key");
});

// ──────────────────────────────────────────────────

QUnit.module("layout-registry — resetLocaleLayouts", { afterEach: commonAfterEach });

QUnit.test("Restores default de mapping after custom mappings added", (assert) => {
  registerLocaleLayout("fr", "qwerty");
  registerLocaleLayout("de", "qwerty"); // override built-in

  resetLocaleLayouts();

  const stubDe = sandbox.stub(Localization, "getLanguageTag").returns({ language: "de", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "qwertz-de", "de mapping restored to default");

  stubDe.returns({ language: "fr", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "qwerty", "fr mapping removed (falls back to default)");
});

QUnit.test("Idempotent — calling reset twice does not break state", (assert) => {
  resetLocaleLayouts();
  resetLocaleLayouts();

  sandbox.stub(Localization, "getLanguageTag").returns({ language: "de", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "qwertz-de", "de mapping still works after double reset");
});

// ──────────────────────────────────────────────────
// getLocaleLayout — resolution order
// ──────────────────────────────────────────────────

QUnit.module("layout-registry — getLocaleLayout resolution", { afterEach: commonAfterEach });

QUnit.test("Exact BCP-47 match takes precedence over language prefix", (assert) => {
  registerLayout("swiss-de", makeLayout());
  registerLocaleLayout("de", "qwertz-de");
  registerLocaleLayout("de-ch", "swiss-de");

  sandbox.stub(Localization, "getLanguageTag").returns({ language: "de", region: "CH" } as any);
  assert.strictEqual(getLocaleLayout(), "swiss-de", "Exact de-ch match used over de prefix");
});

QUnit.test("Falls back to language prefix when no exact match", (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns({ language: "de", region: "AT" } as any);
  assert.strictEqual(getLocaleLayout(), "qwertz-de", "Falls back to de prefix mapping");
});

QUnit.test("Falls back to DEFAULT_LAYOUT when no mapping matches", (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns({ language: "ja", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "qwerty", "Unmapped language returns qwerty default");
});

QUnit.test("Falls back to DEFAULT_LAYOUT when no region and no prefix match", (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns({ language: "zh", region: "TW" } as any);
  assert.strictEqual(getLocaleLayout(), "qwerty", "Unmapped language+region returns qwerty default");
});

QUnit.test("Locale with region but only prefix registered uses prefix", (assert) => {
  registerLayout("azerty-fr", makeLayout());
  registerLocaleLayout("fr", "azerty-fr");

  sandbox.stub(Localization, "getLanguageTag").returns({ language: "fr", region: "CA" } as any);
  assert.strictEqual(getLocaleLayout(), "azerty-fr", "fr-ca falls back to fr prefix");
});

QUnit.test("Does not resolve mapping when target layout is not registered", (assert) => {
  sandbox.spy(Log, "warning"); // suppress warning noise
  registerLocaleLayout("it", "qwerty-it"); // layout doesn't exist

  sandbox.stub(Localization, "getLanguageTag").returns({ language: "it", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "qwerty", "Falls back to default when mapped layout is missing");
});

QUnit.test("Region is lowercased for matching", (assert) => {
  registerLayout("swiss-de", makeLayout());
  registerLocaleLayout("de-ch", "swiss-de");

  sandbox.stub(Localization, "getLanguageTag").returns({ language: "de", region: "CH" } as any);
  assert.strictEqual(
    getLocaleLayout(),
    "swiss-de",
    "Region uppercased by Localization still matches lowercase map key",
  );
});

QUnit.test("Skips exact match when region is empty", (assert) => {
  registerLocaleLayout("de", "qwertz-de");

  sandbox.stub(Localization, "getLanguageTag").returns({ language: "de", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "qwertz-de", "Empty region skips exact match, uses prefix");
});

// ──────────────────────────────────────────────────
// registerLayout validation
// ──────────────────────────────────────────────────

QUnit.module("layout-registry — registerLayout validation", { afterEach: commonAfterEach });

QUnit.test("Rejects overwriting a built-in layout", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  for (const name of BUILTIN_NAMES) {
    registerLayout(name, makeLayout());
  }
  assert.strictEqual(spy.callCount, BUILTIN_NAMES.length, "Warning logged for each built-in layout");
  assert.ok(spy.firstCall.args[0].includes("Cannot overwrite built-in layout"), "Warning message is clear");
});

QUnit.test("Rejects empty layout definition", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLayout("empty-def", [] as unknown as LayoutDefinition);
  assert.ok(spy.calledOnce, "Warning logged for empty array");
  assert.strictEqual(getRegisteredLayout("empty-def"), undefined, "Layout not registered");
});

QUnit.test("Rejects layout with empty rows", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLayout("empty-row", [[]] as unknown as LayoutDefinition);
  assert.ok(spy.calledOnce, "Warning logged for empty row");
  assert.strictEqual(getRegisteredLayout("empty-row"), undefined, "Layout not registered");
});

QUnit.test("Rejects layout with keys missing value property", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLayout("no-value", [[{ label: "x" }]] as unknown as LayoutDefinition);
  assert.ok(spy.calledOnce, "Warning logged for key without value");
});

QUnit.test("Rejects layout with key having empty value", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLayout("empty-value", [[{ value: "" }]]);
  assert.ok(spy.calledOnce, "Warning logged for empty value");
});

QUnit.test("Rejects non-array layout definition", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLayout("not-array", "invalid" as unknown as LayoutDefinition);
  assert.ok(spy.calledOnce, "Warning logged for non-array definition");
});

QUnit.test("Registers valid custom layout", (assert) => {
  const layout = makeLayout("hello");
  registerLayout("custom-test", layout);

  const result = getRegisteredLayout("custom-test");
  assert.deepEqual(result, layout, "Layout stored correctly");
});

QUnit.test("Registered layout appears in getRegisteredLayoutNames()", (assert) => {
  registerLayout("my-layout", makeLayout());

  const names = getRegisteredLayoutNames();
  assert.ok(names.includes("my-layout"), "Custom layout name in list");
});

// ──────────────────────────────────────────────────
// unregisterLayout
// ──────────────────────────────────────────────────

QUnit.module("layout-registry — unregisterLayout", { afterEach: commonAfterEach });

QUnit.test("Removes a custom layout", (assert) => {
  registerLayout("to-remove", makeLayout());
  assert.ok(getRegisteredLayout("to-remove"), "Layout exists before removal");

  unregisterLayout("to-remove");
  assert.strictEqual(getRegisteredLayout("to-remove"), undefined, "Layout removed");
});

QUnit.test("Rejects removing a built-in layout", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  unregisterLayout("qwerty");
  assert.ok(spy.calledOnce, "Warning logged");
  assert.ok(spy.firstCall.args[0].includes("Cannot remove built-in layout"), "Warning message is clear");
  assert.ok(getRegisteredLayout("qwerty"), "Built-in layout still exists");
});

QUnit.test("No-ops for non-existent layout", (assert) => {
  unregisterLayout("nonexistent");
  assert.ok(true, "No error for non-existent layout");
});

// ──────────────────────────────────────────────────
// resetCustomLayouts
// ──────────────────────────────────────────────────

QUnit.module("layout-registry — resetCustomLayouts", { afterEach: commonAfterEach });

QUnit.test("Removes all custom layouts", (assert) => {
  registerLayout("custom-a", makeLayout());
  registerLayout("custom-b", makeLayout());

  resetCustomLayouts();

  assert.strictEqual(getRegisteredLayout("custom-a"), undefined, "custom-a removed");
  assert.strictEqual(getRegisteredLayout("custom-b"), undefined, "custom-b removed");
});

QUnit.test("Preserves all built-in layouts", (assert) => {
  registerLayout("custom-x", makeLayout());

  resetCustomLayouts();

  for (const name of BUILTIN_NAMES) {
    assert.ok(getRegisteredLayout(name), `Built-in layout "${name}" preserved`);
  }
});

// ──────────────────────────────────────────────────
// isBuiltInLayout
// ──────────────────────────────────────────────────

QUnit.module("layout-registry — isBuiltInLayout", { afterEach: commonAfterEach });

QUnit.test("Returns true for all built-in layouts", (assert) => {
  for (const name of BUILTIN_NAMES) {
    assert.ok(isBuiltInLayout(name), `"${name}" is built-in`);
  }
});

QUnit.test("Returns false for custom layouts", (assert) => {
  registerLayout("custom-check", makeLayout());
  assert.notOk(isBuiltInLayout("custom-check"), "Custom layout is not built-in");
});

QUnit.test("Returns false for non-existent layouts", (assert) => {
  assert.notOk(isBuiltInLayout("does-not-exist"), "Unknown layout is not built-in");
});

QUnit.test("Returns false for invalid input", (assert) => {
  assert.notOk(isBuiltInLayout(""), "Empty string is not built-in");
  assert.notOk(isBuiltInLayout(null as unknown as string), "null is not built-in");
});
