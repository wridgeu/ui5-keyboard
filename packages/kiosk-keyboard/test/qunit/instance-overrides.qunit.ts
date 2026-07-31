import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import Log from "sap/base/Log";
import type { LayoutDefinition, CompositionMiddleware } from "ui5/kiosk/types";
import Localization from "sap/base/i18n/Localization";
import type LanguageTag from "sap/base/i18n/LanguageTag";
import { placeAndWait, getRenderedLayoutKeys, getRequiredKeyElement, tapKey } from "./test-helpers";

const DOM = KioskKeyboard.DOM;

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

// ───────────────────────────────────────────────────
// Key normalization: instance map keys are stored lowercase to match
// the lowercase-normalizing lookup paths.
// ───────────────────────────────────────────────────

QUnit.module("instance-overrides - key normalization", { afterEach: commonAfterEach });

QUnit.test("Mixed-case instance layout names resolve through lowercase lookup", async (assert) => {
  const customQwerty = [[{ value: "X" }]] as LayoutDefinition;

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { Qwerty: customQwerty },
    layout: "qwerty",
  });
  await placeAndWait(kb);

  assert.deepEqual(getRenderedLayoutKeys(kb), [["X"]], "Mixed-case key 'Qwerty' shadows built-in 'qwerty'");

  input.destroy();
  kb.destroy();
});

QUnit.test("Mixed-case language tag in instance locale map resolves case-insensitively", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLayouts: { "Warehouse-DE": makeLayout("wh") },
    instanceLocaleLayouts: { DE: "Warehouse-DE" },
  });
  await placeAndWait(kb);

  assert.strictEqual(kb.getLayout(), "warehouse-de", "Mixed-case 'DE' resolves to lowercased layout name");
  assert.deepEqual(getRenderedLayoutKeys(kb), [["wh"]], "Resolved layout renders");

  input.destroy();
  kb.destroy();
});

QUnit.test("Mixed-case BCP-47 region in instance locale map resolves case-insensitively", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("en", "GB"));

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceLocaleLayouts: { "EN-GB": "qwerty" },
  });
  await placeAndWait(kb);

  assert.strictEqual(kb.getLayout(), "qwerty", "Mixed-case 'EN-GB' resolves to qwerty via locale lookup");

  input.destroy();
  kb.destroy();
});

// ───────────────────────────────────────────────────
// Runtime middleware swap: setting `instanceMiddleware` after the active
// middleware was lazily cached must reset the cache so the next key press
// resolves the new factory.
// ───────────────────────────────────────────────────

QUnit.module("instance-overrides - runtime middleware swap", { afterEach: commonAfterEach });

QUnit.test("setInstanceMiddleware after first key resets the cached middleware", async (assert) => {
  let firstFactoryCalls = 0;
  const firstFactory = (): CompositionMiddleware => {
    firstFactoryCalls += 1;
    return noopFactory();
  };

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    instanceMiddleware: { qwerty: firstFactory },
    layout: "qwerty",
  });
  await placeAndWait(kb);

  // First key press lazy-creates the middleware via the first factory.
  tapKey(kb, "a");
  assert.strictEqual(firstFactoryCalls, 1, "First factory invoked on first key press");

  // Subsequent presses reuse the cached middleware - factory not re-invoked.
  tapKey(kb, "b");
  assert.strictEqual(firstFactoryCalls, 1, "First factory cached across presses");

  let secondFactoryCalls = 0;
  const secondFactory = (): CompositionMiddleware => {
    secondFactoryCalls += 1;
    return noopFactory();
  };
  kb.setInstanceMiddleware({ qwerty: secondFactory });

  // Next key press resolves through the new factory.
  tapKey(kb, "c");
  assert.strictEqual(secondFactoryCalls, 1, "Second factory invoked after swap");
  assert.strictEqual(firstFactoryCalls, 1, "First factory not re-invoked");

  input.destroy();
  kb.destroy();
});

// ───────────────────────────────────────────────────
// Accent-variant tables: instanceVariants shadows/opts-out the built-in
// Latin-diacritic table per layout, keyed lowercase, invalid entries skipped.
// ───────────────────────────────────────────────────

QUnit.module("instance-overrides - accent-variant tables", { afterEach: commonAfterEach });

QUnit.test(
  "Invalid instanceVariants entries warn and are skipped, falling through to the built-in table",
  async (assert) => {
    const warn = sandbox.stub(Log, "warning");
    const input = new Input({ value: "" });
    input.placeAt("qunit-fixture");

    const kb = new KioskKeyboard({
      controls: [input.getId()],
      accentVariants: true,
      layout: "qwerty",
      instanceVariants: { qwerty: { a: [""] } }, // empty glyph -> invalid table
    });
    await placeAndWait(kb);

    assert.ok(warn.called, "an invalid entry is logged");
    assert.strictEqual(
      getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
      true,
      "the invalid entry is dropped, so 'a' falls through to the built-in Latin table",
    );

    input.destroy();
    kb.destroy();
  },
);

QUnit.test("Table-shaped impostors are rejected rather than read as an empty table", async (assert) => {
  // Each of these has no own enumerable values, so a validator that only inspects
  // Object.values would accept it, shadow the built-in table and arm nothing.
  const impostors: Record<string, unknown> = {
    array: [],
    map: new Map([["a", ["ä"]]]),
    date: new Date(),
    empty: {},
  };

  for (const [label, table] of Object.entries(impostors)) {
    const warn = sandbox.stub(Log, "warning");
    const input = new Input({ value: "" });
    input.placeAt("qunit-fixture");
    const kb = new KioskKeyboard({
      controls: [input.getId()],
      accentVariants: true,
      layout: "qwerty",
      instanceVariants: { qwerty: table },
    });
    await placeAndWait(kb);

    assert.ok(warn.called, `${label} is logged as invalid`);
    assert.strictEqual(
      getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
      true,
      `${label} is skipped, so 'a' keeps the built-in table`,
    );

    input.destroy();
    kb.destroy();
    warn.restore();
  }
});

QUnit.test("Base letters that are not lowercase are rejected rather than silently normalized", async (assert) => {
  // The table is matched against key.value.toLowerCase(), so an uppercased or padded
  // base letter would arm nothing while shadowing the built-in for that layout.
  for (const base of ["A", "a "]) {
    const warn = sandbox.stub(Log, "warning");
    const input = new Input({ value: "" });
    input.placeAt("qunit-fixture");
    const kb = new KioskKeyboard({
      controls: [input.getId()],
      accentVariants: true,
      layout: "qwerty",
      instanceVariants: { qwerty: { [base]: ["ä"] } },
    });
    await placeAndWait(kb);

    assert.ok(
      warn.getCalls().some((call) => String(call.args[0]).includes("lowercase base letters")),
      `"${base}" is logged as invalid`,
    );
    assert.strictEqual(
      getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
      true,
      `"${base}" is skipped, so 'a' keeps the built-in table`,
    );

    input.destroy();
    kb.destroy();
    warn.restore();
  }
});

QUnit.test("Mixed-case instanceVariants layout names resolve through lowercase lookup", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    accentVariants: true,
    layout: "qwerty",
    instanceVariants: { QWERTY: { b: ["ḃ"] } },
  });
  await placeAndWait(kb);

  assert.strictEqual(
    getRequiredKeyElement(kb, "b").hasAttribute(DOM.attributes.hasVariants),
    true,
    "mixed-case 'QWERTY' resolves the entry onto built-in 'qwerty'",
  );
  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    true,
    "the entry merges, so built-in 'a' survives",
  );

  input.destroy();
  kb.destroy();
});

QUnit.test("An instanceVariants entry suppresses one built-in letter with an empty list", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    accentVariants: true,
    layout: "qwerty",
    instanceVariants: { qwerty: { a: [] } },
  });
  await placeAndWait(kb);

  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    false,
    "the letter mapped to an empty list loses its popup",
  );
  assert.strictEqual(
    getRequiredKeyElement(kb, "o").hasAttribute(DOM.attributes.hasVariants),
    true,
    "every other built-in letter is untouched",
  );

  input.destroy();
  kb.destroy();
});

QUnit.test("instanceVariants without accentVariants warns once and applies nothing", async (assert) => {
  const warn = sandbox.stub(Log, "warning");
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: [input.getId()],
    layout: "qwerty",
    instanceVariants: { qwerty: { b: ["ḃ"] } },
  });
  await placeAndWait(kb);

  assert.strictEqual(
    getRequiredKeyElement(kb, "b").hasAttribute(DOM.attributes.hasVariants),
    false,
    "the disarmed gate applies no table",
  );
  const countDisarmedWarnings = (): number =>
    warn
      .getCalls()
      .filter((call) => String(call.args[0]).includes("instanceVariants is set but accentVariants is false")).length;
  assert.strictEqual(countDisarmedWarnings(), 1, "the diagnostic is emitted exactly once");

  kb.invalidate();
  await placeAndWait(kb);
  assert.strictEqual(countDisarmedWarnings(), 1, "and is not repeated on re-render");

  input.destroy();
  kb.destroy();
});

QUnit.test("A custom layout opts out of the built-in table with a null entry", async (assert) => {
  // The README's opt-out recipe, exercised on an instanceLayouts-registered
  // layout rather than a built-in: a custom Latin layout inherits the built-in
  // table through `accentVariants`, and `{ "<layout>": null }` is the documented
  // way to take it back off.
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const customLayout = { mylayout: [[{ value: "a" }, { value: "b" }, { value: "e" }]] };

  const armed = new KioskKeyboard({
    controls: [input.getId()],
    accentVariants: true,
    instanceLayouts: customLayout,
    layout: "mylayout",
  });
  await placeAndWait(armed);
  assert.strictEqual(
    getRequiredKeyElement(armed, "a").hasAttribute(DOM.attributes.hasVariants),
    true,
    "a custom layout inherits the built-in table",
  );
  armed.destroy();

  const optedOut = new KioskKeyboard({
    controls: [input.getId()],
    accentVariants: true,
    instanceLayouts: customLayout,
    layout: "mylayout",
    instanceVariants: { mylayout: null },
  });
  await placeAndWait(optedOut);
  assert.strictEqual(
    getRequiredKeyElement(optedOut, "a").hasAttribute(DOM.attributes.hasVariants),
    false,
    "a null entry opts the custom layout out",
  );

  input.destroy();
  optedOut.destroy();
});

QUnit.test("setInstanceVariants after construction re-resolves on next render", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()], accentVariants: true, layout: "qwerty" });
  await placeAndWait(kb);
  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    true,
    "built-in 'a' armed before the override",
  );

  kb.setInstanceVariants({ qwerty: null });
  await placeAndWait(kb);
  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    false,
    "opted out after setInstanceVariants",
  );

  kb.setInstanceVariants(null);
  await placeAndWait(kb);
  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    true,
    "built-in restored after clearing the override",
  );

  input.destroy();
  kb.destroy();
});
