import { describe, it, expect } from "vitest";
import type { LayoutDefinition } from "../../src/types.js";
import {
  LATIN_DIACRITIC_VARIANTS,
  applyVariantDefaults,
  toShiftVariant,
  toShiftVariants,
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
      [{ value: " ", type: "space" }, { value: "{backspace}", type: "action" }],
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
    const out = applyVariantDefaults([[{ value: "a", variants: ["ä"] }, { value: "o", variants: [] }]]);
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
