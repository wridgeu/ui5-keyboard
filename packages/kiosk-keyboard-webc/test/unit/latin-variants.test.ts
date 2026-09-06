import { describe, it, expect } from "vitest";
import type { LayoutDefinition } from "../../src/types.js";
import {
  LATIN_DIACRITIC_VARIANTS,
  applyVariantDefaults,
  resolveVariantTable,
  shiftedGlyph,
  toShiftVariant,
  toShiftVariants,
  type InstanceVariants,
  type VariantTable,
} from "../../src/core/latin-variants.js";

// Unit coverage for the framework-agnostic long-press variant helpers: the
// default Latin-diacritic table, the layout merge that fills default variants
// without clobbering author intent, and the Shift/Caps uppercasing that must
// surface the capital sharp S (ẞ) for ß.

describe("latin-variants table", () => {
  it("covers the German umlaut bases and never repeats the base letter", () => {
    expect(LATIN_DIACRITIC_VARIANTS.a).toContain("ä");
    expect(LATIN_DIACRITIC_VARIANTS.o).toContain("ö");
    expect(LATIN_DIACRITIC_VARIANTS.u).toContain("ü");
    expect(LATIN_DIACRITIC_VARIANTS.s).toContain("ß");
    for (const [base, variants] of Object.entries(LATIN_DIACRITIC_VARIANTS)) {
      expect(variants, `${base} list omits its own base letter`).not.toContain(base);
      expect(variants, `${base} list has no duplicates`).toEqual([...new Set(variants)]);
    }
  });
});

describe("applyVariantDefaults", () => {
  it("fills default variants on matching character keys only", () => {
    const layout: LayoutDefinition = [
      [{ value: "a" }, { value: "b" }, { value: "1", shiftValue: "!" }],
      [
        { value: " ", type: "space" },
        { value: "{backspace}", type: "action" },
      ],
    ];
    const out = applyVariantDefaults(layout);
    expect(out[0][0].variants).toEqual([...LATIN_DIACRITIC_VARIANTS.a]);
    expect(out[0][1].variants).toBeUndefined();
    expect(out[0][2].variants).toBeUndefined();
    expect(out[1][0].variants).toBeUndefined();
    expect(out[1][1].variants).toBeUndefined();
  });

  it("matches case-insensitively on the key value", () => {
    const out = applyVariantDefaults([[{ value: "A" }]]);
    expect(out[0][0].variants).toEqual([...LATIN_DIACRITIC_VARIANTS.a]);
  });

  it("never overrides author-declared variants (including an empty list)", () => {
    const out = applyVariantDefaults([
      [
        { value: "a", variants: ["ä"] },
        { value: "o", variants: [] },
      ],
    ]);
    expect(out[0][0].variants).toEqual(["ä"]);
    expect(out[0][1].variants).toEqual([]);
  });

  it("does not mutate the input layout", () => {
    const layout: LayoutDefinition = [[{ value: "a" }]];
    applyVariantDefaults(layout);
    expect(layout[0][0].variants).toBeUndefined();
  });

  it("accepts a custom table", () => {
    const out = applyVariantDefaults([[{ value: "x" }]], { x: ["χ"] });
    expect(out[0][0].variants).toEqual(["χ"]);
  });

  it("leaves keys named after Object.prototype members untouched", () => {
    const out = applyVariantDefaults([[{ value: "constructor" }, { value: "toString" }, { value: "valueOf" }]]);
    expect(out[0][0].variants).toBeUndefined();
    expect(out[0][1].variants).toBeUndefined();
    expect(out[0][2].variants).toBeUndefined();
  });

  it("skips table application on action, modifier, and space keys", () => {
    const out = applyVariantDefaults([
      [{ value: "a" }, { value: "a", type: "modifier" }, { value: "a", type: "space" }, { value: "a", type: "action" }],
    ]);
    expect(out[0][0].variants, "a plain character key is filled").toEqual([...LATIN_DIACRITIC_VARIANTS.a]);
    expect(out[0][1].variants, "modifier keyed to a table base is not filled").toBeUndefined();
    expect(out[0][2].variants, "space keyed to a table base is not filled").toBeUndefined();
    expect(out[0][3].variants, "action keyed to a table base is not filled").toBeUndefined();
  });

  it("keeps authored variants on action/modifier/space keys (filter gates only the table fill)", () => {
    const out = applyVariantDefaults([
      [
        { value: "{backspace}", type: "action", variants: ["x", "y"] },
        { value: "{shift}", type: "modifier", variants: ["z"] },
      ],
    ]);
    expect(out[0][0].variants).toEqual(["x", "y"]);
    expect(out[0][1].variants).toEqual(["z"]);
  });
});

/** The named tier for one layout, in the overlay shape the custom-layout fold produces. */
const named = (layout: string, table: VariantTable | null, replace = false): InstanceVariants =>
  new Map([[layout, { replace, table }]]);

/** A house accent set, the shape a `defaultVariants` table has. */
const DEFAULTS: VariantTable = { z: ["ź"], q: ["ǫ"] };
/** One layout's own table, the shape a custom layout's `variants` has. */
const NAMED: VariantTable = { a: ["ą"] };

describe("resolveVariantTable", () => {
  it("falls back to the built-in Latin table for a layout with no instance entry", () => {
    expect(resolveVariantTable("qwerty")).toBe(LATIN_DIACRITIC_VARIANTS);
  });

  it("returns null for the built-in non-Latin layouts", () => {
    for (const name of ["ja-romaji", "ja-kana", "ja-kana-compact", "arabic", "ko-hangul"]) {
      expect(resolveVariantTable(name), name).toBeNull();
    }
  });

  it("normalizes the layout name (case and surrounding space)", () => {
    expect(resolveVariantTable("  JA-Kana ")).toBeNull();
    expect(resolveVariantTable("QWERTY")).toBe(LATIN_DIACRITIC_VARIANTS);
  });

  it("a named entry extends the built-in table rather than replacing it", () => {
    const table = resolveVariantTable("qwerty", named("qwerty", { b: ["ḃ"] }))!;
    expect(table.b, "the entry's own letter is added").toEqual(["ḃ"]);
    expect(table.a, "an untouched built-in letter survives").toEqual([...LATIN_DIACRITIC_VARIANTS.a]);
  });

  it("an entry replaces the built-in list for the letters it names", () => {
    expect(resolveVariantTable("qwerty", named("qwerty", { s: ["ś"] }))!.s).toEqual(["ś"]);
  });

  it("a letter mapped to an empty list is suppressed without touching its siblings", () => {
    const table = resolveVariantTable("qwerty", named("qwerty", { s: [] }))!;
    expect(Object.hasOwn(table, "s"), "the suppressed letter is gone").toBe(false);
    expect(table.a).toEqual([...LATIN_DIACRITIC_VARIANTS.a]);
  });

  it("does not mutate the built-in table", () => {
    resolveVariantTable("qwerty", named("qwerty", { a: ["ā"], s: [] }));
    expect(LATIN_DIACRITIC_VARIANTS.a).toContain("ä");
    expect(LATIN_DIACRITIC_VARIANTS.s).toContain("ß");
  });

  it("a table keyed __proto__ contributes an own entry, not a prototype", () => {
    const polluted = JSON.parse('{"__proto__":["x"]}') as VariantTable;
    const table = resolveVariantTable("qwerty", named("qwerty", polluted))!;
    expect(Object.getPrototypeOf(table)).toBeNull();
    expect(Object.hasOwn(table, "__proto__")).toBe(true);
  });

  it("a suppressing named entry with no table of its own opts the layout out", () => {
    expect(resolveVariantTable("qwerty", named("qwerty", null, true))).toBeNull();
  });

  it("returns the built-in table itself when no tier applies", () => {
    expect(resolveVariantTable("qwerty", named("azerty-fr", { b: ["ḃ"] }))).toBe(LATIN_DIACRITIC_VARIANTS);
  });
});

describe("resolveVariantTable - the defaults tier", () => {
  it("applies to every layout, even non-Latin ones", () => {
    const table = resolveVariantTable("qwerty", undefined, DEFAULTS)!;
    expect(table.q, "the defaults letter is added to a Latin layout").toEqual(["ǫ"]);
    expect(table.a, "the built-in tier below it survives").toEqual([...LATIN_DIACRITIC_VARIANTS.a]);
    // The non-Latin built-in tier is null, so the defaults tier stands alone there.
    expect(resolveVariantTable("arabic", undefined, DEFAULTS)).toEqual(DEFAULTS);
    expect(resolveVariantTable("arabic", undefined, DEFAULTS)!.a).toBeUndefined();
  });

  it("composes with a named entry rather than being discarded by it", () => {
    const table = resolveVariantTable("qwerty", named("qwerty", NAMED), DEFAULTS)!;
    expect(table.a, "the named tier wins for the letter it declares").toEqual(["ą"]);
    expect(table.q, "a defaults letter the named tier leaves alone survives").toEqual(["ǫ"]);
    expect(table.z, "and so does the one it overlaps with the built-in").toEqual(["ź"]);
  });

  it("composes with a named entry on a non-Latin layout", () => {
    const table = resolveVariantTable("arabic", named("arabic", NAMED), DEFAULTS)!;
    expect(table).toEqual({ z: ["ź"], q: ["ǫ"], a: ["ą"] });
  });

  it("a letter it drops stays dropped when a named entry declares others", () => {
    const table = resolveVariantTable("qwerty", named("qwerty", NAMED), { s: [] })!;
    expect(Object.hasOwn(table, "s"), "the letter the defaults tier drops is gone").toBe(false);
    expect(table.a, "and the named tier still applies").toEqual(["ą"]);
  });

  it("a named entry that suppresses discards it", () => {
    expect(resolveVariantTable("qwerty", named("qwerty", null, true), DEFAULTS)).toBeNull();
  });

  it("a named entry that suppresses and then declares a table stands that table alone", () => {
    const table = resolveVariantTable("qwerty", named("qwerty", NAMED, true), DEFAULTS)!;
    expect(table, "neither the built-in nor the defaults tier contributes").toEqual({ a: ["ą"] });
  });
});

describe("shift mapping", () => {
  it("uppercases variants, mapping ß to the capital sharp S ẞ", () => {
    expect(toShiftVariant("ä")).toBe("Ä");
    expect(toShiftVariant("ø")).toBe("Ø");
    expect(toShiftVariant("œ")).toBe("Œ");
    expect(toShiftVariant("ß")).toBe("ẞ");
  });

  it("preserves order and de-duplicates", () => {
    expect(toShiftVariants(["ß", "ś", "š"])).toEqual(["ẞ", "Ś", "Š"]);
    expect(toShiftVariants(["ä", "Ä"])).toEqual(["Ä"]);
  });
});

describe("shiftedGlyph", () => {
  it("CapsLock maps the base ß key to ẞ, bypassing its ? shiftValue (#169)", () => {
    expect(shiftedGlyph("ß", "?", true)).toBe("ẞ");
  });

  it("Shift (no Caps) keeps an explicit shiftValue, even for ß", () => {
    expect(shiftedGlyph("ß", "?", false)).toBe("?");
    expect(shiftedGlyph("1", "!", false)).toBe("!");
  });

  it("a lone cased letter falls back to its uppercase; multi-char values are unchanged", () => {
    expect(shiftedGlyph("a", undefined, false)).toBe("A");
    expect(shiftedGlyph("a", undefined, true)).toBe("A");
    expect(shiftedGlyph(" ", undefined, false)).toBe(" ");
    expect(shiftedGlyph("abc", undefined, false)).toBe("abc");
  });

  it("CapsLock ignores an uncased shiftValue and types the base (#176)", () => {
    expect(shiftedGlyph("1", "١", true)).toBe("1");
    expect(shiftedGlyph("1", "!", true)).toBe("1");
    expect(shiftedGlyph(",", ";", true)).toBe(",");
    expect(shiftedGlyph("abc", undefined, true)).toBe("abc");
  });

  it("CapsLock uppercases a cased shiftValue (#176)", () => {
    expect(shiftedGlyph("e", "é", true)).toBe("É");
    expect(shiftedGlyph("ü", "Ü", true)).toBe("Ü");
  });

  it("CapsLock is a no-op in caseless scripts (#176)", () => {
    expect(shiftedGlyph("あ", "ぁ", true)).toBe("あ");
    expect(shiftedGlyph("ㅂ", "ㅃ", true)).toBe("ㅂ");
  });
});
