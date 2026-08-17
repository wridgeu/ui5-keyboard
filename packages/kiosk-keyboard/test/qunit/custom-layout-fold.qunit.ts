import type { CustomLayoutSpec, LayoutDefinition } from "ui5/kiosk/types";
import {
  EMPTY_FOLD,
  SUPPRESSIBLE_FACETS,
  describeDiagnostic,
  foldCustomLayouts,
  isValidLayoutDefinition,
  isValidVariantTable,
  type CustomLayoutFold,
  type DiagnosticCode,
  type DiagnosticVocabulary,
} from "ui5/kiosk/internal/custom-layout-fold";

// Unit coverage for the fold that turns an ordered list of custom layouts into
// the per-facet lookup maps the resolution paths read: the merge rule each facet
// keeps, the suppression that discards an inherited value at one custom layout's
// position, and every diagnostic the fold can raise.

const ROWS: LayoutDefinition = [[{ value: "a" }]];
const OTHER_ROWS: LayoutDefinition = [[{ value: "b" }]];
const mw = (): never => {
  throw new Error("the fold must never call a middleware factory");
};
const otherMw = (): never => {
  throw new Error("the fold must never call a middleware factory");
};

/** Only these two names resolve without rows, so everything else is an `unknown-target`. */
const isBuiltIn = (name: string): boolean => name === "qwerty" || name === "ja-kana";

/**
 * A spec as the aggregation delivers it. `middleware` reaches the fold from an XML
 * attribute or from plain JS, where nothing has checked it is callable, which is what
 * the `invalid-middleware` diagnostic exists for.
 */
type DeclaredSpec = Omit<CustomLayoutSpec, "middleware"> & {
  readonly middleware?: CustomLayoutSpec["middleware"] | string | number;
};

const fold = (...specs: DeclaredSpec[]): CustomLayoutFold => foldCustomLayouts(specs as CustomLayoutSpec[], isBuiltIn);
const codes = (f: CustomLayoutFold): DiagnosticCode[] => f.diagnostics.map((d) => d.code);

const VOCAB: DiagnosticVocabulary = {
  customLayouts: "customLayouts aggregation",
  customLayout: "<kiosk:CustomLayout>",
  builtInLayouts: ["qwerty", "ja-kana"],
};

QUnit.module("custom-layout-fold - shape");

QUnit.test("no custom layouts folds to the shared empty result", (assert) => {
  assert.strictEqual(foldCustomLayouts([], isBuiltIn), EMPTY_FOLD, "the same frozen object, so nothing is allocated");
  assert.deepEqual(EMPTY_FOLD.diagnostics, [], "and it carries no diagnostics");
});

QUnit.test("a facet nothing declared is absent rather than an empty map", (assert) => {
  const f = fold({ name: "qwerty", rows: ROWS });
  assert.ok(f.layouts instanceof Map, "the declared facet is a Map");
  assert.strictEqual(f.layoutMeta, undefined, "layoutMeta");
  assert.strictEqual(f.localeLayouts, undefined, "localeLayouts");
  assert.strictEqual(f.middleware, undefined, "middleware");
  assert.strictEqual(f.variants, undefined, "variants");
});

QUnit.test("names are matched after trim and lowercase", (assert) => {
  const f = fold({ name: "  QWERTY ", rows: ROWS, locales: [" PL "] });
  assert.deepEqual([...f.layouts!.keys()], ["qwerty"], "the layout key is normalized");
  assert.deepEqual([...f.localeLayouts!], [["pl", "qwerty"]], "so are the locale tag and its target");
});

QUnit.module("custom-layout-fold - per-facet merge rules");

QUnit.test("rows: the last declaration wins and the earlier one is reported", (assert) => {
  const f = fold({ name: "x", rows: ROWS }, { name: "x", rows: OTHER_ROWS });
  assert.strictEqual(f.layouts!.get("x"), OTHER_ROWS, "the later rows stand");
  assert.deepEqual(codes(f), ["duplicate-rows"], "and the collision is reported once");
});

QUnit.test("rows: a custom layout that declares none leaves the previous standing", (assert) => {
  const f = fold({ name: "x", rows: ROWS }, { name: "x", keycapLang: "pl" });
  assert.strictEqual(f.layouts!.get("x"), ROWS, "the rows survive the overlay");
  assert.strictEqual(f.layoutMeta!.get("x")!.lang, "pl", "which contributed its own facet");
  assert.deepEqual(codes(f), [], "an overlay on a declared layout resolves");
});

QUnit.test("metadata: attributes merge per attribute across custom layouts", (assert) => {
  const f = fold(
    { name: "x", rows: ROWS, keycapLang: "pl", secondary: true },
    { name: "x", secondary: false },
    { name: "x", keycapLang: "cs" },
  );
  assert.deepEqual(f.layoutMeta!.get("x"), { lang: "cs", secondary: false }, "each attribute takes its last value");
});

QUnit.test("metadata: an absent attribute contributes nothing, so the tier below shows through", (assert) => {
  const f = fold({ name: "qwerty", locales: ["pl"] });
  assert.strictEqual(f.layoutMeta, undefined, "declaring neither attribute writes no entry at all");
});

QUnit.test("metadata: secondary false is a declaration, not an absence", (assert) => {
  const f = fold({ name: "ja-kana", secondary: false });
  assert.deepEqual(f.layoutMeta!.get("ja-kana"), { secondary: false }, "the false is carried into the map");
});

QUnit.test("locales: prefixes union, and the last claim on one prefix wins", (assert) => {
  const f = fold(
    { name: "qwerty", locales: ["pl", "pl-pl"] },
    { name: "ja-kana", rows: ROWS, locales: ["ja"] },
    { name: "ja-kana", locales: ["pl"] },
  );
  assert.strictEqual(f.localeLayouts!.get("pl"), "ja-kana", "the later claim wins");
  assert.strictEqual(f.localeLayouts!.get("pl-pl"), "qwerty", "an unrelated prefix is untouched");
  assert.strictEqual(f.localeLayouts!.get("ja"), "ja-kana", "and so is the union of the rest");
  assert.deepEqual(codes(f), ["duplicate-locale"], "only the contested prefix is reported");
});

QUnit.test("locales: a prefix re-claimed by the same layout is not a collision", (assert) => {
  const f = fold({ name: "qwerty", locales: ["pl"] }, { name: "qwerty", locales: ["pl"] });
  assert.deepEqual(codes(f), [], "restating one layout's own prefix says nothing new");
});

QUnit.test("middleware: the last declaration wins and the earlier one is reported", (assert) => {
  const f = fold({ name: "qwerty", middleware: mw }, { name: "qwerty", middleware: otherMw });
  assert.strictEqual(f.middleware!.get("qwerty"), otherMw, "the later factory stands");
  assert.deepEqual(codes(f), ["duplicate-middleware"], "and the collision is reported once");
});

QUnit.test("variants: tables accumulate per base letter across custom layouts", (assert) => {
  const f = fold({ name: "qwerty", variants: { a: ["ą"] } }, { name: "qwerty", variants: { z: ["ź"] } });
  assert.deepEqual(f.variants!.get("qwerty"), { replace: false, table: { a: ["ą"], z: ["ź"] } }, "both letters stand");
});

QUnit.test("variants: a letter mapped to an empty list keeps its marker in the overlay", (assert) => {
  // The overlay is still a patch: the deletion happens when it meets a real table, so
  // dropping the marker here would lose a suppression aimed at the built-in tier.
  const f = fold({ name: "qwerty", variants: { a: ["ą"], z: ["ź"] } }, { name: "qwerty", variants: { a: [] } });
  assert.deepEqual(f.variants!.get("qwerty")!.table, { a: [], z: ["ź"] }, "the marker survives accumulation");
});

QUnit.module("custom-layout-fold - suppress");

QUnit.test("Variants alone opts the layout out of every tier below it", (assert) => {
  const f = fold({ name: "qwerty", suppress: ["Variants"] });
  assert.deepEqual(f.variants!.get("qwerty"), { replace: true, table: null }, "nothing survives to be merged");
});

QUnit.test("Variants discards what an earlier custom layout contributed", (assert) => {
  const f = fold({ name: "qwerty", variants: { a: ["ą"] } }, { name: "qwerty", suppress: ["Variants"] });
  assert.deepEqual(f.variants!.get("qwerty"), { replace: true, table: null }, "the earlier table is gone too");
});

QUnit.test("a table on the same custom layout that suppresses stands alone", (assert) => {
  const f = fold({ name: "qwerty", suppress: ["Variants"], variants: { a: ["ą"] } });
  assert.deepEqual(f.variants!.get("qwerty"), { replace: true, table: { a: ["ą"] } }, "declared after suppressing");
});

QUnit.test("Middleware alone disables the built-in factory for the layout", (assert) => {
  const f = fold({ name: "ja-kana", suppress: ["Middleware"] });
  assert.strictEqual(f.middleware!.get("ja-kana"), null, "a stored null, distinct from an absent entry");
  assert.ok(f.middleware!.has("ja-kana"), "which is why the read side must use has(), not ??");
});

QUnit.test("a factory on the same custom layout that suppresses still applies", (assert) => {
  const f = fold({ name: "ja-kana", suppress: ["Middleware"], middleware: mw });
  assert.strictEqual(f.middleware!.get("ja-kana"), mw, "suppression drops the inherited value, not the declared one");
});

QUnit.test("both facets are suppressible at once", (assert) => {
  const f = fold({ name: "qwerty", suppress: [...SUPPRESSIBLE_FACETS] });
  assert.strictEqual(f.middleware!.get("qwerty"), null, "Middleware");
  assert.deepEqual(f.variants!.get("qwerty"), { replace: true, table: null }, "Variants");
  assert.deepEqual(codes(f), [], "neither is an unknown facet");
});

QUnit.module("custom-layout-fold - diagnostics");

QUnit.test("empty-name: a custom layout with no name resolves nothing", (assert) => {
  const f = fold({ name: "   ", rows: ROWS });
  assert.deepEqual(codes(f), ["empty-name"], "reported once");
  assert.strictEqual(f.layouts, undefined, "and nothing it declared is folded in");
});

QUnit.test("invalid-rows: a rejected rows drops only that facet, and reports alone", (assert) => {
  const f = fold({ name: "notalayout", rows: [], keycapLang: "pl" });
  assert.deepEqual(codes(f), ["invalid-rows"], "never also unknown-target: one mistake, one warning");
  assert.strictEqual(f.layouts, undefined, "the rows are not folded in");
  assert.strictEqual(f.layoutMeta!.get("notalayout")!.lang, "pl", "the custom layout's other facets still apply");
});

QUnit.test("invalid-variants: a table that is not a variant table is dropped", (assert) => {
  const f = fold({ name: "qwerty", variants: { A: ["ą"] } });
  assert.deepEqual(codes(f), ["invalid-variants"], "an uppercased base letter would arm nothing");
  assert.strictEqual(f.variants, undefined, "so it is not folded in");
});

QUnit.test("invalid-middleware: a non-function factory is dropped", (assert) => {
  const f = fold({ name: "qwerty", middleware: "nope" });
  assert.deepEqual(codes(f), ["invalid-middleware"], "reported once");
  assert.strictEqual(f.middleware, undefined, "and never stored");
});

QUnit.test("invalid-locale: an empty prefix is dropped without touching its siblings", (assert) => {
  const f = fold({ name: "qwerty", locales: ["pl", "  "] });
  assert.deepEqual(codes(f), ["invalid-locale"], "reported once");
  assert.deepEqual([...f.localeLayouts!.keys()], ["pl"], "the valid prefix survives");
});

QUnit.test("unknown-suppress: a token outside the facet set is dropped", (assert) => {
  const f = fold({ name: "qwerty", suppress: ["Varients"] });
  assert.deepEqual(codes(f), ["unknown-suppress"], "reported once");
  assert.strictEqual(f.variants, undefined, "and suppresses nothing");
});

QUnit.test("unknown-target: an overlay on a layout that does not exist", (assert) => {
  const f = fold({ name: "typo", locales: ["pl"] });
  assert.deepEqual(codes(f), ["unknown-target"], "the flagship diagnostic");
});

QUnit.test("unknown-target: rows still waiting on a binding are declared, not unresolvable", (assert) => {
  // A control is constructed before it joins a view, so a model-bound `rows` is null on
  // the first fold. Reporting that as unresolvable would make the documented XML form
  // warn on every construction.
  const f = fold({ name: "bound-layout", rowsPending: true, keycapLang: "pl" });
  assert.deepEqual(codes(f), [], "the pending declaration silences unknown-target");
  assert.strictEqual(f.layouts, undefined, "and registers no layout until the value lands");
  assert.strictEqual(f.layoutMeta!.get("bound-layout")!.lang, "pl", "its other facets still apply");
});

QUnit.test("unknown-target: resolvability is read from the complete list, not the prefix", (assert) => {
  const f = fold({ name: "x", locales: ["pl"] }, { name: "x", rows: ROWS });
  assert.deepEqual(codes(f), [], "an overlay may precede the custom layout that declares its rows");
});

QUnit.test("unknown-target: a built-in name needs no rows", (assert) => {
  assert.deepEqual(codes(fold({ name: "ja-kana", suppress: ["Middleware"] })), [], "the built-in resolves it");
});

QUnit.module("custom-layout-fold - describeDiagnostic");

QUnit.test("every code renders a sentence naming the twin's own surface", (assert) => {
  const f = fold(
    { name: "" },
    { name: "typo", locales: ["pl", " "], suppress: ["Varients"], middleware: 1 },
    { name: "x", rows: [] },
    { name: "x", rows: ROWS, variants: { A: [] } },
    { name: "x", rows: ROWS, middleware: mw },
    { name: "x", middleware: otherMw, locales: ["pl"] },
  );
  const seen = new Set(codes(f));
  const expected: DiagnosticCode[] = [
    "empty-name",
    "invalid-rows",
    "invalid-variants",
    "invalid-middleware",
    "invalid-locale",
    "unknown-target",
    "unknown-suppress",
    "duplicate-rows",
    "duplicate-middleware",
    "duplicate-locale",
  ];
  for (const code of expected) assert.ok(seen.has(code), `${code} is triggered by the fixture`);
  assert.strictEqual(seen.size, expected.length, "and the fixture triggers nothing else");
  for (const d of f.diagnostics) {
    const message = describeDiagnostic(d, VOCAB);
    assert.ok(message.length > 0 && message.endsWith("."), `${d.code} renders a complete sentence`);
    assert.notOk(message.includes("undefined"), `${d.code} interpolates no missing field`);
  }
});

QUnit.test("the vocabulary is what the twins spell differently", (assert) => {
  const d = { code: "unknown-target", layout: "typo" } as const;
  const message = describeDiagnostic(d, VOCAB);
  assert.ok(message.includes("<kiosk:CustomLayout>"), "the element is named the way this twin spells it");
  assert.ok(message.includes("qwerty, ja-kana"), "and the built-in list closes the hint");
});

QUnit.test("the host's own table is named rather than attributed to a layout", (assert) => {
  const message = describeDiagnostic({ code: "invalid-variants", layout: "" }, VOCAB);
  assert.ok(message.startsWith('"defaultVariants"'), "an empty layout names the host property");
  assert.notOk(message.includes('for ""'), "rather than quoting an empty layout name");
});

QUnit.module("custom-layout-fold - validators");

QUnit.test("isValidLayoutDefinition rejects the shapes that are not rows", (assert) => {
  assert.ok(isValidLayoutDefinition(ROWS), "a non-empty array of non-empty rows");
  assert.notOk(isValidLayoutDefinition([]), "empty");
  assert.notOk(isValidLayoutDefinition([[]]), "an empty row");
  assert.notOk(isValidLayoutDefinition([[null]]), "a null key");
  assert.notOk(isValidLayoutDefinition([[{ value: "" }]]), "an empty key value");
  assert.notOk(isValidLayoutDefinition("rows"), "a string");
});

QUnit.test("isValidVariantTable rejects the shapes that are not tables", (assert) => {
  assert.ok(isValidVariantTable({ a: ["ą"] }), "lowercase base letters to non-empty glyphs");
  assert.ok(isValidVariantTable({ a: [] }), "an empty list, which suppresses that letter");
  assert.notOk(isValidVariantTable({}), "empty");
  assert.notOk(isValidVariantTable([]), "an array");
  assert.notOk(isValidVariantTable(new Map()), "an exotic object");
  assert.notOk(isValidVariantTable({ A: ["ą"] }), "an uppercased base letter");
  assert.notOk(isValidVariantTable({ a: [""] }), "an empty glyph");
});
