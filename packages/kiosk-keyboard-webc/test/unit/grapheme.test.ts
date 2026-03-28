import { describe, it, expect } from "vitest";
import { graphemeLengthBefore, graphemeLengthAfter, isSingleGlyph, isCJKGlyph } from "../../src/core/grapheme.js";

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

describe("isCJKGlyph", () => {
  // --- positive: Japanese ---
  it("returns true for hiragana", () => {
    expect(isCJKGlyph("\u3042")).toBe(true); // あ
    expect(isCJKGlyph("\u306C")).toBe(true); // ぬ
    expect(isCJKGlyph("\u3093")).toBe(true); // ん
  });

  it("returns true for katakana", () => {
    expect(isCJKGlyph("\u30A2")).toBe(true); // ア
    expect(isCJKGlyph("\u30FC")).toBe(true); // ー prolonged sound mark
  });

  it("returns true for halfwidth katakana", () => {
    expect(isCJKGlyph("\uFF66")).toBe(true); // ヲ (halfwidth)
    expect(isCJKGlyph("\uFF9F")).toBe(true); // ゚ (halfwidth handakuten, range end)
  });

  it("returns true for CJK punctuation", () => {
    expect(isCJKGlyph("\u3001")).toBe(true); // 、
    expect(isCJKGlyph("\u3002")).toBe(true); // 。
    expect(isCJKGlyph("\u309B")).toBe(true); // ゛ dakuten
    expect(isCJKGlyph("\u309C")).toBe(true); // ゜ handakuten
  });

  it("returns false for ideographic space (Script=Common, no CJK Script_Extensions)", () => {
    expect(isCJKGlyph("\u3000")).toBe(false);
  });

  // --- positive: Chinese ---
  it("returns true for CJK unified ideographs (Chinese)", () => {
    expect(isCJKGlyph("\u4E00")).toBe(true); // 一 (range start)
    expect(isCJKGlyph("\u9FFF")).toBe(true); // range end
    expect(isCJKGlyph("\u5B57")).toBe(true); // 字
    expect(isCJKGlyph("\u4EBA")).toBe(true); // 人
    expect(isCJKGlyph("\u5927")).toBe(true); // 大
    expect(isCJKGlyph("\u6C34")).toBe(true); // 水
    expect(isCJKGlyph("\u706B")).toBe(true); // 火
  });

  it("returns true for traditional Chinese characters", () => {
    expect(isCJKGlyph("\u9F8D")).toBe(true); // 龍
    expect(isCJKGlyph("\u8B80")).toBe(true); // 讀
    expect(isCJKGlyph("\u6A23")).toBe(true); // 樣
  });

  it("returns true for CJK Extension A (rare/historic Chinese)", () => {
    expect(isCJKGlyph("\u3400")).toBe(true); // range start
    expect(isCJKGlyph("\u4DBF")).toBe(true); // range end
    expect(isCJKGlyph("\u3401")).toBe(true); // 㐁
  });

  it("returns true for CJK Compatibility Ideographs", () => {
    expect(isCJKGlyph("\uF900")).toBe(true); // 豈
    expect(isCJKGlyph("\uFAD9")).toBe(true); // 龎 (last assigned in block)
    expect(isCJKGlyph("\uF90A")).toBe(true); // 金
  });

  it("returns true for Kanbun (Chinese annotation marks)", () => {
    expect(isCJKGlyph("\u3190")).toBe(true); // ㆐ (range start)
    expect(isCJKGlyph("\u319F")).toBe(true); // ㆟ (range end)
  });

  // --- positive: Korean ---
  it("returns true for Hangul syllables", () => {
    expect(isCJKGlyph("\uAC00")).toBe(true); // 가 (first Hangul syllable)
    expect(isCJKGlyph("\uD7A3")).toBe(true); // 힣 (last Hangul syllable)
    expect(isCJKGlyph("\uD55C")).toBe(true); // 한
    expect(isCJKGlyph("\uAE00")).toBe(true); // 글
    expect(isCJKGlyph("\uB9D0")).toBe(true); // 말
  });

  it("returns true for Hangul Jamo", () => {
    expect(isCJKGlyph("\u1100")).toBe(true); // ᄀ (initial consonant, range start)
    expect(isCJKGlyph("\u11FF")).toBe(true); // range end
    expect(isCJKGlyph("\u1161")).toBe(true); // ᅡ (medial vowel)
    expect(isCJKGlyph("\u11A8")).toBe(true); // ᆨ (final consonant)
  });

  it("returns true for Hangul Compatibility Jamo", () => {
    expect(isCJKGlyph("\u3131")).toBe(true); // ㄱ
    expect(isCJKGlyph("\u314F")).toBe(true); // ㅏ
    expect(isCJKGlyph("\u318E")).toBe(true); // ��� (last assigned)
  });

  it("returns true for Hangul Jamo Extended-A", () => {
    expect(isCJKGlyph("\uA960")).toBe(true); // range start
    expect(isCJKGlyph("\uA97C")).toBe(true); // ꥼ (last assigned)
  });

  it("returns true for Hangul Jamo Extended-B", () => {
    expect(isCJKGlyph("\uD7B0")).toBe(true); // range start
    expect(isCJKGlyph("\uD7FB")).toBe(true); // ퟻ (last assigned)
  });

  // --- positive: Bopomofo (Taiwanese phonetic) ---
  it("returns true for Bopomofo", () => {
    expect(isCJKGlyph("\u3105")).toBe(true); // ㄅ
    expect(isCJKGlyph("\u312F")).toBe(true); // range end
    expect(isCJKGlyph("\u31A0")).toBe(true); // ㆠ (Bopomofo Extended start)
    expect(isCJKGlyph("\u31BF")).toBe(true); // Bopomofo Extended end
  });

  // --- positive: Script_Extensions coverage beyond the old manual ranges ---
  it("returns true for Kangxi Radicals", () => {
    expect(isCJKGlyph("\u2F00")).toBe(true); // ⼀ (radical one)
    expect(isCJKGlyph("\u2FD5")).toBe(true); // ⿕ (radical flute)
  });

  it("returns true for CJK Radicals Supplement", () => {
    expect(isCJKGlyph("\u2E80")).toBe(true); // ⺀
    expect(isCJKGlyph("\u2EF3")).toBe(true); // ⻳
  });

  it("returns true for CJK Strokes", () => {
    expect(isCJKGlyph("\u31C0")).toBe(true); // ㇀
    expect(isCJKGlyph("\u31E3")).toBe(true); // ㇣
  });

  it("returns true for Katakana Phonetic Extensions", () => {
    expect(isCJKGlyph("\u31F0")).toBe(true); // ㇰ (ku)
    expect(isCJKGlyph("\u31FF")).toBe(true); // ㇿ (ro)
  });

  it("returns true for Enclosed CJK Letters", () => {
    expect(isCJKGlyph("\u3200")).toBe(true); // ㈀ (parenthesized Hangul kiyeok)
    expect(isCJKGlyph("\u3280")).toBe(true); // ㊀ (circled ideograph one)
  });

  it("returns true for halfwidth Hangul", () => {
    expect(isCJKGlyph("\uFFA1")).toBe(true); // ﾡ (halfwidth Hangul kiyeok)
    expect(isCJKGlyph("\uFFBE")).toBe(true); // ﾾ (halfwidth Hangul ieung)
  });

  // --- negative: non-CJK scripts (false-positive guards) ---
  it("returns false for Latin characters", () => {
    expect(isCJKGlyph("A")).toBe(false);
    expect(isCJKGlyph("z")).toBe(false);
    expect(isCJKGlyph("@")).toBe(false);
    expect(isCJKGlyph("1")).toBe(false);
  });

  it("returns false for Arabic characters", () => {
    expect(isCJKGlyph("\u0639")).toBe(false); // ع
    expect(isCJKGlyph("\u0627")).toBe(false); // ا (alef)
    expect(isCJKGlyph("\u0641")).toBe(false); // ف
  });

  it("returns false for Cyrillic characters", () => {
    expect(isCJKGlyph("\u0410")).toBe(false); // А
    expect(isCJKGlyph("\u0436")).toBe(false); // ж
    expect(isCJKGlyph("\u042F")).toBe(false); // Я
  });

  it("returns false for Greek characters", () => {
    expect(isCJKGlyph("\u0391")).toBe(false); // Α (Alpha)
    expect(isCJKGlyph("\u03C9")).toBe(false); // ω (omega)
  });

  it("returns false for Hebrew characters", () => {
    expect(isCJKGlyph("\u05D0")).toBe(false); // א (aleph)
    expect(isCJKGlyph("\u05EA")).toBe(false); // ת (tav)
  });

  it("returns false for Thai characters", () => {
    expect(isCJKGlyph("\u0E01")).toBe(false); // ก (ko kai)
    expect(isCJKGlyph("\u0E2D")).toBe(false); // อ (o ang)
    expect(isCJKGlyph("\u0E44")).toBe(false); // ไ
  });

  it("returns false for Devanagari (Hindi) characters", () => {
    expect(isCJKGlyph("\u0905")).toBe(false); // अ
    expect(isCJKGlyph("\u0928")).toBe(false); // न
    expect(isCJKGlyph("\u0939")).toBe(false); // ह
  });

  it("returns false for Tamil characters", () => {
    expect(isCJKGlyph("\u0B85")).toBe(false); // அ
    expect(isCJKGlyph("\u0BA4")).toBe(false); // த
  });

  it("returns false for Bengali characters", () => {
    expect(isCJKGlyph("\u0985")).toBe(false); // অ
    expect(isCJKGlyph("\u09AC")).toBe(false); // ব
  });

  it("returns false for Georgian characters", () => {
    expect(isCJKGlyph("\u10D0")).toBe(false); // ა
    expect(isCJKGlyph("\u10E0")).toBe(false); // რ
  });

  it("returns false for Armenian characters", () => {
    expect(isCJKGlyph("\u0531")).toBe(false); // Ա
    expect(isCJKGlyph("\u0561")).toBe(false); // ա
  });

  it("returns false for Tibetan characters", () => {
    expect(isCJKGlyph("\u0F00")).toBe(false); // ༀ
    expect(isCJKGlyph("\u0F40")).toBe(false); // ཀ
  });

  it("returns false for Myanmar characters", () => {
    expect(isCJKGlyph("\u1000")).toBe(false); // က
    expect(isCJKGlyph("\u1019")).toBe(false); // မ
  });

  it("returns false for Khmer characters", () => {
    expect(isCJKGlyph("\u1780")).toBe(false); // ក
    expect(isCJKGlyph("\u179F")).toBe(false); // ស
  });

  it("returns false for Lao characters", () => {
    expect(isCJKGlyph("\u0E81")).toBe(false); // ກ
    expect(isCJKGlyph("\u0EA5")).toBe(false); // ລ
  });

  it("returns false for Ethiopic characters", () => {
    expect(isCJKGlyph("\u1200")).toBe(false); // ሀ
    expect(isCJKGlyph("\u1260")).toBe(false); // በ
  });

  // --- negative: edge cases ---
  it("returns false for empty string", () => {
    expect(isCJKGlyph("")).toBe(false);
  });

  it("returns false for emoji", () => {
    expect(isCJKGlyph("😀")).toBe(false);
    expect(isCJKGlyph("🎹")).toBe(false);
  });

  it("returns false for fullwidth Latin (not CJK despite being in FF block)", () => {
    expect(isCJKGlyph("\uFF21")).toBe(false); // Ａ (fullwidth A)
    expect(isCJKGlyph("\uFF41")).toBe(false); // ａ (fullwidth a)
  });

  it("checks only the first code point for multi-character strings", () => {
    expect(isCJKGlyph("\u3042b")).toBe(true); // hiragana + Latin
    expect(isCJKGlyph("A\u3042")).toBe(false); // Latin + hiragana
  });
});
