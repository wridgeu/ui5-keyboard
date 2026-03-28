import { describe, it, expect } from "vitest";
import {
  graphemeLengthBefore,
  graphemeLengthAfter,
  hasOnlyEastAsianGlyphs,
  isSingleGlyph,
} from "../../src/core/grapheme.js";

describe("graphemeLengthBefore", () => {
  it("returns 0 at position 0", () => {
    expect(graphemeLengthBefore("abc", 0)).toBe(0);
  });

  it("returns 1 for ASCII character", () => {
    expect(graphemeLengthBefore("abc", 2)).toBe(1);
  });

  it("returns 2 for surrogate pair emoji", () => {
    // "😀" is U+1F600, encoded as 2 UTF-16 code units
    expect(graphemeLengthBefore("a😀b", 3)).toBe(2);
  });

  it("handles combined emoji (flag)", () => {
    // "🇩🇪" is a regional indicator sequence (4 code units)
    const flag = "🇩🇪";
    const str = `a${flag}b`;
    const offset = 1 + flag.length; // position after the flag
    expect(graphemeLengthBefore(str, offset)).toBe(flag.length);
  });

  it("returns 0 for negative offset", () => {
    expect(graphemeLengthBefore("abc", -1)).toBe(0);
  });

  it("handles long grapheme cluster (subdivision flag tag sequence)", () => {
    // 🏴󠁧󠁢󠁥󠁮󠁧󠁿 = black flag + tag_g + tag_b + tag_e + tag_n + tag_g + cancel_tag
    // This is 28 UTF-16 code units - exceeds the old 20 code-unit window.
    const flag = "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
    const str = `a${flag}b`;
    const offset = 1 + flag.length; // position after the flag
    expect(graphemeLengthBefore(str, offset)).toBe(flag.length);
  });
});

describe("graphemeLengthAfter", () => {
  it("returns 0 at end of string", () => {
    expect(graphemeLengthAfter("abc", 3)).toBe(0);
  });

  it("returns 1 for ASCII character", () => {
    expect(graphemeLengthAfter("abc", 0)).toBe(1);
  });

  it("returns 2 for surrogate pair emoji", () => {
    expect(graphemeLengthAfter("a😀b", 1)).toBe(2);
  });

  it("returns 0 for offset past string length", () => {
    expect(graphemeLengthAfter("abc", 10)).toBe(0);
  });
});

describe("isSingleGlyph", () => {
  it("returns true for single ASCII character", () => {
    expect(isSingleGlyph("A")).toBe(true);
    expect(isSingleGlyph("@")).toBe(true);
    expect(isSingleGlyph("9")).toBe(true);
  });

  it("returns false for multi-character strings", () => {
    expect(isSingleGlyph("Tab")).toBe(false);
    expect(isSingleGlyph("F1")).toBe(false);
    expect(isSingleGlyph("ab")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isSingleGlyph("")).toBe(false);
  });

  it("returns true for surrogate pair emoji", () => {
    expect(isSingleGlyph("😀")).toBe(true);
    expect(isSingleGlyph("🎹")).toBe(true);
  });

  it("returns true for flag emoji (regional indicator sequence)", () => {
    expect(isSingleGlyph("🇩🇪")).toBe(true);
  });

  it("returns true for ZWJ sequence (family emoji)", () => {
    // 👨‍👩‍👧 = man + ZWJ + woman + ZWJ + girl - one grapheme cluster
    expect(isSingleGlyph("👨\u200D👩\u200D👧")).toBe(true);
  });

  it("returns true for combining character sequence", () => {
    // é as e + combining acute accent - one grapheme cluster
    expect(isSingleGlyph("e\u0301")).toBe(true);
  });

  it("returns false for two separate emoji", () => {
    expect(isSingleGlyph("😀😀")).toBe(false);
  });

  it("returns true for subdivision flag tag sequence", () => {
    const englandFlag = "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
    expect(isSingleGlyph(englandFlag)).toBe(true);
  });
});

describe("hasOnlyEastAsianGlyphs", () => {
  it("returns true for kana and Japanese punctuation", () => {
    expect(hasOnlyEastAsianGlyphs("ぬ")).toBe(true);
    expect(hasOnlyEastAsianGlyphs("゛")).toBe(true);
    expect(hasOnlyEastAsianGlyphs("。")).toBe(true);
    expect(hasOnlyEastAsianGlyphs("かな")).toBe(true);
  });

  it("returns false for non-East-Asian labels", () => {
    expect(hasOnlyEastAsianGlyphs("A")).toBe(false);
    expect(hasOnlyEastAsianGlyphs("ض")).toBe(false);
    expect(hasOnlyEastAsianGlyphs("😀")).toBe(false);
    expect(hasOnlyEastAsianGlyphs("")).toBe(false);
  });
});
