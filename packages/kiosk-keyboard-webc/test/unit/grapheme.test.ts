import { describe, it, expect } from "vitest";
import {
  graphemeLengthBefore,
  graphemeLengthAfter,
  isSingleGlyph,
  isCJKGlyph,
  isHangulGlyph,
  isIndicGlyph,
  isArabicGlyph,
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
    // This is 28 UTF-16 code units.
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
  // positive: Japanese
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

  // positive: Han (one Script_Extensions class covers every block below)
  it("returns true for Han across its blocks", () => {
    expect(isCJKGlyph("\u4E00")).toBe(true); // 一 (unified ideographs, range start)
    expect(isCJKGlyph("\u9FFF")).toBe(true); // unified ideographs, range end
    expect(isCJKGlyph("\u9F8D")).toBe(true); // 龍 (traditional)
    expect(isCJKGlyph("\u3400")).toBe(true); // Extension A, range start
    expect(isCJKGlyph("\u4DBF")).toBe(true); // Extension A, range end
    expect(isCJKGlyph("\uF900")).toBe(true); // 豈 (Compatibility Ideographs)
    expect(isCJKGlyph("\u3190")).toBe(true); // ㆐ (Kanbun)
    expect(isCJKGlyph("\u2F00")).toBe(true); // ⼀ (Kangxi Radicals)
    expect(isCJKGlyph("\u2E80")).toBe(true); // ⺀ (CJK Radicals Supplement)
    expect(isCJKGlyph("\u31C0")).toBe(true); // ㇀ (CJK Strokes)
    expect(isCJKGlyph("\u3280")).toBe(true); // ㊀ (Enclosed CJK, circled ideograph one)
  });

  // positive: Hangul (one Script_Extensions class covers every block below)
  it("returns true for Hangul across its blocks", () => {
    expect(isCJKGlyph("\uAC00")).toBe(true); // 가 (first syllable)
    expect(isCJKGlyph("\uD7A3")).toBe(true); // 힣 (last syllable)
    expect(isCJKGlyph("\u1100")).toBe(true); // ᄀ (Jamo, range start)
    expect(isCJKGlyph("\u11FF")).toBe(true); // Jamo, range end
    expect(isCJKGlyph("\u3131")).toBe(true); // ㄱ (Compatibility Jamo)
    expect(isCJKGlyph("\uA960")).toBe(true); // Jamo Extended-A, range start
    expect(isCJKGlyph("\uD7B0")).toBe(true); // Jamo Extended-B, range start
    expect(isCJKGlyph("\u3200")).toBe(true); // ㈀ (Enclosed CJK, parenthesized Hangul kiyeok)
    expect(isCJKGlyph("\uFFA1")).toBe(true); // ﾡ (halfwidth Hangul kiyeok)
  });

  // positive: Bopomofo (Taiwanese phonetic)
  it("returns true for Bopomofo", () => {
    expect(isCJKGlyph("\u3105")).toBe(true); // ㄅ
    expect(isCJKGlyph("\u312F")).toBe(true); // range end
    expect(isCJKGlyph("\u31A0")).toBe(true); // ㆠ (Bopomofo Extended start)
    expect(isCJKGlyph("\u31BF")).toBe(true); // Bopomofo Extended end
  });

  // positive: Script_Extensions coverage
  it("returns true for Katakana Phonetic Extensions", () => {
    expect(isCJKGlyph("\u31F0")).toBe(true); // ㇰ (ku)
    expect(isCJKGlyph("\u31FF")).toBe(true); // ㇿ (ro)
  });

  // positive: shared CJK punctuation (must NOT be claimed by Hangul)
  it("returns true for katakana middle dot (shared CJK with Script_Extensions=Hangul)", () => {
    expect(isCJKGlyph("\u30FB")).toBe(true); // ・ katakana middle dot
  });

  // negative: non-CJK scripts (false-positive guards)
  it.each([
    ["A", "Latin"],
    ["z", "Latin"],
    ["@", "Latin"],
    ["1", "Latin"],
    ["ع", "Arabic"],
    ["ا", "Arabic"],
    ["ف", "Arabic"],
    ["А", "Cyrillic"],
    ["ж", "Cyrillic"],
    ["Я", "Cyrillic"],
    ["Α", "Greek"],
    ["ω", "Greek"],
    ["א", "Hebrew"],
    ["ת", "Hebrew"],
    ["ก", "Thai"],
    ["อ", "Thai"],
    ["ไ", "Thai"],
    ["अ", "Devanagari"],
    ["न", "Devanagari"],
    ["ह", "Devanagari"],
    ["அ", "Tamil"],
    ["த", "Tamil"],
    ["অ", "Bengali"],
    ["ব", "Bengali"],
    ["ა", "Georgian"],
    ["რ", "Georgian"],
    ["Ա", "Armenian"],
    ["ա", "Armenian"],
    ["ༀ", "Tibetan"],
    ["ཀ", "Tibetan"],
    ["က", "Myanmar"],
    ["မ", "Myanmar"],
    ["ក", "Khmer"],
    ["ស", "Khmer"],
    ["ກ", "Lao"],
    ["ລ", "Lao"],
    ["ሀ", "Ethiopic"],
    ["በ", "Ethiopic"],
  ])("returns false for %s (non-CJK %s)", (ch) => {
    expect(isCJKGlyph(ch)).toBe(false);
  });

  // negative: edge cases
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

describe("isIndicGlyph", () => {
  // positive: Devanagari
  it("returns true for Devanagari characters", () => {
    expect(isIndicGlyph("\u0905")).toBe(true); // अ (a)
    expect(isIndicGlyph("\u0915")).toBe(true); // क (ka)
    expect(isIndicGlyph("\u0928")).toBe(true); // न (na)
    expect(isIndicGlyph("\u0939")).toBe(true); // ह (ha)
    expect(isIndicGlyph("\u0964")).toBe(true); // । (danda - shared Indic punctuation)
    expect(isIndicGlyph("\u0965")).toBe(true); // ॥ (double danda)
  });

  it("returns true for Devanagari digits", () => {
    expect(isIndicGlyph("\u0966")).toBe(true); // ० (zero)
    expect(isIndicGlyph("\u096F")).toBe(true); // ९ (nine)
  });

  // positive: Bengali
  it("returns true for Bengali characters", () => {
    expect(isIndicGlyph("\u0985")).toBe(true); // অ (a)
    expect(isIndicGlyph("\u0995")).toBe(true); // ক (ka)
    expect(isIndicGlyph("\u09AC")).toBe(true); // ব (ba)
    expect(isIndicGlyph("\u09B9")).toBe(true); // হ (ha)
  });

  // positive: Gurmukhi
  it("returns true for Gurmukhi characters", () => {
    expect(isIndicGlyph("\u0A05")).toBe(true); // ਅ (a)
    expect(isIndicGlyph("\u0A15")).toBe(true); // ਕ (ka)
    expect(isIndicGlyph("\u0A39")).toBe(true); // ਹ (ha)
  });

  // positive: Gujarati
  it("returns true for Gujarati characters", () => {
    expect(isIndicGlyph("\u0A85")).toBe(true); // અ (a)
    expect(isIndicGlyph("\u0A95")).toBe(true); // ક (ka)
    expect(isIndicGlyph("\u0AB9")).toBe(true); // હ (ha)
  });

  // positive: Oriya
  it("returns true for Oriya characters", () => {
    expect(isIndicGlyph("\u0B05")).toBe(true); // ଅ (a)
    expect(isIndicGlyph("\u0B15")).toBe(true); // କ (ka)
    expect(isIndicGlyph("\u0B39")).toBe(true); // ହ (ha)
  });

  // positive: Tamil
  it("returns true for Tamil characters", () => {
    expect(isIndicGlyph("\u0B85")).toBe(true); // அ (a)
    expect(isIndicGlyph("\u0B95")).toBe(true); // க (ka)
    expect(isIndicGlyph("\u0BA4")).toBe(true); // த (ta)
    expect(isIndicGlyph("\u0BB9")).toBe(true); // ஹ (ha)
  });

  // positive: Telugu
  it("returns true for Telugu characters", () => {
    expect(isIndicGlyph("\u0C05")).toBe(true); // అ (a)
    expect(isIndicGlyph("\u0C15")).toBe(true); // క (ka)
    expect(isIndicGlyph("\u0C39")).toBe(true); // హ (ha)
  });

  // positive: Kannada
  it("returns true for Kannada characters", () => {
    expect(isIndicGlyph("\u0C85")).toBe(true); // ಅ (a)
    expect(isIndicGlyph("\u0C95")).toBe(true); // ಕ (ka)
    expect(isIndicGlyph("\u0CB9")).toBe(true); // ಹ (ha)
  });

  // positive: Malayalam
  it("returns true for Malayalam characters", () => {
    expect(isIndicGlyph("\u0D05")).toBe(true); // അ (a)
    expect(isIndicGlyph("\u0D15")).toBe(true); // ക (ka)
    expect(isIndicGlyph("\u0D39")).toBe(true); // ഹ (ha)
  });

  // positive: Sinhala
  it("returns true for Sinhala characters", () => {
    expect(isIndicGlyph("\u0D85")).toBe(true); // අ (a)
    expect(isIndicGlyph("\u0D9A")).toBe(true); // ක (ka)
    expect(isIndicGlyph("\u0DC4")).toBe(true); // හ (ha)
  });

  // negative: non-Indic scripts (false-positive guards)
  it.each([
    ["A", "Latin"],
    ["z", "Latin"],
    ["1", "Latin"],
    ["あ", "CJK"],
    ["一", "CJK"],
    ["가", "CJK"],
    ["ع", "Arabic"],
    ["ا", "Arabic"],
    ["ก", "Thai"],
    ["อ", "Thai"],
    ["ༀ", "Tibetan"],
    ["ཀ", "Tibetan"],
    ["က", "Myanmar"],
    ["မ", "Myanmar"],
    ["ក", "Khmer"],
    ["ស", "Khmer"],
    ["ກ", "Lao"],
    ["ລ", "Lao"],
    ["ა", "Georgian"],
    ["А", "Cyrillic"],
  ])("returns false for %s (non-Indic %s)", (ch) => {
    expect(isIndicGlyph(ch)).toBe(false);
  });

  // negative: edge cases
  it("returns false for emoji", () => {
    expect(isIndicGlyph("😀")).toBe(false);
  });

  it("checks only the first code point for multi-character strings", () => {
    expect(isIndicGlyph("\u0905b")).toBe(true); // Devanagari + Latin
    expect(isIndicGlyph("A\u0905")).toBe(false); // Latin + Devanagari
  });
});

describe("isHangulGlyph", () => {
  // positive: one `\p{Script=Hangul}` class covers every block below
  it("returns true for Hangul across its blocks", () => {
    expect(isHangulGlyph("\u3131")).toBe(true); // ㄱ (Compatibility Jamo consonant, used by ko-hangul layout)
    expect(isHangulGlyph("\u314F")).toBe(true); // ㅏ (Compatibility Jamo vowel)
    expect(isHangulGlyph("\u3132")).toBe(true); // ㄲ (tense consonant)
    expect(isHangulGlyph("\uAC00")).toBe(true); // 가 (first syllable)
    expect(isHangulGlyph("\uD7A3")).toBe(true); // 힣 (last syllable)
    expect(isHangulGlyph("\u1100")).toBe(true); // ᄀ (conjoining Jamo)
    expect(isHangulGlyph("\uFFA1")).toBe(true); // ﾡ (halfwidth kiyeok)
  });

  // negative: non-Hangul scripts
  it("returns false for Latin characters", () => {
    expect(isHangulGlyph("A")).toBe(false);
    expect(isHangulGlyph("1")).toBe(false);
  });

  it("returns false for Japanese hiragana/katakana", () => {
    expect(isHangulGlyph("\u3042")).toBe(false); // あ
    expect(isHangulGlyph("\u30A2")).toBe(false); // ア
  });

  it("returns false for CJK ideographs", () => {
    expect(isHangulGlyph("\u4E00")).toBe(false); // 一
    expect(isHangulGlyph("\u5B57")).toBe(false); // 字
  });

  it("returns false for Indic characters", () => {
    expect(isHangulGlyph("\u0905")).toBe(false); // अ (Devanagari)
    expect(isHangulGlyph("\u0B85")).toBe(false); // அ (Tamil)
  });

  it("returns false for Arabic characters", () => {
    expect(isHangulGlyph("\u0627")).toBe(false); // ا
  });

  // negative: shared CJK punctuation that has Script_Extensions=Hangul but Script=Common
  it("returns false for ideographic comma (shared CJK, not Hangul-exclusive)", () => {
    expect(isHangulGlyph("\u3001")).toBe(false); // 、
  });

  it("returns false for ideographic full stop (shared CJK, not Hangul-exclusive)", () => {
    expect(isHangulGlyph("\u3002")).toBe(false); // 。
  });

  it("returns false for katakana middle dot (shared CJK, not Hangul-exclusive)", () => {
    expect(isHangulGlyph("\u30FB")).toBe(false); // ・
  });

  it("returns false for emoji", () => {
    expect(isHangulGlyph("😀")).toBe(false);
  });

  it("checks only the first code point for multi-character strings", () => {
    expect(isHangulGlyph("\u3131b")).toBe(true); // Hangul + Latin
    expect(isHangulGlyph("A\u3131")).toBe(false); // Latin + Hangul
  });
});

describe("isArabicGlyph", () => {
  // positive: one `\p{Script_Extensions=Arabic}` class covers every block below
  it("returns true for Arabic across its blocks", () => {
    expect(isArabicGlyph("\u0627")).toBe(true); // ا (alef)
    expect(isArabicGlyph("\u0650")).toBe(true); // ِ (kasra, diacritic)
    expect(isArabicGlyph("\u0660")).toBe(true); // ٠ (Arabic-Indic zero)
    expect(isArabicGlyph("\u067E")).toBe(true); // پ (Persian pe)
    expect(isArabicGlyph("\u0679")).toBe(true); // ٹ (Urdu tte)
    expect(isArabicGlyph("\uFB50")).toBe(true); // ﭐ (Presentation Forms-A)
    expect(isArabicGlyph("\uFEFC")).toBe(true); // ﻼ (Presentation Forms-B)
  });

  // negative: non-Arabic scripts (false-positive guards)
  it.each([
    ["A", "Latin"],
    ["z", "Latin"],
    ["1", "Latin"],
    ["あ", "CJK"],
    ["一", "CJK"],
    ["가", "CJK"],
    ["अ", "Indic"],
    ["அ", "Indic"],
    ["א", "Hebrew"],
    ["ת", "Hebrew"],
    ["А", "Cyrillic"],
    ["Я", "Cyrillic"],
    ["ก", "Thai"],
  ])("returns false for %s (non-Arabic %s)", (ch) => {
    expect(isArabicGlyph(ch)).toBe(false);
  });

  // negative: edge cases
  it("returns false for emoji", () => {
    expect(isArabicGlyph("😀")).toBe(false);
  });

  it("checks only the first code point for multi-character strings", () => {
    expect(isArabicGlyph("\u0627b")).toBe(true); // Arabic + Latin
    expect(isArabicGlyph("A\u0627")).toBe(false); // Latin + Arabic
  });
});
