import type { LayoutDefinition } from "ui5/kiosk/types";
import {
  LATIN_DIACRITIC_VARIANTS,
  applyVariantDefaults,
  toShiftVariant,
  toShiftVariants,
} from "ui5/kiosk/internal/latin-variants";

// Unit coverage for the framework-agnostic long-press variant helpers: the
// default Latin-diacritic table, the layout merge that fills default variants
// without clobbering author intent, and the Shift/Caps uppercasing that must
// surface the capital sharp S (ẞ) for ß.

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
