import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import type { LayoutDefinition, CompositionMiddleware } from "ui5/kiosk/types";
import Localization from "sap/base/i18n/Localization";
import type LanguageTag from "sap/base/i18n/LanguageTag";
import { getMiddlewareFactory, clearCustomMiddleware } from "ui5/kiosk/internal/middleware-registry";
import { placeAndWait, getRenderedLayoutKeys } from "./test-helpers";

// ── Helpers ──

function makeLayout(label: string): LayoutDefinition {
  return [[{ value: label }]];
}

function langTag(language: string, region = ""): LanguageTag {
  return { language, region } as unknown as LanguageTag;
}

function noopFactory(): CompositionMiddleware {
  return {
    handleKey: () => false,
    commit: () => null,
    reset: () => {},
  };
}

const sandbox = sinon.createSandbox();

function commonAfterEach(): void {
  sandbox.restore();
  KioskKeyboard.resetCustomLayouts();
  KioskKeyboard.resetLocaleLayouts();
  // Use clearCustomMiddleware (not _resetMiddleware) so built-in
  // middleware factories survive between tests; the side-effect
  // imports that originally registered them only run once per page.
  clearCustomMiddleware();
  const fixture = document.getElementById("qunit-fixture");
  if (fixture) fixture.innerHTML = "";
}

// ───────────────────────────────────────────────────
// Tier 1 - layout resolution: instance map shadows global
// ───────────────────────────────────────────────────

QUnit.module("instance-overrides - layout resolution", { afterEach: commonAfterEach });

QUnit.test("Instance layouts shadow global layouts of the same name", async (assert) => {
  const globalLayout = [[{ value: "global" }]] as LayoutDefinition;
  const instanceLayout = [[{ value: "instance" }]] as LayoutDefinition;
  KioskKeyboard.registerLayout("shared", globalLayout);

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { shared: instanceLayout },
    layout: "shared",
  });
  await placeAndWait(kb);

  assert.deepEqual(getRenderedLayoutKeys(kb), [["instance"]], "Instance map wins over global registry");

  input.destroy();
  kb.destroy();
});

QUnit.test("Instance layouts that do not match the active name fall through to global", async (assert) => {
  const globalLayout = [[{ value: "global" }]] as LayoutDefinition;
  KioskKeyboard.registerLayout("only-global", globalLayout);

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { unrelated: makeLayout("x") },
    layout: "only-global",
  });
  await placeAndWait(kb);

  assert.deepEqual(getRenderedLayoutKeys(kb), [["global"]], "Falls through to global when instance map lacks the name");

  input.destroy();
  kb.destroy();
});

QUnit.test("Unknown layout falls through to built-in default qwerty", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { other: makeLayout("o") },
    layout: "nonexistent",
  });
  await placeAndWait(kb);

  const qwerty = KioskKeyboard.getRegisteredLayout("qwerty")!;
  const expected = qwerty.map((row) => row.map((k) => k.value));
  assert.deepEqual(getRenderedLayoutKeys(kb), expected, "Falls through to built-in qwerty");

  input.destroy();
  kb.destroy();
});

QUnit.test("Instance layouts can override built-ins for this control only", async (assert) => {
  const customQwerty = [[{ value: "1" }, { value: "2" }]] as LayoutDefinition;

  const input1 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  const input2 = new Input({ value: "" });
  input2.placeAt("qunit-fixture");

  const kbWithOverride = new KioskKeyboard({
    controls: [input1.getId()],
    instanceLayouts: { qwerty: customQwerty },
    layout: "qwerty",
  });
  const kbDefault = new KioskKeyboard({
    controls: [input2.getId()],
    layout: "qwerty",
  });
  await placeAndWait(kbWithOverride);
  await placeAndWait(kbDefault);

  assert.deepEqual(getRenderedLayoutKeys(kbWithOverride), [["1", "2"]], "Override wins for the controlling instance");
  assert.notDeepEqual(
    getRenderedLayoutKeys(kbDefault),
    [["1", "2"]],
    "Other instance still sees the original built-in qwerty",
  );

  input1.destroy();
  input2.destroy();
  kbWithOverride.destroy();
  kbDefault.destroy();
});

QUnit.test("Ignores non-array layout entries in instanceLayouts", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  // The bogus entry should be filtered out; layout falls back to qwerty default
  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { broken: "not-an-array" as unknown as LayoutDefinition },
    layout: "broken",
  });
  await placeAndWait(kb);

  const qwerty = KioskKeyboard.getRegisteredLayout("qwerty")!;
  const expected = qwerty.map((row) => row.map((k) => k.value));
  assert.deepEqual(getRenderedLayoutKeys(kb), expected, "Falls back to default when entry is invalid");

  input.destroy();
  kb.destroy();
});

// ───────────────────────────────────────────────────
// Tier 1 - locale resolution: instance map shadows global
// ───────────────────────────────────────────────────

QUnit.module("instance-overrides - locale resolution", { afterEach: commonAfterEach });

QUnit.test("Instance locale map shadows the global locale map", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));

  KioskKeyboard.registerLayout("warehouse-pos-de", makeLayout("w"));

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLocaleLayouts: { de: "warehouse-pos-de" },
  });
  await placeAndWait(kb);

  assert.strictEqual(kb.getLayout(), "warehouse-pos-de", "Instance locale map selected on construction");
  assert.deepEqual(getRenderedLayoutKeys(kb), [["w"]], "Renders the instance-resolved layout");

  input.destroy();
  kb.destroy();
});

QUnit.test("Instance locale map falls back to global when locale not in instance map", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLocaleLayouts: { fr: "qwerty" }, // only fr, current locale is de
  });
  await placeAndWait(kb);

  assert.strictEqual(kb.getLayout(), "qwertz-de", "Falls back to global de mapping");

  input.destroy();
  kb.destroy();
});

QUnit.test("Instance locale map can resolve to an instance-only layout", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { "warehouse-de": makeLayout("wh") },
    instanceLocaleLayouts: { de: "warehouse-de" },
  });
  await placeAndWait(kb);

  assert.strictEqual(kb.getLayout(), "warehouse-de", "Locale resolves to instance-only layout name");
  assert.deepEqual(getRenderedLayoutKeys(kb), [["wh"]]);

  input.destroy();
  kb.destroy();
});

// ───────────────────────────────────────────────────
// Tier 1 - middleware resolution: instance map shadows global
// ───────────────────────────────────────────────────

QUnit.module("instance-overrides - middleware resolution", { afterEach: commonAfterEach });

QUnit.test("Instance middleware shadows the global middleware factory", (assert) => {
  let globalCalled = false;
  let instanceCalled = false;
  const globalFactory = (): CompositionMiddleware => {
    globalCalled = true;
    return noopFactory();
  };
  const instanceFactory = (): CompositionMiddleware => {
    instanceCalled = true;
    return noopFactory();
  };
  KioskKeyboard.registerMiddleware(["pos-layout"], globalFactory);

  const fromGlobal = getMiddlewareFactory("pos-layout");
  const fromInstance = getMiddlewareFactory("pos-layout", new Map([["pos-layout", instanceFactory]]));
  fromGlobal!();
  fromInstance!();
  assert.ok(globalCalled, "Global factory invoked when no instance map");
  assert.ok(instanceCalled, "Instance factory invoked when instance map provides it");
});

QUnit.test("Instance middleware falls back to global when key not in instance map", (assert) => {
  let globalCalled = false;
  KioskKeyboard.registerMiddleware(["pos-layout"], () => {
    globalCalled = true;
    return noopFactory();
  });

  const factory = getMiddlewareFactory("pos-layout", new Map([["other", () => noopFactory()]]));
  factory!();
  assert.ok(globalCalled, "Falls through to global registration");
});

// ───────────────────────────────────────────────────
// Tier 2 - last-instance auto-cleanup
// ───────────────────────────────────────────────────

QUnit.module("instance-overrides - last-instance auto-cleanup", { afterEach: commonAfterEach });

QUnit.test("Penultimate destroy does not clear globals", async (assert) => {
  KioskKeyboard.registerLayout("app-a-layout", makeLayout("a"));
  KioskKeyboard.registerLocaleLayout("zz", "qwerty");

  const input1 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  const input2 = new Input({ value: "" });
  input2.placeAt("qunit-fixture");

  const kb1 = new KioskKeyboard({ controls: [input1.getId()] });
  const kb2 = new KioskKeyboard({ controls: [input2.getId()] });
  await placeAndWait(kb1);
  await placeAndWait(kb2);

  kb1.destroy();
  input1.destroy();

  assert.ok(KioskKeyboard.getRegisteredLayout("app-a-layout"), "Custom layout still registered after non-last destroy");

  kb2.destroy();
  input2.destroy();
});

QUnit.test("Last destroy clears custom layouts, locale map, and custom middleware", async (assert) => {
  KioskKeyboard.registerLayout("app-a-layout", makeLayout("a"));
  KioskKeyboard.registerLocaleLayout("zz", "qwerty");
  KioskKeyboard.registerMiddleware(["app-a-layout"], () => noopFactory());

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  kb.destroy();
  input.destroy();

  assert.notOk(KioskKeyboard.getRegisteredLayout("app-a-layout"), "Custom layout cleared on last-instance destroy");
  assert.strictEqual(getMiddlewareFactory("app-a-layout"), null, "Custom middleware factory cleared");
  // Built-in layouts and built-in middleware are preserved
  assert.ok(KioskKeyboard.getRegisteredLayout("qwerty"), "Built-in qwerty preserved");
  assert.ok(getMiddlewareFactory("ja-kana"), "Built-in ja-kana middleware preserved");
});

QUnit.test("Last destroy restores overridden built-in layout", async (assert) => {
  const original = KioskKeyboard.getRegisteredLayout("qwerty")!;
  KioskKeyboard.registerLayout("qwerty", makeLayout("override"));

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  kb.destroy();
  input.destroy();

  assert.deepEqual(
    KioskKeyboard.getRegisteredLayout("qwerty"),
    original,
    "Original built-in qwerty restored on last-instance destroy",
  );
});

QUnit.test("Last destroy restores overridden built-in middleware factory", async (assert) => {
  const originalFactory = getMiddlewareFactory("ja-kana");
  KioskKeyboard.registerMiddleware(["ja-kana"], () => noopFactory());
  assert.notStrictEqual(getMiddlewareFactory("ja-kana"), originalFactory, "Built-in is overridden");

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  kb.destroy();
  input.destroy();

  assert.strictEqual(
    getMiddlewareFactory("ja-kana"),
    originalFactory,
    "Original built-in ja-kana factory restored on last-instance destroy",
  );
});

QUnit.test("Instance overrides do not pollute the global registry", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { "app-only": makeLayout("p") },
    instanceLocaleLayouts: { yy: "qwerty" },
    layout: "app-only",
  });
  await placeAndWait(kb);

  assert.notOk(
    KioskKeyboard.getRegisteredLayoutNames().includes("app-only"),
    "Instance-only layout never appears in the global registry",
  );

  input.destroy();
  kb.destroy();
});
