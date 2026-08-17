import type { LayoutDefinition } from "ui5/kiosk/types";
import {
  LATIN_DIACRITIC_VARIANTS,
  applyVariantDefaults,
  resolveVariantTable,
  shiftedGlyph,
  toShiftVariant,
  toShiftVariants,
  type InstanceVariants,
  type VariantTable,
} from "ui5/kiosk/internal/latin-variants";

// Unit coverage for the framework-agnostic long-press variant helpers: the
// default Latin-diacritic table, the layout merge that fills default variants
// without clobbering author intent, and the Shift/Caps uppercasing that must
// surface the capital sharp S (ẞ) for ß.

QUnit.module("latin-variants - library re-export");

QUnit.test("the library publishes the table without publishing its type name", async (assert) => {
  // `export { LATIN_DIACRITIC_VARIANTS, type VariantTable }` transpiles to a
  // runtime assignment for both names, publishing `ui5.kiosk.VariantTable` as
  // `undefined`. The type has to leave through a separate `export type`, which
  // only this assertion distinguishes from the collapsed form.
  const library = await import("ui5/kiosk/library");
  assert.strictEqual(
    library.LATIN_DIACRITIC_VARIANTS,
    LATIN_DIACRITIC_VARIANTS,
    "the built-in table is re-exported from the library module",
  );
  assert.notOk("VariantTable" in library, "the type name is not published as a runtime member");
});

QUnit.module("latin-variants - table");

QUnit.test("covers the German umlaut bases and never repeats the base letter", (assert) => {
  assert.ok(LATIN_DIACRITIC_VARIANTS.a?.includes("ä"), "a -> ä");
  assert.ok(LATIN_DIACRITIC_VARIANTS.o?.includes("ö"), "o -> ö");
  assert.ok(LATIN_DIACRITIC_VARIANTS.u?.includes("ü"), "u -> ü");
  assert.ok(LATIN_DIACRITIC_VARIANTS.s?.includes("ß"), "s -> ß");
  for (const [base, variants] of Object.entries(LATIN_DIACRITIC_VARIANTS)) {
    assert.notOk(variants.includes(base), `${base} list omits its own base letter`);
    assert.deepEqual(variants, [...new Set(variants)], `${base} list has no duplicates`);
  }
});

QUnit.module("latin-variants - applyVariantDefaults");

QUnit.test("fills default variants on matching character keys only", (assert) => {
  const layout: LayoutDefinition = [
    [{ value: "a" }, { value: "b" }, { value: "1", shiftValue: "!" }],
    [
      { value: " ", type: "space" },
      { value: "{backspace}", type: "action" },
    ],
  ];
  const out = applyVariantDefaults(layout);
  assert.deepEqual(out[0][0].variants, [...LATIN_DIACRITIC_VARIANTS.a], "a gets the default table entry");
  assert.strictEqual(out[0][1].variants, undefined, "b has no table entry, stays untouched");
  assert.strictEqual(out[0][2].variants, undefined, "digit key untouched");
  assert.strictEqual(out[1][0].variants, undefined, "space untouched");
  assert.strictEqual(out[1][1].variants, undefined, "action token untouched");
});

QUnit.test("matches case-insensitively on the key value", (assert) => {
  const out = applyVariantDefaults([[{ value: "A" }]]);
  assert.deepEqual(out[0][0].variants, [...LATIN_DIACRITIC_VARIANTS.a], "uppercase 'A' resolves the 'a' entry");
});

QUnit.test("never overrides author-declared variants (including an empty list)", (assert) => {
  const out = applyVariantDefaults([
    [
      { value: "a", variants: ["ä"] },
      { value: "o", variants: [] },
    ],
  ]);
  assert.deepEqual(out[0][0].variants, ["ä"], "explicit variants win over the default table");
  assert.deepEqual(out[0][1].variants, [], "explicit empty list is preserved (opt-out)");
});

QUnit.test("does not mutate the input layout", (assert) => {
  const layout: LayoutDefinition = [[{ value: "a" }]];
  applyVariantDefaults(layout);
  assert.strictEqual(layout[0][0].variants, undefined, "original key object is unchanged");
});

QUnit.test("accepts a custom table", (assert) => {
  const out = applyVariantDefaults([[{ value: "x" }]], { x: ["χ"] });
  assert.deepEqual(out[0][0].variants, ["χ"], "custom table entry applied");
});

QUnit.test("leaves keys named after Object.prototype members untouched", (assert) => {
  const out = applyVariantDefaults([[{ value: "constructor" }, { value: "toString" }, { value: "valueOf" }]]);
  assert.strictEqual(out[0][0].variants, undefined, "'constructor' does not resolve Object.prototype.constructor");
  assert.strictEqual(out[0][1].variants, undefined, "'toString' untouched");
  assert.strictEqual(out[0][2].variants, undefined, "'valueOf' untouched");
});

QUnit.test("skips table application on action, modifier, and space keys", (assert) => {
  const out = applyVariantDefaults([
    [{ value: "a" }, { value: "a", type: "modifier" }, { value: "a", type: "space" }, { value: "a", type: "action" }],
  ]);
  assert.deepEqual(out[0][0].variants, [...LATIN_DIACRITIC_VARIANTS.a], "a plain character key is filled");
  assert.strictEqual(out[0][1].variants, undefined, "modifier keyed to a table base is not filled");
  assert.strictEqual(out[0][2].variants, undefined, "space keyed to a table base is not filled");
  assert.strictEqual(out[0][3].variants, undefined, "action keyed to a table base is not filled");
});

QUnit.test("keeps authored variants on action/modifier/space keys (filter gates only the table fill)", (assert) => {
  const out = applyVariantDefaults([
    [
      { value: "{backspace}", type: "action", variants: ["x", "y"] },
      { value: "{shift}", type: "modifier", variants: ["z"] },
    ],
  ]);
  assert.deepEqual(out[0][0].variants, ["x", "y"], "authored action-key variants preserved");
  assert.deepEqual(out[0][1].variants, ["z"], "authored modifier-key variants preserved");
});

/** A house accent set, the shape a `defaultVariants` table has. */
const DEFAULTS: VariantTable = { z: ["ź"], q: ["ǫ"] };
/** One layout's own table, the shape a custom layout's `variants` has. */
const NAMED: VariantTable = { a: ["ą"] };

QUnit.module("latin-variants - resolveVariantTable");

QUnit.test("falls back to the built-in Latin table for a layout with no instance entry", (assert) => {
  assert.strictEqual(resolveVariantTable("qwerty"), LATIN_DIACRITIC_VARIANTS, "built-in Latin table");
});

QUnit.test("returns null for the built-in non-Latin layouts", (assert) => {
  for (const name of ["ja-romaji", "ja-kana", "ja-kana-compact", "arabic", "ko-hangul"]) {
    assert.strictEqual(resolveVariantTable(name), null, `${name} has no built-in variants`);
  }
});

QUnit.test("normalizes the layout name (case and surrounding space)", (assert) => {
  assert.strictEqual(resolveVariantTable("  JA-Kana "), null, "trimmed + lowercased to the excluded name");
  assert.strictEqual(resolveVariantTable("QWERTY"), LATIN_DIACRITIC_VARIANTS, "uppercase resolves the Latin table");
});

/** The named tier for one layout, in the overlay shape the custom-layout fold produces. */
const named = (layout: string, table: VariantTable | null, replace = false): InstanceVariants =>
  new Map([[layout, { replace, table }]]);

QUnit.test("a named entry extends the built-in table rather than replacing it", (assert) => {
  const table = resolveVariantTable("qwerty", named("qwerty", { b: ["ḃ"] }))!;
  assert.deepEqual(table.b, ["ḃ"], "the entry's own letter is added");
  assert.deepEqual(table.a, [...LATIN_DIACRITIC_VARIANTS.a], "an untouched built-in letter survives");
});

QUnit.test("an entry replaces the built-in list for the letters it names", (assert) => {
  const table = resolveVariantTable("qwerty", named("qwerty", { s: ["ś"] }))!;
  assert.deepEqual(table.s, ["ś"], "the named letter takes the entry's list");
});

QUnit.test("a letter mapped to an empty list is suppressed without touching its siblings", (assert) => {
  const table = resolveVariantTable("qwerty", named("qwerty", { s: [] }))!;
  assert.notOk(Object.hasOwn(table, "s"), "the suppressed letter is gone");
  assert.deepEqual(table.a, [...LATIN_DIACRITIC_VARIANTS.a], "its siblings are untouched");
});

QUnit.test("does not mutate the built-in table", (assert) => {
  resolveVariantTable("qwerty", named("qwerty", { a: ["ā"], s: [] }));
  assert.ok(LATIN_DIACRITIC_VARIANTS.a.includes("ä"), "an overridden built-in letter is intact");
  assert.ok(LATIN_DIACRITIC_VARIANTS.s.includes("ß"), "a suppressed built-in letter is intact");
});

QUnit.test("a table keyed __proto__ contributes an own entry, not a prototype", (assert) => {
  const polluted = JSON.parse('{"__proto__":["x"]}') as VariantTable;
  const table = resolveVariantTable("qwerty", named("qwerty", polluted))!;
  assert.strictEqual(Object.getPrototypeOf(table), null, "the merged table has a null prototype");
  assert.ok(Object.hasOwn(table, "__proto__"), "the key lands as an own property");
  assert.notOk(Object.hasOwn(Object.prototype, "x"), "Object.prototype is unpolluted");
});

QUnit.test("a suppressing named entry with no table of its own opts the layout out", (assert) => {
  assert.strictEqual(resolveVariantTable("qwerty", named("qwerty", null, true)), null, "the built-in table is gone");
});

QUnit.test("returns the built-in table itself when no tier applies", (assert) => {
  assert.strictEqual(
    resolveVariantTable("qwerty", named("azerty-fr", { b: ["ḃ"] })),
    LATIN_DIACRITIC_VARIANTS,
    "no copy is made",
  );
  assert.strictEqual(resolveVariantTable("qwerty", undefined, null), LATIN_DIACRITIC_VARIANTS, "nor for a null tier");
});

QUnit.module("latin-variants - the defaults tier");

QUnit.test("applies to every layout, even non-Latin ones", (assert) => {
  const table = resolveVariantTable("qwerty", undefined, DEFAULTS)!;
  assert.deepEqual(table.q, ["ǫ"], "the defaults letter is added to a Latin layout");
  assert.deepEqual(table.a, [...LATIN_DIACRITIC_VARIANTS.a], "the built-in tier below it survives");
  // The non-Latin built-in tier is null, so the defaults tier stands alone there.
  assert.deepEqual(resolveVariantTable("arabic", undefined, DEFAULTS), DEFAULTS, "it re-enables a non-Latin layout");
  assert.strictEqual(
    resolveVariantTable("arabic", undefined, DEFAULTS)!.a,
    undefined,
    "without inheriting the Latin table",
  );
});

QUnit.test("composes with a named entry rather than being discarded by it", (assert) => {
  const table = resolveVariantTable("qwerty", named("qwerty", NAMED), DEFAULTS)!;
  assert.deepEqual(table.a, ["ą"], "the named tier wins for the letter it declares");
  assert.deepEqual(table.q, ["ǫ"], "a defaults letter the named tier leaves alone survives");
  assert.deepEqual(table.z, ["ź"], "and so does the one it overlaps with the built-in");
});

QUnit.test("composes with a named entry on a non-Latin layout", (assert) => {
  const table = resolveVariantTable("arabic", named("arabic", NAMED), DEFAULTS)!;
  assert.deepEqual(table, { z: ["ź"], q: ["ǫ"], a: ["ą"] }, "both tiers stand, with no Latin table beneath them");
});

QUnit.test("a letter it drops stays dropped when a named entry declares others", (assert) => {
  const table = resolveVariantTable("qwerty", named("qwerty", NAMED), { s: [] })!;
  assert.notOk(Object.hasOwn(table, "s"), "the letter the defaults tier drops is gone");
  assert.deepEqual(table.a, ["ą"], "and the named tier still applies");
});

QUnit.test("a named entry that suppresses discards it", (assert) => {
  assert.strictEqual(resolveVariantTable("qwerty", named("qwerty", null, true), DEFAULTS), null, "nothing survives");
});

QUnit.test("a named entry that suppresses and then declares a table stands that table alone", (assert) => {
  const table = resolveVariantTable("qwerty", named("qwerty", NAMED, true), DEFAULTS)!;
  assert.deepEqual(table, { a: ["ą"] }, "neither the built-in nor the defaults tier contributes");
});

QUnit.module("latin-variants - shift mapping");

QUnit.test("uppercases variants, mapping ß to the capital sharp S ẞ", (assert) => {
  assert.strictEqual(toShiftVariant("ä"), "Ä", "ä -> Ä");
  assert.strictEqual(toShiftVariant("ø"), "Ø", "ø -> Ø");
  assert.strictEqual(toShiftVariant("œ"), "Œ", "œ -> Œ");
  assert.strictEqual(toShiftVariant("ß"), "ẞ", "ß -> ẞ (not SS)");
});

QUnit.test("toShiftVariants preserves order and de-duplicates", (assert) => {
  assert.deepEqual(toShiftVariants(["ß", "ś", "š"]), ["ẞ", "Ś", "Š"], "s-list uppercased with ẞ");
  assert.deepEqual(toShiftVariants(["ä", "Ä"]), ["Ä"], "already-uppercase form is not repeated");
});

QUnit.module("latin-variants - shiftedGlyph");

QUnit.test("CapsLock maps the base ß key to ẞ, bypassing its ? shiftValue (#169)", (assert) => {
  assert.strictEqual(shiftedGlyph("ß", "?", true), "ẞ", "Caps + ß -> ẞ, not ? and not SS");
});

QUnit.test("Shift (no Caps) keeps an explicit shiftValue, even for ß", (assert) => {
  assert.strictEqual(shiftedGlyph("ß", "?", false), "?", "Shift + ß -> its physical ? symbol");
  assert.strictEqual(shiftedGlyph("1", "!", false), "!", "explicit shiftValue wins");
});

QUnit.test("a lone cased letter falls back to its uppercase; multi-char values are unchanged", (assert) => {
  assert.strictEqual(shiftedGlyph("a", undefined, false), "A", "a -> A");
  assert.strictEqual(shiftedGlyph("a", undefined, true), "A", "Caps on a plain letter is unaffected");
  assert.strictEqual(shiftedGlyph(" ", undefined, false), " ", "whitespace value is returned unchanged");
  assert.strictEqual(shiftedGlyph("abc", undefined, false), "abc", "multi-char value with no shiftValue is unchanged");
});

QUnit.test("CapsLock ignores an uncased shiftValue and types the base (#176)", (assert) => {
  assert.strictEqual(shiftedGlyph("1", "١", true), "1", "Caps + digit keeps the Latin digit, not the Arabic-Indic one");
  assert.strictEqual(shiftedGlyph("1", "!", true), "1", "Caps + digit keeps the digit, not the symbol");
  assert.strictEqual(shiftedGlyph(",", ";", true), ",", "Caps + punctuation keeps the base punctuation");
  assert.strictEqual(shiftedGlyph("abc", undefined, true), "abc", "Caps on a multi-char value is unchanged");
});

QUnit.test("CapsLock uppercases a cased shiftValue (#176)", (assert) => {
  assert.strictEqual(shiftedGlyph("e", "é", true), "É", "Caps + an accented-letter shiftValue uppercases it");
  assert.strictEqual(shiftedGlyph("ü", "Ü", true), "Ü", "an already-uppercase shiftValue is preserved");
});

QUnit.test("CapsLock is a no-op in caseless scripts (#176)", (assert) => {
  assert.strictEqual(shiftedGlyph("あ", "ぁ", true), "あ", "Caps + kana keeps the base kana");
  assert.strictEqual(shiftedGlyph("ㅂ", "ㅃ", true), "ㅂ", "Caps + jamo keeps the base jamo");
});
