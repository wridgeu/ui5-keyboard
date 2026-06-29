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

  // positive: Chinese
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

  // positive: Korean
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

  // positive: Bopomofo (Taiwanese phonetic)
  it("returns true for Bopomofo", () => {
    expect(isCJKGlyph("\u3105")).toBe(true); // ㄅ
    expect(isCJKGlyph("\u312F")).toBe(true); // range end
    expect(isCJKGlyph("\u31A0")).toBe(true); // ㆠ (Bopomofo Extended start)
    expect(isCJKGlyph("\u31BF")).toBe(true); // Bopomofo Extended end
  });

  // positive: Script_Extensions coverage
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
  it("returns false for empty string", () => {
    expect(isIndicGlyph("")).toBe(false);
  });

  it("returns false for emoji", () => {
    expect(isIndicGlyph("😀")).toBe(false);
  });

  it("checks only the first code point for multi-character strings", () => {
    expect(isIndicGlyph("\u0905b")).toBe(true); // Devanagari + Latin
    expect(isIndicGlyph("A\u0905")).toBe(false); // Latin + Devanagari
  });
});

describe("isHangulGlyph", () => {
  // positive: Hangul Compatibility Jamo (used by ko-hangul layout)
  it("returns true for Hangul Compatibility Jamo consonants", () => {
    expect(isHangulGlyph("\u3131")).toBe(true); // ㄱ (kiyeok)
    expect(isHangulGlyph("\u3134")).toBe(true); // ㄴ (nieun)
    expect(isHangulGlyph("\u3142")).toBe(true); // ㅂ (pieup)
    expect(isHangulGlyph("\u314E")).toBe(true); // ㅎ (hieuh)
  });

  it("returns true for Hangul Compatibility Jamo vowels", () => {
    expect(isHangulGlyph("\u314F")).toBe(true); // ㅏ (a)
    expect(isHangulGlyph("\u3153")).toBe(true); // ㅓ (eo)
    expect(isHangulGlyph("\u3163")).toBe(true); // ㅣ (i)
  });

  it("returns true for tense (ssang) consonants", () => {
    expect(isHangulGlyph("\u3132")).toBe(true); // ㄲ (ssangkiyeok)
    expect(isHangulGlyph("\u3143")).toBe(true); // ㅃ (ssangpieup)
    expect(isHangulGlyph("\u3146")).toBe(true); // ㅆ (ssangsios)
  });

  // positive: Hangul Syllables
  it("returns true for Hangul syllables", () => {
    expect(isHangulGlyph("\uAC00")).toBe(true); // 가 (first syllable)
    expect(isHangulGlyph("\uD7A3")).toBe(true); // 힣 (last syllable)
    expect(isHangulGlyph("\uD55C")).toBe(true); // 한
  });

  // positive: Hangul Jamo
  it("returns true for Hangul Jamo (conjoining)", () => {
    expect(isHangulGlyph("\u1100")).toBe(true); // ᄀ (initial consonant)
    expect(isHangulGlyph("\u1161")).toBe(true); // ᅡ (medial vowel)
    expect(isHangulGlyph("\u11A8")).toBe(true); // ᆨ (final consonant)
  });

  // positive: halfwidth Hangul
  it("returns true for halfwidth Hangul", () => {
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

  it("returns false for empty string", () => {
    expect(isHangulGlyph("")).toBe(false);
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
  // positive: Basic Arabic letters
  it("returns true for basic Arabic letters", () => {
    expect(isArabicGlyph("\u0627")).toBe(true); // ا (alef)
    expect(isArabicGlyph("\u0628")).toBe(true); // ب (ba)
    expect(isArabicGlyph("\u062A")).toBe(true); // ت (ta)
    expect(isArabicGlyph("\u0639")).toBe(true); // ع (ain)
    expect(isArabicGlyph("\u0641")).toBe(true); // ف (fa)
    expect(isArabicGlyph("\u0642")).toBe(true); // ق (qaf)
    expect(isArabicGlyph("\u0643")).toBe(true); // ك (kaf)
    expect(isArabicGlyph("\u0644")).toBe(true); // ل (lam)
    expect(isArabicGlyph("\u0645")).toBe(true); // م (mim)
    expect(isArabicGlyph("\u0646")).toBe(true); // ن (nun)
    expect(isArabicGlyph("\u0647")).toBe(true); // ه (ha)
    expect(isArabicGlyph("\u064A")).toBe(true); // ي (ya)
  });

  // positive: Arabic diacritical marks
  it("returns true for Arabic diacritical marks", () => {
    expect(isArabicGlyph("\u0650")).toBe(true); // ِ (kasra)
    expect(isArabicGlyph("\u064E")).toBe(true); // َ (fatha)
    expect(isArabicGlyph("\u064F")).toBe(true); // ُ (damma)
    expect(isArabicGlyph("\u0651")).toBe(true); // ّ (shadda)
    expect(isArabicGlyph("\u0652")).toBe(true); // ْ (sukun)
  });

  // positive: Arabic-Indic digits
  it("returns true for Arabic-Indic digits", () => {
    expect(isArabicGlyph("\u0660")).toBe(true); // ٠ (zero)
    expect(isArabicGlyph("\u0669")).toBe(true); // ٩ (nine)
  });

  // positive: Persian characters
  it("returns true for Persian (Farsi) characters", () => {
    expect(isArabicGlyph("\u067E")).toBe(true); // پ (pe)
    expect(isArabicGlyph("\u0686")).toBe(true); // چ (che)
    expect(isArabicGlyph("\u0698")).toBe(true); // ژ (zhe)
    expect(isArabicGlyph("\u06AF")).toBe(true); // گ (gaf)
  });

  // positive: Urdu characters
  it("returns true for Urdu characters", () => {
    expect(isArabicGlyph("\u0679")).toBe(true); // ٹ (tte)
    expect(isArabicGlyph("\u0688")).toBe(true); // ڈ (ddal)
    expect(isArabicGlyph("\u0691")).toBe(true); // ڑ (rreh)
    expect(isArabicGlyph("\u06BA")).toBe(true); // ں (noon ghunna)
    expect(isArabicGlyph("\u06BE")).toBe(true); // ھ (heh doachashmee)
    expect(isArabicGlyph("\u06D2")).toBe(true); // ے (yeh barree)
  });

  // positive: Arabic Presentation Forms-A
  it("returns true for Arabic Presentation Forms-A", () => {
    expect(isArabicGlyph("\uFB50")).toBe(true); // ﭐ (alef wasla isolated)
    expect(isArabicGlyph("\uFBD3")).toBe(true); // ﯓ (ng isolated)
  });

  // positive: Arabic Presentation Forms-B
  it("returns true for Arabic Presentation Forms-B", () => {
    expect(isArabicGlyph("\uFE70")).toBe(true); // ﹰ (fathatan isolated)
    expect(isArabicGlyph("\uFEFC")).toBe(true); // ﻼ (lam alef final)
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
  it("returns false for empty string", () => {
    expect(isArabicGlyph("")).toBe(false);
  });

  it("returns false for emoji", () => {
    expect(isArabicGlyph("😀")).toBe(false);
  });

  it("checks only the first code point for multi-character strings", () => {
    expect(isArabicGlyph("\u0627b")).toBe(true); // Arabic + Latin
    expect(isArabicGlyph("A\u0627")).toBe(false); // Latin + Arabic
  });
});
