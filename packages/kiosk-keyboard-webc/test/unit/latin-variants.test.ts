import { describe, it, expect } from "vitest";
import type { LayoutDefinition } from "../../src/types.js";
import {
  LATIN_DIACRITIC_VARIANTS,
  WILDCARD_LAYOUT,
  applyVariantDefaults,
  resolveVariantTable,
  shiftedGlyph,
  toShiftVariant,
  toShiftVariants,
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

describe("resolveVariantTable", () => {
  const custom: VariantTable = { b: ["ḃ"] };

  it("falls back to the built-in Latin table for a layout with no instance entry", () => {
    expect(resolveVariantTable("qwerty")).toBe(LATIN_DIACRITIC_VARIANTS);
  });

  it("returns null for the built-in non-Latin layouts", () => {
    for (const name of ["ja-romaji", "ja-kana", "arabic", "ko-hangul"]) {
      expect(resolveVariantTable(name), name).toBeNull();
    }
  });

  it("normalizes the layout name (case and surrounding space)", () => {
    expect(resolveVariantTable("  JA-Kana ")).toBeNull();
    expect(resolveVariantTable("QWERTY")).toBe(LATIN_DIACRITIC_VARIANTS);
  });

  it("an instance entry wins over the built-in table", () => {
    const map = new Map<string, VariantTable | null>([["qwerty", custom]]);
    expect(resolveVariantTable("qwerty", map)).toBe(custom);
  });

  it("an explicit null instance entry opts the layout out", () => {
    const map = new Map<string, VariantTable | null>([["qwerty", null]]);
    expect(resolveVariantTable("qwerty", map)).toBeNull();
  });

  it("the '*' wildcard applies to layouts without their own entry, even non-Latin ones", () => {
    const map = new Map<string, VariantTable | null>([[WILDCARD_LAYOUT, custom]]);
    expect(resolveVariantTable("qwerty", map)).toBe(custom);
    expect(resolveVariantTable("arabic", map)).toBe(custom);
  });

  it("an explicit entry beats the wildcard", () => {
    const map = new Map<string, VariantTable | null>([
      [WILDCARD_LAYOUT, custom],
      ["qwerty", null],
    ]);
    expect(resolveVariantTable("qwerty", map)).toBeNull();
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
