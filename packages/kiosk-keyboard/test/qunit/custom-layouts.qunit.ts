import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { $KioskKeyboardSettings } from "ui5/kiosk/KioskKeyboard";
import CustomLayout from "ui5/kiosk/CustomLayout";
import { LayoutFacet, LayoutRole } from "ui5/kiosk/library";
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

/**
 * Middleware factory recording the lifecycle calls the keyboard makes on it.
 * `handleKey` consumes every key, so the middleware is mid-composition from the
 * first tap onwards and a `commit` / `reset` is observable as the difference
 * between flushing the buffered syllable and dropping it.
 */
function recordingFactory(): {
  calls: { created: number; commits: number; resets: number };
  factory: () => CompositionMiddleware;
} {
  const calls = { created: 0, commits: 0, resets: 0 };
  const factory = (): CompositionMiddleware => {
    calls.created++;
    return {
      handleKey: () => true,
      commit: () => {
        calls.commits++;
        return null;
      },
      reset: () => {
        calls.resets++;
      },
    };
  };
  return { calls, factory };
}

const sandbox = sinon.createSandbox();

/** Everything `mount` created, destroyed after each test even when one throws. */
const mounted: { destroy(): void }[] = [];

/**
 * A keyboard bound to a fresh input, placed and rendered. `controls` is wired to that
 * input unless the settings name their own, and teardown is the module's, so a failing
 * assertion cannot leak a control into the next test.
 */
async function mount(settings: $KioskKeyboardSettings): Promise<{ kb: KioskKeyboard; input: Input }> {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()], ...settings });
  mounted.push(kb, input);
  await placeAndWait(kb);
  return { kb, input };
}

function commonAfterEach(): void {
  sandbox.restore();
  while (mounted.length > 0) mounted.pop()!.destroy();
  const fixture = document.getElementById("qunit-fixture");
  if (fixture) fixture.innerHTML = "";
}

// ───────────────────────────────────────────────────
// Layout resolution: a custom layout shadows the built-in of the same name,
// scoped per control
// ───────────────────────────────────────────────────

QUnit.module("custom-layouts - layout resolution", { afterEach: commonAfterEach });

QUnit.test("A custom layout shadows the built-in layout of the same name", async (assert) => {
  const customQwerty = [[{ value: "1" }, { value: "2" }]] as LayoutDefinition;

  const { kb } = await mount({
    customLayouts: [new CustomLayout({ name: "qwerty", rows: customQwerty })],
    layout: "qwerty",
  });

  assert.deepEqual(getRenderedLayoutKeys(kb), [["1", "2"]], "The custom layout wins over built-in qwerty");
});

QUnit.test("A custom layout that does not match the active name falls through to built-in", async (assert) => {
  const { kb } = await mount({
    customLayouts: [new CustomLayout({ name: "unrelated", rows: makeLayout("x") })],
    layout: "qwerty",
  });

  const qwerty = KioskKeyboard.getRegisteredLayout("qwerty")!;
  const expected = qwerty.map((row) => row.map((k) => k.value));
  assert.deepEqual(getRenderedLayoutKeys(kb), expected, "Falls through to built-in qwerty");
});

QUnit.test("Unknown layout falls through to built-in default qwerty", async (assert) => {
  const { kb } = await mount({
    customLayouts: [new CustomLayout({ name: "other", rows: makeLayout("o") })],
    layout: "nonexistent",
  });

  const qwerty = KioskKeyboard.getRegisteredLayout("qwerty")!;
  const expected = qwerty.map((row) => row.map((k) => k.value));
  assert.deepEqual(getRenderedLayoutKeys(kb), expected, "Falls through to built-in qwerty");
});

QUnit.test("A custom layout overrides a built-in for one control without affecting another", async (assert) => {
  const customQwerty = [[{ value: "1" }, { value: "2" }]] as LayoutDefinition;

  const input1 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  const input2 = new Input({ value: "" });
  input2.placeAt("qunit-fixture");

  const kbWithOverride = new KioskKeyboard({
    controls: [input1.getId()],
    customLayouts: [new CustomLayout({ name: "qwerty", rows: customQwerty })],
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

QUnit.test("Rows that are not a layout definition are reported and dropped", async (assert) => {
  const warn = sandbox.stub(Log, "warning");
  // An empty array clears the coarse `LayoutRows` type check and is rejected by the
  // fold, so the layout resolves to nothing and the surface falls back to qwerty.
  const { kb } = await mount({
    customLayouts: [new CustomLayout({ name: "broken", rows: [] })],
    layout: "broken",
  });

  const qwerty = KioskKeyboard.getRegisteredLayout("qwerty")!;
  const expected = qwerty.map((row) => row.map((k) => k.value));
  assert.deepEqual(getRenderedLayoutKeys(kb), expected, "Falls back to the default when the rows are unusable");
  assert.ok(
    warn.getCalls().some((call) => String(call.args[0]).includes("is not a layout definition")),
    "the rejected rows are reported",
  );
});

QUnit.test("Rows that are not even an array are rejected loudly by the property type", (assert) => {
  assert.throws(
    () => new CustomLayout({ name: "broken", rows: "not-an-array" as unknown as LayoutDefinition }),
    "a shape the rows type cannot accept fails at assignment rather than resolving to nothing",
  );
});

QUnit.test("Adding a custom layout after construction re-resolves on the next render", async (assert) => {
  const { kb } = await mount({ layout: "qwerty" });

  const qwerty = KioskKeyboard.getRegisteredLayout("qwerty")!;
  const builtIn = qwerty.map((row) => row.map((k) => k.value));
  assert.deepEqual(getRenderedLayoutKeys(kb), builtIn, "Renders built-in qwerty before the custom layout is added");

  kb.addCustomLayout(new CustomLayout({ name: "qwerty", rows: [[{ value: "1" }, { value: "2" }]] }));
  await placeAndWait(kb);

  assert.deepEqual(getRenderedLayoutKeys(kb), [["1", "2"]], "Re-renders with the custom layout after adding it");

  kb.destroyCustomLayouts();
  await placeAndWait(kb);

  assert.deepEqual(getRenderedLayoutKeys(kb), builtIn, "Falls back to built-in after destroying the aggregation");
});

QUnit.test("Removing a custom layout makes the next resolution fall back", async (assert) => {
  const entry = new CustomLayout({ name: "qwerty", rows: [[{ value: "1" }]] });
  const { kb } = await mount({ customLayouts: [entry], layout: "qwerty" });
  assert.deepEqual(getRenderedLayoutKeys(kb), [["1"]], "precondition: the custom layout renders");

  kb.removeCustomLayout(entry);
  await placeAndWait(kb);
  const qwerty = KioskKeyboard.getRegisteredLayout("qwerty")!;
  assert.deepEqual(
    getRenderedLayoutKeys(kb),
    qwerty.map((row) => row.map((k) => k.value)),
    "removal is a structural change the fold notices without being told which child left",
  );

  entry.destroy();
});

QUnit.test("Editing a custom layout's rows re-resolves on the next render", async (assert) => {
  const entry = new CustomLayout({ name: "qwerty", rows: [[{ value: "1" }]] });
  const { kb } = await mount({ customLayouts: [entry], layout: "qwerty" });

  // A property write inside a parented child reaches the control as an invalidation
  // naming that child; the fold is rebuilt lazily on the next read.
  entry.setRows([[{ value: "2" }]]);
  await placeAndWait(kb);
  assert.deepEqual(getRenderedLayoutKeys(kb), [["2"]], "the edited rows render");
});

QUnit.test("Custom layouts apply in aggregation order, and the last rows win", async (assert) => {
  const warn = sandbox.stub(Log, "warning");
  const { kb } = await mount({
    customLayouts: [
      new CustomLayout({ name: "dup", rows: makeLayout("first") }),
      new CustomLayout({ name: "dup", rows: makeLayout("second") }),
    ],
    layout: "dup",
  });

  assert.deepEqual(getRenderedLayoutKeys(kb), [["second"]], "the later declaration wins");
  assert.ok(
    warn.getCalls().some((call) => String(call.args[0]).includes('Two custom layouts declare "rows"')),
    "and the collision is reported",
  );
});

// ───────────────────────────────────────────────────
// Locale resolution: a custom layout's `locales` shadow the built-in locale map
// ───────────────────────────────────────────────────

QUnit.module("custom-layouts - locale resolution", { afterEach: commonAfterEach });

QUnit.test("A custom layout's locales shadow the built-in locale map", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));

  // `de` maps to the built-in `qwertz-de`, and the claimed name is one only this
  // control declares - so this pins both halves of the resolution order at once.
  const { kb } = await mount({
    customLayouts: [new CustomLayout({ name: "warehouse-de", rows: makeLayout("wh"), locales: ["de"] })],
  });

  assert.strictEqual(kb.getLayout(), "warehouse-de", "the control-only name wins over the built-in de mapping");
  assert.deepEqual(getRenderedLayoutKeys(kb), [["wh"]], "and its rows render");
});

QUnit.test("Falls back to the built-in locale map when no custom layout claims the locale", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));

  const { kb } = await mount({
    // Only fr is claimed; the current locale is de.
    customLayouts: [new CustomLayout({ name: "qwerty", locales: ["fr"] })],
  });

  assert.strictEqual(kb.getLayout(), "qwertz-de", "Falls back to the built-in de mapping");
});

QUnit.test("A rows-less custom layout binds a locale to a built-in layout", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));

  // The overlay form: no rows, so it points the locale at the layout `name`
  // already resolves to.
  const { kb } = await mount({
    customLayouts: [new CustomLayout({ name: "ja-kana", locales: ["de"] })],
  });

  assert.strictEqual(kb.getLayout(), "ja-kana", "the locale resolves to the built-in the overlay names");
});

QUnit.test("Locale bindings do not affect a sibling instance", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));

  const input1 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  const input2 = new Input({ value: "" });
  input2.placeAt("qunit-fixture");

  const kbOverride = new KioskKeyboard({
    controls: [input1.getId()],
    customLayouts: [new CustomLayout({ name: "warehouse-de", rows: makeLayout("wh"), locales: ["de"] })],
  });
  const kbDefault = new KioskKeyboard({ controls: [input2.getId()] });
  await placeAndWait(kbOverride);
  await placeAndWait(kbDefault);

  assert.strictEqual(kbOverride.getLayout(), "warehouse-de", "Override instance uses warehouse-de");
  assert.strictEqual(kbDefault.getLayout(), "qwertz-de", "Sibling sees the built-in de mapping unchanged");

  input1.destroy();
  input2.destroy();
  kbOverride.destroy();
  kbDefault.destroy();
});

// ───────────────────────────────────────────────────
// Custom layouts are scoped per control - never global
// ───────────────────────────────────────────────────

QUnit.module("custom-layouts - scoping", { afterEach: commonAfterEach });

QUnit.test("Custom layouts do not pollute the global registry", async (assert) => {
  await mount({
    customLayouts: [new CustomLayout({ name: "app-only", rows: makeLayout("p"), locales: ["yy"] })],
    layout: "app-only",
  });

  assert.notOk(
    KioskKeyboard.getRegisteredLayoutNames().includes("app-only"),
    "A control-only layout never appears in the global registry",
  );
});

QUnit.test("Destroying one instance does not affect another's custom layouts", async (assert) => {
  const input1 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  const input2 = new Input({ value: "" });
  input2.placeAt("qunit-fixture");

  const kb1 = new KioskKeyboard({
    controls: [input1.getId()],
    customLayouts: [new CustomLayout({ name: "shared", rows: makeLayout("one") })],
    layout: "shared",
  });
  const kb2 = new KioskKeyboard({
    controls: [input2.getId()],
    customLayouts: [new CustomLayout({ name: "shared", rows: makeLayout("two") })],
    layout: "shared",
  });
  await placeAndWait(kb1);
  await placeAndWait(kb2);

  assert.deepEqual(getRenderedLayoutKeys(kb1), [["one"]], "kb1 sees its own custom layout");
  assert.deepEqual(getRenderedLayoutKeys(kb2), [["two"]], "kb2 sees its own custom layout");

  kb1.destroy();
  input1.destroy();

  assert.deepEqual(getRenderedLayoutKeys(kb2), [["two"]], "kb2 unaffected after kb1 destroyed");

  kb2.destroy();
  input2.destroy();
});

// ───────────────────────────────────────────────────
// Key normalization: names and locale tags are stored lowercase to match
// the lowercase-normalizing lookup paths.
// ───────────────────────────────────────────────────

QUnit.module("custom-layouts - key normalization", { afterEach: commonAfterEach });

QUnit.test("Mixed-case layout names resolve through lowercase lookup", async (assert) => {
  const customQwerty = [[{ value: "X" }]] as LayoutDefinition;

  const { kb } = await mount({
    customLayouts: [new CustomLayout({ name: "Qwerty", rows: customQwerty })],
    layout: "qwerty",
  });

  assert.deepEqual(getRenderedLayoutKeys(kb), [["X"]], "Mixed-case 'Qwerty' shadows built-in 'qwerty'");
});

QUnit.test("Mixed-case language tags resolve case-insensitively", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("de"));

  const { kb } = await mount({
    customLayouts: [new CustomLayout({ name: "Warehouse-DE", rows: makeLayout("wh"), locales: ["DE"] })],
  });

  assert.strictEqual(kb.getLayout(), "warehouse-de", "Mixed-case 'DE' resolves to the lowercased layout name");
  assert.deepEqual(getRenderedLayoutKeys(kb), [["wh"]], "Resolved layout renders");
});

QUnit.test("Mixed-case BCP-47 regions resolve case-insensitively", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("en", "GB"));

  const { kb } = await mount({
    customLayouts: [new CustomLayout({ name: "qwerty", locales: ["EN-GB"] })],
  });

  assert.strictEqual(kb.getLayout(), "qwerty", "Mixed-case 'EN-GB' resolves to qwerty via locale lookup");
});

QUnit.test("A single locale string widens to a one-entry list, whichever form the caller wrote", async (assert) => {
  sandbox.stub(Localization, "getLanguageTag").returns(langTag("pl"));

  // A plain-JS caller passing an object literal goes through the aggregation's
  // `defaultClass`, so it must coerce exactly as an explicit construction does.
  const fromLiteral = new KioskKeyboard({
    customLayouts: [{ name: "pl-warehouse", rows: makeLayout("p"), locales: "pl" }] as unknown as CustomLayout[],
  });
  const fromInstance = new KioskKeyboard({
    customLayouts: [new CustomLayout({ name: "pl-warehouse", rows: makeLayout("p"), locales: ["pl"] })],
  });

  assert.strictEqual(fromLiteral.getLayout(), "pl-warehouse", "the literal form resolves the locale");
  assert.strictEqual(fromInstance.getLayout(), fromLiteral.getLayout(), "and the instance form agrees");
  assert.deepEqual(fromLiteral.getCustomLayouts()[0]!.getLocales(), ["pl"], "the string widened to a list");

  fromLiteral.destroy();
  fromInstance.destroy();
});

// ───────────────────────────────────────────────────
// The layout role tri-state
// ───────────────────────────────────────────────────

QUnit.module("custom-layouts - layoutRole", { afterEach: commonAfterEach });

QUnit.test("An omitted layoutRole inherits the built-in of the same name's role", async (assert) => {
  // `numeric` is a built-in secondary surface. Declaring rows for it without naming
  // a role must leave it secondary, so `{layout:base}` still returns elsewhere.
  const { kb } = await mount({
    customLayouts: [new CustomLayout({ name: "numeric", rows: makeLayout("s") })],
    layout: "qwerty",
  });
  kb.setLayout("numeric");

  assert.strictEqual(kb.getBaseLayout(), "qwerty", "the inherited secondary flag keeps qwerty as the base");
});

QUnit.test("layoutRole=Base un-marks the built-in's secondary flag", async (assert) => {
  const { kb } = await mount({
    customLayouts: [new CustomLayout({ name: "numeric", rows: makeLayout("s"), layoutRole: LayoutRole.Base })],
    layout: "qwerty",
  });
  kb.setLayout("numeric");

  assert.strictEqual(kb.getBaseLayout(), "numeric", "promoted to a base alphabetic layout");
});

QUnit.test("layoutRole=Secondary marks a layout with no built-in as an auxiliary surface", async (assert) => {
  const { kb } = await mount({
    customLayouts: [new CustomLayout({ name: "symbols", rows: makeLayout("§"), layoutRole: LayoutRole.Secondary })],
    layout: "qwerty",
  });
  kb.setLayout("symbols");

  assert.strictEqual(kb.getBaseLayout(), "qwerty", "an auxiliary surface is never tracked as the base");
});

QUnit.test("A layoutRole outside the closed set is rejected at assignment", (assert) => {
  assert.throws(
    () => new CustomLayout({ name: "x", layoutRole: "base" as unknown as LayoutRole }),
    "a typo in a closed enum fails loudly rather than resolving to the default",
  );
});

// ───────────────────────────────────────────────────
// Composition middleware
// ───────────────────────────────────────────────────

QUnit.module("custom-layouts - middleware", { afterEach: commonAfterEach });

QUnit.test("A middleware swap after the first key resolves the new factory", async (assert) => {
  let firstFactoryCalls = 0;
  const firstFactory = (): CompositionMiddleware => {
    firstFactoryCalls += 1;
    return noopFactory();
  };

  const entry = new CustomLayout({ name: "qwerty", middleware: firstFactory });
  const { kb } = await mount({ customLayouts: [entry], layout: "qwerty" });

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
  entry.setMiddleware(secondFactory);

  // Next key press resolves through the new factory.
  tapKey(kb, "c");
  assert.strictEqual(secondFactoryCalls, 1, "Second factory invoked after the swap");
  assert.strictEqual(firstFactoryCalls, 1, "First factory not re-invoked");
});

QUnit.test("A middleware swap commits the in-progress composition instead of discarding it", async (assert) => {
  const first = recordingFactory();
  const entry = new CustomLayout({ name: "qwerty", middleware: first.factory });
  const { kb, input } = await mount({ customLayouts: [entry], layout: "qwerty" });
  input.focus();

  tapKey(kb, "a");
  assert.strictEqual(first.calls.created, 1, "Middleware instantiated on the first key press");

  entry.setMiddleware(recordingFactory().factory);
  // The swap is committed at the next composition-affecting key rather than at
  // assignment: `commit()` finalises a preedit already written into the target, so
  // deferring keeps it visible and never drops it.
  tapKey(kb, "b");

  assert.strictEqual(first.calls.commits, 1, "The half-typed syllable reaches the target");
  assert.strictEqual(first.calls.resets, 0, "The composition is flushed, not dropped");
});

QUnit.test("A swap that leaves the resolved layout's factory alone keeps the composition", async (assert) => {
  const qwerty = recordingFactory();
  const other = new CustomLayout({ name: "ko-hangul" });
  const { kb, input } = await mount({
    customLayouts: [new CustomLayout({ name: "qwerty", middleware: qwerty.factory }), other],
    layout: "qwerty",
  });
  input.focus();

  tapKey(kb, "a");
  assert.strictEqual(qwerty.calls.created, 1, "Middleware instantiated on the first key press");

  // A real edit, but to an entry the resolved layout never reads.
  other.setMiddleware(recordingFactory().factory);
  tapKey(kb, "b");

  assert.strictEqual(qwerty.calls.commits, 0, "The composition is left in progress");
  assert.strictEqual(qwerty.calls.resets, 0, "The composition is not dropped");
  assert.strictEqual(qwerty.calls.created, 1, "The cached middleware is reused, not rebuilt");
});

QUnit.test("Editing an unrelated custom layout mid-composition leaves the buffer alone", async (assert) => {
  const qwerty = recordingFactory();
  const unrelated = new CustomLayout({ name: "ko-hangul", keycapLang: "ko" });
  const { kb, input } = await mount({
    customLayouts: [new CustomLayout({ name: "qwerty", middleware: qwerty.factory }), unrelated],
    layout: "qwerty",
  });
  input.focus();

  tapKey(kb, "a");
  assert.strictEqual(qwerty.calls.created, 1, "precondition: a composition is in progress");

  // A property write drops a cache and nothing else; it must never reach the
  // composition, which is why the fold is never rebuilt from `invalidate`.
  unrelated.setKeycapLang("ko-KR");
  await placeAndWait(kb);

  assert.strictEqual(qwerty.calls.commits, 0, "the preedit survives the edit");
  assert.strictEqual(qwerty.calls.resets, 0, "and is not dropped either");
});

QUnit.test("suppress=Middleware disables the built-in composer for the layout", async (assert) => {
  // `ko-hangul` arms the built-in Hangul composer. Suppressing the facet is the
  // only way to type its rows directly; at HEAD this was unrepresentable.
  const { kb, input } = await mount({
    customLayouts: [new CustomLayout({ name: "ko-hangul", suppress: [LayoutFacet.Middleware] })],
    layout: "ko-hangul",
  });
  input.focus();

  tapKey(kb, "ㄱ");
  tapKey(kb, "ㅏ");

  assert.strictEqual(input.getValue(), "ㄱㅏ", "the jamo are typed uncomposed rather than forming 가");
});

QUnit.test("A factory declared alongside the suppression still applies", async (assert) => {
  const own = recordingFactory();
  const { kb, input } = await mount({
    customLayouts: [
      new CustomLayout({ name: "ko-hangul", suppress: [LayoutFacet.Middleware], middleware: own.factory }),
    ],
    layout: "ko-hangul",
  });
  input.focus();

  tapKey(kb, "ㄱ");
  assert.strictEqual(own.calls.created, 1, "suppression drops the inherited value, not the declared one");
});

QUnit.test("A layout name that stopped resolving reads the middleware of the rendered surface", async (assert) => {
  let qwertyCalls = 0;
  let pinpadCalls = 0;

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  // setLayout refuses an unregistered name, so the only way the property outlives its
  // declaration is to drop the custom layout it came from. The surface then falls back
  // to qwerty and the middleware has to follow it, not the name still on the property.
  const rows = new CustomLayout({ name: "pinpad", rows: makeLayout("p") });
  const kb = new KioskKeyboard({
    controls: [input.getId()],
    layout: "pinpad",
    customLayouts: [
      rows,
      new CustomLayout({
        name: "qwerty",
        middleware: (): CompositionMiddleware => {
          qwertyCalls += 1;
          return noopFactory();
        },
      }),
      new CustomLayout({
        name: "pinpad",
        middleware: (): CompositionMiddleware => {
          pinpadCalls += 1;
          return noopFactory();
        },
      }),
    ],
  });
  await placeAndWait(kb);
  assert.strictEqual(kb.getLayout(), "pinpad", "precondition: the custom layout is the active one");

  kb.removeCustomLayout(rows);
  await placeAndWait(kb);

  tapKey(kb, "a");
  assert.strictEqual(qwertyCalls, 1, "the rendered layout's factory runs");
  assert.strictEqual(pinpadCalls, 0, "the unresolved name's factory does not");

  rows.destroy();
});

// ───────────────────────────────────────────────────
// Accent-variant tables: a custom layout's `variants` merge onto the tier below
// per base letter, keyed lowercase, invalid tables reported and skipped.
// ───────────────────────────────────────────────────

QUnit.module("custom-layouts - accent-variant tables", { afterEach: commonAfterEach });

QUnit.test("An invalid variant table is reported and skipped", async (assert) => {
  const warn = sandbox.stub(Log, "warning");
  const { kb } = await mount({
    accentVariants: true,
    layout: "qwerty",
    // An empty glyph makes the table unusable.
    customLayouts: [new CustomLayout({ name: "qwerty", variants: { a: [""] } })],
  });

  assert.ok(
    warn.getCalls().some((call) => String(call.args[0]).includes("is not a variant table")),
    "an invalid table is reported",
  );
  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    true,
    "the invalid table is dropped, so 'a' falls through to the built-in Latin table",
  );
});

QUnit.test("Table-shaped impostors are rejected rather than read as an empty table", async (assert) => {
  // Each of these has no own enumerable values, so a validator that only inspects
  // Object.values would accept it, shadow the built-in table and arm nothing.
  const impostors: Record<string, unknown> = {
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
      customLayouts: [new CustomLayout({ name: "qwerty", variants: table as Record<string, string[]> })],
    });
    await placeAndWait(kb);

    assert.ok(warn.called, `${label} is reported as invalid`);
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
  // base letter would arm nothing while shadowing the tier below.
  for (const base of ["A", "a "]) {
    const warn = sandbox.stub(Log, "warning");
    const input = new Input({ value: "" });
    input.placeAt("qunit-fixture");
    const kb = new KioskKeyboard({
      controls: [input.getId()],
      accentVariants: true,
      layout: "qwerty",
      customLayouts: [new CustomLayout({ name: "qwerty", variants: { [base]: ["ä"] } })],
    });
    await placeAndWait(kb);

    assert.ok(
      warn.getCalls().some((call) => String(call.args[0]).includes("lowercase base letters")),
      `"${base}" is reported as invalid`,
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

QUnit.test("Mixed-case layout names resolve the variant table through lowercase lookup", async (assert) => {
  const { kb } = await mount({
    accentVariants: true,
    layout: "qwerty",
    customLayouts: [new CustomLayout({ name: "QWERTY", variants: { b: ["ḃ"] } })],
  });

  assert.strictEqual(
    getRequiredKeyElement(kb, "b").hasAttribute(DOM.attributes.hasVariants),
    true,
    "mixed-case 'QWERTY' resolves the table onto built-in 'qwerty'",
  );
  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    true,
    "the table merges, so built-in 'a' survives",
  );
});

QUnit.test("A base letter mapped to an empty list loses its popup", async (assert) => {
  const { kb } = await mount({
    accentVariants: true,
    layout: "qwerty",
    customLayouts: [new CustomLayout({ name: "qwerty", variants: { a: [] } })],
  });

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
});

QUnit.test("A layout name that stopped resolving reads the table of the rendered surface", async (assert) => {
  const rows = new CustomLayout({ name: "pinpad", rows: makeLayout("p") });
  const { kb } = await mount({
    accentVariants: true,
    layout: "pinpad",
    customLayouts: [
      rows,
      new CustomLayout({ name: "pinpad", variants: { a: [] } }),
      new CustomLayout({ name: "qwerty", variants: { b: ["ḃ"] } }),
    ],
  });
  assert.strictEqual(kb.getLayout(), "pinpad", "precondition: the custom layout is the active one");

  kb.removeCustomLayout(rows);
  await placeAndWait(kb);
  assert.strictEqual(kb.getLayout(), "pinpad", "precondition: the property keeps the now-unresolved name");

  assert.strictEqual(
    getRequiredKeyElement(kb, "b").hasAttribute(DOM.attributes.hasVariants),
    true,
    "the rendered layout's own table applies",
  );
  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    true,
    "the unresolved name's table does not",
  );

  rows.destroy();
});

QUnit.test("A variant table without accentVariants warns once and applies nothing", async (assert) => {
  const warn = sandbox.stub(Log, "warning");
  const { kb } = await mount({
    layout: "qwerty",
    customLayouts: [new CustomLayout({ name: "qwerty", variants: { b: ["ḃ"] } })],
  });

  assert.strictEqual(
    getRequiredKeyElement(kb, "b").hasAttribute(DOM.attributes.hasVariants),
    false,
    "the disarmed gate applies no table",
  );
  const countDisarmedWarnings = (): number =>
    warn.getCalls().filter((call) => String(call.args[0]).includes("accentVariants is false")).length;
  assert.strictEqual(countDisarmedWarnings(), 1, "the diagnostic is emitted exactly once");

  kb.invalidate();
  await placeAndWait(kb);
  assert.strictEqual(countDisarmedWarnings(), 1, "and is not repeated on re-render");
});

QUnit.test("suppress=Variants opts a custom layout out of the built-in table", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const rows = [[{ value: "a" }, { value: "b" }, { value: "e" }]] as LayoutDefinition;

  const armed = new KioskKeyboard({
    controls: [input.getId()],
    accentVariants: true,
    customLayouts: [new CustomLayout({ name: "mylayout", rows })],
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
    customLayouts: [new CustomLayout({ name: "mylayout", rows, suppress: [LayoutFacet.Variants] })],
    layout: "mylayout",
  });
  await placeAndWait(optedOut);
  assert.strictEqual(
    getRequiredKeyElement(optedOut, "a").hasAttribute(DOM.attributes.hasVariants),
    false,
    "suppressing the facet takes it back off",
  );

  input.destroy();
  optedOut.destroy();
});

QUnit.test(
  "suppress=Variants discards defaultVariants too, and a table declared with it stands alone",
  async (assert) => {
    const input = new Input({ value: "" });
    input.placeAt("qunit-fixture");
    const rows = [[{ value: "a" }, { value: "b" }]] as LayoutDefinition;

    const suppressed = new KioskKeyboard({
      controls: [input.getId()],
      accentVariants: true,
      defaultVariants: { a: ["ä"], b: ["ḃ"] },
      customLayouts: [new CustomLayout({ name: "mylayout", rows, suppress: [LayoutFacet.Variants] })],
      layout: "mylayout",
    });
    await placeAndWait(suppressed);
    assert.strictEqual(
      getRequiredKeyElement(suppressed, "a").hasAttribute(DOM.attributes.hasVariants),
      false,
      "the defaults tier is discarded along with the built-in one",
    );
    suppressed.destroy();

    const redeclared = new KioskKeyboard({
      controls: [input.getId()],
      accentVariants: true,
      defaultVariants: { a: ["ä"], b: ["ḃ"] },
      customLayouts: [
        new CustomLayout({ name: "mylayout", rows, suppress: [LayoutFacet.Variants], variants: { b: ["ƀ"] } }),
      ],
      layout: "mylayout",
    });
    await placeAndWait(redeclared);
    assert.strictEqual(
      getRequiredKeyElement(redeclared, "a").hasAttribute(DOM.attributes.hasVariants),
      false,
      "the letter only the discarded tiers named is gone",
    );
    assert.strictEqual(
      getRequiredKeyElement(redeclared, "b").hasAttribute(DOM.attributes.hasVariants),
      true,
      "and the table declared alongside the suppression stands alone",
    );

    input.destroy();
    redeclared.destroy();
  },
);

QUnit.test("defaultVariants composes with a custom layout's own table", async (assert) => {
  const rows = [[{ value: "a" }, { value: "b" }, { value: "q" }]] as LayoutDefinition;
  const { kb } = await mount({
    accentVariants: true,
    defaultVariants: { q: ["ǫ"] },
    customLayouts: [new CustomLayout({ name: "mylayout", rows, variants: { b: ["ḃ"] } })],
    layout: "mylayout",
  });

  assert.strictEqual(
    getRequiredKeyElement(kb, "q").hasAttribute(DOM.attributes.hasVariants),
    true,
    "the defaults tier survives a named table, rather than being discarded by it",
  );
  assert.strictEqual(
    getRequiredKeyElement(kb, "b").hasAttribute(DOM.attributes.hasVariants),
    true,
    "and the named table applies",
  );
  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    true,
    "with the built-in tier beneath both",
  );
});

QUnit.test("An invalid defaultVariants table is reported against the host, not a layout", async (assert) => {
  const warn = sandbox.stub(Log, "warning");
  const { kb } = await mount({
    accentVariants: true,
    layout: "qwerty",
    defaultVariants: { A: ["ä"] },
  });

  assert.ok(
    warn.getCalls().some((call) => String(call.args[0]).startsWith('"defaultVariants"')),
    "the message names the host property rather than quoting an empty layout name",
  );
  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    true,
    "the invalid table is dropped and the built-in tier stands",
  );
});

QUnit.test("Editing a custom layout's variants re-resolves on the next render", async (assert) => {
  const entry = new CustomLayout({ name: "qwerty" });
  const { kb } = await mount({
    accentVariants: true,
    layout: "qwerty",
    customLayouts: [entry],
  });
  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    true,
    "built-in 'a' armed before the suppression",
  );

  entry.setSuppress([LayoutFacet.Variants]);
  await placeAndWait(kb);
  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    false,
    "opted out after the property write",
  );

  kb.destroyCustomLayouts();
  await placeAndWait(kb);
  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    true,
    "built-in restored after destroying the aggregation",
  );
});

// ───────────────────────────────────────────────────
// Construction order, cloning and the single diagnostic pass
// ───────────────────────────────────────────────────

QUnit.module("custom-layouts - construction", { afterEach: commonAfterEach });

QUnit.test("A layout named in the same settings object as the custom layout declaring it resolves", async (assert) => {
  const warn = sandbox.stub(Log, "warning");

  // `layout` is applied after the custom layouts because they go through their own
  // `applySettings` pass first; without that, `setLayout` would run against an empty
  // fold, warn, and bail.
  const kb = new KioskKeyboard({
    layout: "pl-warehouse",
    customLayouts: [new CustomLayout({ name: "pl-warehouse", rows: makeLayout("p") })],
  });
  await placeAndWait(kb);

  assert.strictEqual(kb.getLayout(), "pl-warehouse", "the layout is accepted whatever the settings order");
  assert.notOk(warn.called, "and nothing is reported");
});

QUnit.test("A clone resolves its layout even though properties are emitted before aggregations", async (assert) => {
  const warn = sandbox.stub(Log, "warning");

  const kb = new KioskKeyboard({
    layout: "pl-warehouse",
    customLayouts: [new CustomLayout({ name: "pl-warehouse", rows: makeLayout("p") })],
  });
  await placeAndWait(kb);

  // `ManagedObject.clone` iterates properties first and aggregations second, so this
  // is the one path that exercises the two-phase hoist with no consumer writing the
  // settings in that order.
  const clone = kb.clone();
  await placeAndWait(clone);

  assert.strictEqual(clone.getLayout(), "pl-warehouse", "the clone resolves the layout its custom layout declares");
  assert.deepEqual(getRenderedLayoutKeys(clone), [["p"]], "and renders it");
  assert.notOk(warn.called, "with nothing reported");

  clone.destroy();
});

QUnit.test("Construction folds once, over the complete list", async (assert) => {
  const warn = sandbox.stub(Log, "warning");

  // The overlay precedes the custom layout declaring its rows. A fold over any prefix
  // of the list would report a spurious `unknown-target`, and a dedupe set cannot
  // retract a warning - only folding once, after every child is added, is correct.
  const kb = new KioskKeyboard({
    layout: "qwerty",
    customLayouts: [
      new CustomLayout({ name: "warehouse", locales: ["zz"] }),
      new CustomLayout({ name: "warehouse", rows: makeLayout("w") }),
      new CustomLayout({ name: "typo-only", locales: ["yy"] }),
    ],
  });
  await placeAndWait(kb);

  const messages = warn.getCalls().map((call) => String(call.args[0]));
  assert.strictEqual(messages.length, 1, "exactly one diagnostic for the one real fault");
  assert.ok(messages[0]!.includes("typo-only"), "and it names the custom layout that resolves nothing");
  // The remedy quotes the real registry rather than a literal, so a vocabulary wired to
  // nothing would render "the built-ins are: ." and help no one.
  assert.ok(messages[0]!.includes("qwertz-de"), "and the remedy lists the built-ins it could have meant");
});

QUnit.test("A repeated fault is reported once per configuration, and again after it clears", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty" });
  await placeAndWait(kb);

  const warn = sandbox.stub(Log, "warning");
  const broken = new CustomLayout({ name: "typo-only", locales: ["yy"] });
  kb.addCustomLayout(broken);
  await placeAndWait(kb);
  kb.invalidate();
  await placeAndWait(kb);

  assert.strictEqual(warn.callCount, 1, "re-reads of the same configuration do not repeat the diagnostic");

  kb.removeCustomLayout(broken);
  await placeAndWait(kb);
  kb.addCustomLayout(broken);
  await placeAndWait(kb);

  assert.strictEqual(warn.callCount, 2, "a fault re-introduced after a clean fold is reported again");

  broken.destroy();
});

QUnit.test("A custom layout with no name resolves nothing and says so", async (assert) => {
  const warn = sandbox.stub(Log, "warning");

  const kb = new KioskKeyboard({
    layout: "qwerty",
    customLayouts: [new CustomLayout({ rows: makeLayout("z") })],
  });
  await placeAndWait(kb);

  assert.strictEqual(warn.callCount, 1, "reported exactly once");
  assert.ok(String(warn.firstCall.args[0]).includes("declares no name"), "naming the fault");
});
