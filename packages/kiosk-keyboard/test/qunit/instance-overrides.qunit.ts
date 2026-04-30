import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import type { LayoutDefinition, CompositionMiddleware } from "ui5/kiosk/types";
import Localization from "sap/base/i18n/Localization";
import type LanguageTag from "sap/base/i18n/LanguageTag";
import { getMiddlewareFactory } from "ui5/kiosk/internal/middleware-registry";
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
  const fixture = document.getElementById("qunit-fixture");
  if (fixture) fixture.innerHTML = "";
}

// ───────────────────────────────────────────────────
// Layout resolution: instance map shadows built-ins, scoped per instance
// ───────────────────────────────────────────────────

QUnit.module("instance-overrides - layout resolution", { afterEach: commonAfterEach });

QUnit.test("Instance layouts shadow built-in layouts of the same name", async (assert) => {
  const customQwerty = [[{ value: "1" }, { value: "2" }]] as LayoutDefinition;

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { qwerty: customQwerty },
    layout: "qwerty",
  });
  await placeAndWait(kb);

  assert.deepEqual(getRenderedLayoutKeys(kb), [["1", "2"]], "Instance map wins over built-in qwerty");

  input.destroy();
  kb.destroy();
});

QUnit.test("Instance layouts that do not match the active name fall through to built-in", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { unrelated: makeLayout("x") },
    layout: "qwerty",
  });
  await placeAndWait(kb);

  const qwerty = KioskKeyboard.getRegisteredLayout("qwerty")!;
  const expected = qwerty.map((row) => row.map((k) => k.value));
  assert.deepEqual(getRenderedLayoutKeys(kb), expected, "Falls through to built-in qwerty");

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

QUnit.test("Instance layouts override built-ins for one control without affecting another", async (assert) => {
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

QUnit.test("setInstanceLayouts after construction re-resolves on next render", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()], layout: "qwerty" });
  await placeAndWait(kb);

  const qwerty = KioskKeyboard.getRegisteredLayout("qwerty")!;
  const builtIn = qwerty.map((row) => row.map((k) => k.value));
  assert.deepEqual(getRenderedLayoutKeys(kb), builtIn, "Renders built-in qwerty before override is set");

  kb.setInstanceLayouts({ qwerty: [[{ value: "1" }, { value: "2" }]] });
  await placeAndWait(kb);

  assert.deepEqual(getRenderedLayoutKeys(kb), [["1", "2"]], "Re-renders with override after setInstanceLayouts");

  kb.setInstanceLayouts(null as unknown as object);
  await placeAndWait(kb);

  assert.deepEqual(getRenderedLayoutKeys(kb), builtIn, "Falls back to built-in after clearing override");

  input.destroy();
  kb.destroy();
});

// ───────────────────────────────────────────────────
// Locale resolution: instance map shadows built-in locale map
// ───────────────────────────────────────────────────

QUnit.module("instance-overrides - locale resolution", { afterEach: commonAfterEach });

QUnit.test("Instance locale map shadows the built-in locale map", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { "warehouse-pos-de": makeLayout("w") },
    instanceLocaleLayouts: { de: "warehouse-pos-de" },
  });
  await placeAndWait(kb);

  assert.strictEqual(kb.getLayout(), "warehouse-pos-de", "Instance locale map selected on construction");
  assert.deepEqual(getRenderedLayoutKeys(kb), [["w"]], "Renders the instance-resolved layout");

  input.destroy();
  kb.destroy();
});

QUnit.test("Instance locale map falls back to built-in when locale not in instance map", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLocaleLayouts: { fr: "qwerty" }, // only fr, current locale is de
  });
  await placeAndWait(kb);

  assert.strictEqual(kb.getLayout(), "qwertz-de", "Falls back to built-in de mapping");

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

QUnit.test("Instance locale overrides do not affect a sibling instance", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));

  const input1 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  const input2 = new Input({ value: "" });
  input2.placeAt("qunit-fixture");

  const kbOverride = new KioskKeyboard({
    controls: [input1.getId()],
    instanceLayouts: { "warehouse-de": makeLayout("wh") },
    instanceLocaleLayouts: { de: "warehouse-de" },
  });
  const kbDefault = new KioskKeyboard({ controls: [input2.getId()] });
  await placeAndWait(kbOverride);
  await placeAndWait(kbDefault);

  assert.strictEqual(kbOverride.getLayout(), "warehouse-de", "Override instance uses warehouse-de");
  assert.strictEqual(kbDefault.getLayout(), "qwertz-de", "Sibling sees built-in de mapping unchanged");

  input1.destroy();
  input2.destroy();
  kbOverride.destroy();
  kbDefault.destroy();
});

// ───────────────────────────────────────────────────
// Middleware resolution: instance map shadows built-in factory
// ───────────────────────────────────────────────────

QUnit.module("instance-overrides - middleware resolution", { afterEach: commonAfterEach });

QUnit.test("Instance middleware shadows the built-in middleware factory", (assert) => {
  let instanceCalled = false;
  const instanceFactory = (): CompositionMiddleware => {
    instanceCalled = true;
    return noopFactory();
  };

  // ja-kana has a built-in middleware factory; the instance map must take precedence.
  const factory = getMiddlewareFactory("ja-kana", new Map([["ja-kana", instanceFactory]]));
  factory!();
  assert.ok(instanceCalled, "Instance factory invoked when instance map provides it");
});

QUnit.test("Instance middleware falls back to built-in when key not in instance map", (assert) => {
  const factory = getMiddlewareFactory("ja-kana", new Map([["other", () => noopFactory()]]));
  assert.notStrictEqual(factory, null, "Falls through to built-in registration");
});

// ───────────────────────────────────────────────────
// Instance overrides are scoped per control - never global
// ───────────────────────────────────────────────────

QUnit.module("instance-overrides - scoping", { afterEach: commonAfterEach });

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

QUnit.test("Destroying one instance does not affect another's overrides", async (assert) => {
  const input1 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  const input2 = new Input({ value: "" });
  input2.placeAt("qunit-fixture");

  const kb1 = new KioskKeyboard({
    controls: [input1.getId()],
    instanceLayouts: { shared: makeLayout("one") },
    layout: "shared",
  });
  const kb2 = new KioskKeyboard({
    controls: [input2.getId()],
    instanceLayouts: { shared: makeLayout("two") },
    layout: "shared",
  });
  await placeAndWait(kb1);
  await placeAndWait(kb2);

  assert.deepEqual(getRenderedLayoutKeys(kb1), [["one"]], "kb1 sees its own override");
  assert.deepEqual(getRenderedLayoutKeys(kb2), [["two"]], "kb2 sees its own override");

  kb1.destroy();
  input1.destroy();

  assert.deepEqual(getRenderedLayoutKeys(kb2), [["two"]], "kb2 unaffected after kb1 destroyed");

  kb2.destroy();
  input2.destroy();
});
