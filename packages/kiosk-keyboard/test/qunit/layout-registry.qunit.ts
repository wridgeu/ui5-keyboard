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
} from "ui5/kiosk/internal/layout-registry";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import type { LayoutDefinition } from "ui5/kiosk/types";
import Localization from "sap/base/i18n/Localization";
import Log from "sap/base/Log";
import { placeAndWait, getResolvedLayout } from "./test-helpers";

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

/** Shared sandbox - every module restores it in afterEach so stubs never leak. */
const sandbox = sinon.createSandbox();

function commonAfterEach() {
  sandbox.restore();
  resetCustomLayouts();
  resetLocaleLayouts();
}

// ──────────────────────────────────────────────────
// normalizeLowerString edge cases (exercised through public API)
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - normalizeLowerString", { afterEach: commonAfterEach });

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
// Map-based storage - formerly dangerous keys are safe
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - formerly reserved keys (Map-safe)", { afterEach: commonAfterEach });

QUnit.test("Accepts __proto__ as custom layout name", (assert) => {
  const layout = makeLayout("proto");
  registerLayout("__proto__", layout);
  assert.deepEqual(getRegisteredLayout("__proto__"), layout, "Layout registered with __proto__ key");
});

QUnit.test("Accepts prototype as custom layout name", (assert) => {
  const layout = makeLayout("proto");
  registerLayout("prototype", layout);
  assert.deepEqual(getRegisteredLayout("prototype"), layout, "Layout registered with prototype key");
});

QUnit.test("Accepts constructor as custom layout name", (assert) => {
  const layout = makeLayout("ctor");
  registerLayout("constructor", layout);
  assert.deepEqual(getRegisteredLayout("constructor"), layout, "Layout registered with constructor key");
});

QUnit.test("Accepts __proto__ as locale map key", (assert) => {
  registerLocaleLayout("__proto__", "qwerty");
  // No error - Map handles it safely
  assert.ok(true, "No error for __proto__ locale key");
});

QUnit.test("Accepts __proto__ as locale map value (warns about unknown layout)", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  registerLocaleLayout("xx", "__proto__");
  // Warning is about unknown layout, not about forbidden key
  assert.ok(spy.calledOnce, "Warning logged for unknown layout");
  assert.ok(spy.firstCall.args[0].includes("unknown layout"), "Warning is about unknown layout, not key safety");
});

// ──────────────────────────────────────────────────
// registerLocaleLayout / unregisterLocaleLayout / resetLocaleLayouts
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - registerLocaleLayout", { afterEach: commonAfterEach });

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

  // Now register the layout - the mapping should resolve
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

QUnit.module("layout-registry - unregisterLocaleLayout", { afterEach: commonAfterEach });

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

QUnit.test("No-ops for __proto__ locale (Map-safe)", (assert) => {
  unregisterLocaleLayout("__proto__");
  assert.ok(true, "No error for __proto__ locale key");
});

// ──────────────────────────────────────────────────

QUnit.module("layout-registry - resetLocaleLayouts", { afterEach: commonAfterEach });

QUnit.test("Restores default de mapping after custom mappings added", (assert) => {
  registerLocaleLayout("fr", "qwerty");
  registerLocaleLayout("de", "qwerty"); // override built-in

  resetLocaleLayouts();

  const stubDe = sandbox.stub(Localization, "getLanguageTag").returns({ language: "de", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "qwertz-de", "de mapping restored to default");

  stubDe.returns({ language: "fr", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "qwerty", "fr mapping removed (falls back to default)");
});

QUnit.test("Idempotent - calling reset twice does not break state", (assert) => {
  resetLocaleLayouts();
  resetLocaleLayouts();

  sandbox.stub(Localization, "getLanguageTag").returns({ language: "de", region: "" } as any);
  assert.strictEqual(getLocaleLayout(), "qwertz-de", "de mapping still works after double reset");
});

// ──────────────────────────────────────────────────
// getLocaleLayout - resolution order
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - getLocaleLayout resolution", { afterEach: commonAfterEach });

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

QUnit.module("layout-registry - registerLayout validation", { afterEach: commonAfterEach });

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

QUnit.module("layout-registry - unregisterLayout", { afterEach: commonAfterEach });

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

QUnit.module("layout-registry - resetCustomLayouts", { afterEach: commonAfterEach });

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

QUnit.module("layout-registry - isBuiltInLayout", { afterEach: commonAfterEach });

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

// ──────────────────────────────────────────────────
// Round-trip registration
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - round-trip registration", { afterEach: commonAfterEach });

QUnit.test("Register, retrieve, and verify custom layout", (assert) => {
  const customLayout: LayoutDefinition = [
    [{ value: "a" }, { value: "b" }, { value: "c" }],
    [{ value: "d" }, { value: "e" }, { value: "f" }],
  ];

  registerLayout("custom-roundtrip", customLayout);

  const retrieved = getRegisteredLayout("custom-roundtrip");
  assert.deepEqual(retrieved, customLayout, "Retrieved layout matches registered definition");
  assert.ok(getRegisteredLayoutNames().includes("custom-roundtrip"), "Name appears in layout list");
  assert.notOk(isBuiltInLayout("custom-roundtrip"), "Custom layout is not built-in");
});

QUnit.test("Register a copy of a built-in layout under a new name", (assert) => {
  const qwertyLayout = getRegisteredLayout("qwerty")!;
  assert.ok(qwertyLayout, "qwerty layout exists");

  // Register it under a new name - simulates consumer cloning a standard layout
  registerLayout("qwerty-copy", qwertyLayout);

  const retrieved = getRegisteredLayout("qwerty-copy");
  assert.deepEqual(retrieved, qwertyLayout, "Cloned layout matches original");
  assert.notOk(isBuiltInLayout("qwerty-copy"), "Copy is not considered built-in");
});

QUnit.test("Unregister a custom layout and verify it is gone", (assert) => {
  registerLayout("temp-layout", makeLayout("temp"));
  assert.ok(getRegisteredLayout("temp-layout"), "Layout exists after registration");

  unregisterLayout("temp-layout");
  assert.strictEqual(getRegisteredLayout("temp-layout"), undefined, "Layout gone after unregister");
  assert.notOk(getRegisteredLayoutNames().includes("temp-layout"), "Name removed from layout list");
});

QUnit.test("Re-register a layout after unregistering it", (assert) => {
  registerLayout("reuse-name", makeLayout("v1"));
  unregisterLayout("reuse-name");

  registerLayout("reuse-name", makeLayout("v2"));
  const retrieved = getRegisteredLayout("reuse-name");
  assert.ok(retrieved, "Layout re-registered successfully");
  assert.strictEqual(retrieved![0][0].value, "v2", "New definition is stored, not the old one");
});

// ──────────────────────────────────────────────────
// KioskKeyboard static facade - consumer DX
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - KioskKeyboard facade", {
  afterEach() {
    sandbox.restore();
    KioskKeyboard.resetCustomLayouts();
    KioskKeyboard.resetLocaleLayouts();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Static registerLayout / getRegisteredLayout round-trip", (assert) => {
  const layout = makeLayout("facade");
  KioskKeyboard.registerLayout("facade-test", layout);

  const retrieved = KioskKeyboard.getRegisteredLayout("facade-test");
  assert.deepEqual(retrieved, layout, "Facade getRegisteredLayout returns the registered layout");
});

QUnit.test("Static getRegisteredLayoutNames includes custom layout", (assert) => {
  KioskKeyboard.registerLayout("facade-names", makeLayout());
  const names = KioskKeyboard.getRegisteredLayoutNames();
  assert.ok(names.includes("facade-names"), "Custom layout appears in facade names list");
  assert.ok(names.includes("qwerty"), "Built-in layout still in facade names list");
});

QUnit.test("Static unregisterLayout removes custom layout", (assert) => {
  KioskKeyboard.registerLayout("facade-remove", makeLayout());
  KioskKeyboard.unregisterLayout("facade-remove");
  assert.strictEqual(KioskKeyboard.getRegisteredLayout("facade-remove"), undefined, "Layout removed via facade");
});

QUnit.test("Static resetCustomLayouts preserves built-ins", (assert) => {
  KioskKeyboard.registerLayout("facade-custom", makeLayout());
  KioskKeyboard.resetCustomLayouts();

  assert.strictEqual(KioskKeyboard.getRegisteredLayout("facade-custom"), undefined, "Custom layout removed");
  assert.ok(KioskKeyboard.getRegisteredLayout("qwerty"), "Built-in qwerty preserved");
});

QUnit.test("Static isBuiltInLayout distinguishes built-in from custom", (assert) => {
  KioskKeyboard.registerLayout("facade-check", makeLayout());
  assert.ok(KioskKeyboard.isBuiltInLayout("qwerty"), "qwerty is built-in via facade");
  assert.notOk(KioskKeyboard.isBuiltInLayout("facade-check"), "Custom layout is not built-in via facade");
});

QUnit.test("Static locale facade round-trip", (assert) => {
  KioskKeyboard.registerLayout("azerty-fr", makeLayout());
  KioskKeyboard.registerLocaleLayout("fr", "azerty-fr");

  sandbox.stub(Localization, "getLanguageTag").returns({ language: "fr", region: "" } as any);
  assert.strictEqual(KioskKeyboard.getLocaleLayout(), "azerty-fr", "Locale resolves via facade");

  KioskKeyboard.unregisterLocaleLayout("fr");
  assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwerty", "Falls back after unregister via facade");
});

QUnit.test("Static resetLocaleLayouts restores defaults via facade", (assert) => {
  KioskKeyboard.registerLocaleLayout("de", "qwerty"); // override built-in
  KioskKeyboard.resetLocaleLayouts();

  sandbox.stub(Localization, "getLanguageTag").returns({ language: "de", region: "" } as any);
  assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "de mapping restored via facade reset");
});

// ──────────────────────────────────────────────────
// KioskKeyboard layout fallback (getLayoutOrDefault via control)
// ──────────────────────────────────────────────────

QUnit.module("layout-registry - KioskKeyboard layout fallback", {
  afterEach() {
    sandbox.restore();
    KioskKeyboard.resetCustomLayouts();
    KioskKeyboard.resetLocaleLayouts();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Unknown layout name falls back to qwerty", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input, layout: "nonexistent-layout" });
  await placeAndWait(kb);

  const qwertyLayout = KioskKeyboard.getRegisteredLayout("qwerty")!;
  const resolved = getResolvedLayout(kb);
  assert.deepEqual(resolved, qwertyLayout, "Unknown layout falls back to qwerty");

  input.destroy();
  kb.destroy();
});

QUnit.test("Custom layout renders correctly after registration", async (assert) => {
  const customLayout: LayoutDefinition = [[{ value: "x" }, { value: "y" }, { value: "z" }]];
  KioskKeyboard.registerLayout("xyz-layout", customLayout);

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input, layout: "xyz-layout" });
  await placeAndWait(kb);

  const resolved = getResolvedLayout(kb);
  assert.deepEqual(resolved, customLayout, "Custom layout is used by control");

  input.destroy();
  kb.destroy();
});

QUnit.test("Removing current layout makes control fall back to qwerty", async (assert) => {
  KioskKeyboard.registerLayout("ephemeral", makeLayout("e"));

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input, layout: "ephemeral" });
  await placeAndWait(kb);

  assert.deepEqual(getResolvedLayout(kb), makeLayout("e"), "Ephemeral layout is active");

  KioskKeyboard.unregisterLayout("ephemeral");
  // Force re-render by triggering a layout re-resolve
  kb.setLayout("ephemeral");
  await placeAndWait(kb);

  const qwertyLayout = KioskKeyboard.getRegisteredLayout("qwerty")!;
  assert.deepEqual(getResolvedLayout(kb), qwertyLayout, "Falls back to qwerty after layout removed");

  input.destroy();
  kb.destroy();
});
