import {
  graphemeLengthAfter,
  graphemeLengthBefore,
  isArabicGlyph,
  isCJKGlyph,
  isHangulGlyph,
  isIndicGlyph,
  isSingleGlyph,
} from "ui5/kiosk/internal/grapheme";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { LayoutDefinition } from "ui5/kiosk/types";
import Input from "sap/m/Input";
import { placeAndWait, tapKey, waitForRender } from "./test-helpers";

// ── Unit tests: graphemeLengthBefore ──────────────────────────

QUnit.module("graphemeLengthBefore");

QUnit.test("ASCII character", (assert) => {
  assert.strictEqual(graphemeLengthBefore("abc", 3), 1, "c is 1 code unit");
  assert.strictEqual(graphemeLengthBefore("abc", 2), 1, "b is 1 code unit");
  assert.strictEqual(graphemeLengthBefore("abc", 1), 1, "a is 1 code unit");
});

QUnit.test("offset 0 returns 0", (assert) => {
  assert.strictEqual(graphemeLengthBefore("abc", 0), 0, "nothing before position 0");
});

QUnit.test("empty string returns 0", (assert) => {
  assert.strictEqual(graphemeLengthBefore("", 0), 0, "empty string at 0");
});

QUnit.test("surrogate pair (emoji outside BMP)", (assert) => {
  // 😀 = U+1F600 = 2 code units
  const s = "a😀b";
  // positions: a=0, 😀=1..2, b=3
  assert.strictEqual(graphemeLengthBefore(s, 3), 2, "😀 is 2 code units");
});

QUnit.test("variation selector sequence", (assert) => {
  // ❤️ = U+2764 + U+FE0F = 2 code units (base + VS16)
  const s = "a❤️b";
  // a=0, ❤=1, ️(FE0F)=2, b=3
  assert.strictEqual(graphemeLengthBefore(s, 3), 2, "❤️ is 2 code units as one grapheme");
});

QUnit.test("ZWJ sequence", (assert) => {
  // 👨‍👩‍👧 = U+1F468 ZWJ U+1F469 ZWJ U+1F467 = 8 code units
  const emoji = "👨‍👩‍👧";
  const s = `a${emoji}b`;
  const emojiEnd = 1 + emoji.length;
  assert.strictEqual(graphemeLengthBefore(s, emojiEnd), emoji.length, "ZWJ family emoji treated as one grapheme");
});

QUnit.test("combining mark (n + combining tilde)", (assert) => {
  // ñ as n(U+006E) + combining tilde(U+0303) = 2 code units
  const s = "an\u0303o";
  // a=0, n=1, ̃=2, o=3
  assert.strictEqual(graphemeLengthBefore(s, 3), 2, "n + combining tilde is one grapheme of 2 code units");
});

QUnit.test("regional indicator pair (flag)", (assert) => {
  // 🇩🇪 = U+1F1E9 + U+1F1EA = 4 code units (two surrogate pairs)
  const flag = "🇩🇪";
  const s = `x${flag}y`;
  const flagEnd = 1 + flag.length;
  assert.strictEqual(graphemeLengthBefore(s, flagEnd), flag.length, "flag emoji is one grapheme");
});

// ── Unit tests: graphemeLengthAfter ───────────────────────────

QUnit.module("graphemeLengthAfter");

QUnit.test("ASCII character", (assert) => {
  assert.strictEqual(graphemeLengthAfter("abc", 0), 1, "a is 1 code unit");
  assert.strictEqual(graphemeLengthAfter("abc", 1), 1, "b is 1 code unit");
});

QUnit.test("offset at end returns 0", (assert) => {
  assert.strictEqual(graphemeLengthAfter("abc", 3), 0, "nothing after end");
});

QUnit.test("empty string returns 0", (assert) => {
  assert.strictEqual(graphemeLengthAfter("", 0), 0, "empty string");
});

QUnit.test("surrogate pair (emoji outside BMP)", (assert) => {
  const s = "a😀b";
  assert.strictEqual(graphemeLengthAfter(s, 1), 2, "😀 starting at offset 1 is 2 code units");
});

QUnit.test("variation selector sequence", (assert) => {
  const s = "a❤️b";
  assert.strictEqual(graphemeLengthAfter(s, 1), 2, "❤️ starting at offset 1 is 2 code units");
});

QUnit.test("ZWJ sequence", (assert) => {
  const emoji = "👨‍👩‍👧";
  const s = `a${emoji}b`;
  assert.strictEqual(graphemeLengthAfter(s, 1), emoji.length, "ZWJ family emoji treated as one grapheme");
});

QUnit.test("combining mark", (assert) => {
  const s = "an\u0303o";
  assert.strictEqual(graphemeLengthAfter(s, 1), 2, "n + combining tilde at offset 1 is one grapheme");
});

QUnit.test("regional indicator pair (flag)", (assert) => {
  const flag = "🇩🇪";
  const s = `x${flag}y`;
  assert.strictEqual(graphemeLengthAfter(s, 1), flag.length, "flag emoji at offset 1 is one grapheme");
});

// ── Integration tests through KioskKeyboard ───────────────────

QUnit.module("Grapheme integration", {
  afterEach() {
    KioskKeyboard.resetCustomLayouts();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Backspace deletes entire surrogate-pair emoji in one press", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const emojiLayout: LayoutDefinition = [[{ value: "😀" }, { value: "{backspace}" }]];
  KioskKeyboard.registerLayout("test-emoji-bs", emojiLayout);
  const kb = new KioskKeyboard({ layout: "test-emoji-bs", targetInput: input });
  await placeAndWait(kb);

  input.focus();
  await waitForRender();

  // Type the emoji
  tapKey(kb, "😀");
  await waitForRender();
  assert.strictEqual(input.getValue(), "😀", "Emoji inserted");

  // One backspace should remove the whole emoji
  tapKey(kb, "{backspace}");
  await waitForRender();
  assert.strictEqual(input.getValue(), "", "Emoji fully deleted in one backspace");

  input.destroy();
  kb.destroy();
});

QUnit.test("Backspace deletes ZWJ sequence in one press", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const emoji = "👨‍👩‍👧";
  const layout: LayoutDefinition = [[{ value: emoji }, { value: "{backspace}" }]];
  KioskKeyboard.registerLayout("test-zwj-bs", layout);
  const kb = new KioskKeyboard({ layout: "test-zwj-bs", targetInput: input });
  await placeAndWait(kb);

  input.focus();
  await waitForRender();

  tapKey(kb, emoji);
  await waitForRender();
  assert.strictEqual(input.getValue(), emoji, "ZWJ emoji inserted");

  tapKey(kb, "{backspace}");
  await waitForRender();
  assert.strictEqual(input.getValue(), "", "ZWJ emoji fully deleted in one backspace");

  input.destroy();
  kb.destroy();
});

QUnit.test("Backspace after mixed ASCII+emoji only removes last grapheme", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const layout: LayoutDefinition = [[{ value: "a" }, { value: "😀" }, { value: "{backspace}" }]];
  KioskKeyboard.registerLayout("test-mixed-bs", layout);
  const kb = new KioskKeyboard({ layout: "test-mixed-bs", targetInput: input });
  await placeAndWait(kb);

  input.focus();
  await waitForRender();

  tapKey(kb, "a");
  tapKey(kb, "😀");
  await waitForRender();
  assert.strictEqual(input.getValue(), "a😀", "Mixed content inserted");

  tapKey(kb, "{backspace}");
  await waitForRender();
  assert.strictEqual(input.getValue(), "a", "Only emoji removed, ASCII preserved");

  tapKey(kb, "{backspace}");
  await waitForRender();
  assert.strictEqual(input.getValue(), "", "ASCII character removed");

  input.destroy();
  kb.destroy();
});

QUnit.test("ArrowLeft and ArrowRight step over emoji as one unit", async (assert) => {
  const input = new Input({ value: "a😀b" });
  input.placeAt("qunit-fixture");

  const layout: LayoutDefinition = [[{ value: "{fkey:ArrowLeft}" }, { value: "{fkey:ArrowRight}" }]];
  KioskKeyboard.registerLayout("test-emoji-nav", layout);
  const kb = new KioskKeyboard({ layout: "test-emoji-nav", targetInput: input });
  await placeAndWait(kb);

  input.focus();
  await waitForRender();

  const dom = input.getFocusDomRef() as HTMLInputElement;
  // "a😀b" has length 4 (a=0, 😀=1..2, b=3)
  // Place cursor at end (pos 4)
  dom.setSelectionRange(4, 4);

  // ArrowLeft from end: should land before 'b' at position 3
  tapKey(kb, "{fkey:ArrowLeft}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 3, "ArrowLeft from end: before b (pos 3)");

  // ArrowLeft again: should skip entire 😀, landing at position 1
  tapKey(kb, "{fkey:ArrowLeft}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 1, "ArrowLeft skips whole emoji to pos 1");

  // ArrowLeft again: before 'a' at position 0
  tapKey(kb, "{fkey:ArrowLeft}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 0, "ArrowLeft to start (pos 0)");

  // Now go right: from 0, should land after 'a' at position 1
  tapKey(kb, "{fkey:ArrowRight}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 1, "ArrowRight from start: after a (pos 1)");

  // ArrowRight again: should skip entire 😀, landing at position 3
  tapKey(kb, "{fkey:ArrowRight}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 3, "ArrowRight skips whole emoji to pos 3");

  input.destroy();
  kb.destroy();
});

// ── Unit tests: isSingleGlyph ──────────────────────────────────

QUnit.module("isSingleGlyph");

QUnit.test("single ASCII character returns true", (assert) => {
  assert.strictEqual(isSingleGlyph("A"), true, "single ASCII letter is one glyph");
  assert.strictEqual(isSingleGlyph("z"), true, "single lowercase ASCII is one glyph");
  assert.strictEqual(isSingleGlyph("5"), true, "single digit is one glyph");
});

QUnit.test("multi-character string returns false", (assert) => {
  assert.strictEqual(isSingleGlyph("Tab"), false, "multi-char label 'Tab' is not one glyph");
  assert.strictEqual(isSingleGlyph("F1"), false, "multi-char label 'F1' is not one glyph");
  assert.strictEqual(isSingleGlyph("ab"), false, "two ASCII chars is not one glyph");
});

QUnit.test("empty string returns false", (assert) => {
  assert.strictEqual(isSingleGlyph(""), false, "empty string has no glyphs");
});

QUnit.test("surrogate pair emoji returns true", (assert) => {
  // 😀 = U+1F600 = 2 code units (surrogate pair) but one grapheme
  assert.strictEqual(isSingleGlyph("😀"), true, "surrogate-pair emoji is one glyph");
});

QUnit.test("flag emoji (regional indicator pair) returns true", (assert) => {
  // 🇩🇪 = U+1F1E9 + U+1F1EA = 4 code units but one grapheme cluster
  assert.strictEqual(isSingleGlyph("🇩🇪"), true, "flag emoji is one glyph");
});

QUnit.test("ZWJ sequence returns true", (assert) => {
  // 👨‍👩‍👧 = multiple code points joined by ZWJ, one grapheme cluster
  const family = "👨‍👩‍👧";
  assert.strictEqual(isSingleGlyph(family), true, "ZWJ family emoji is one glyph");
});

QUnit.test("two separate emoji returns false", (assert) => {
  assert.strictEqual(isSingleGlyph("😀😀"), false, "two emoji is not one glyph");
  assert.strictEqual(isSingleGlyph("🇩🇪🇫🇷"), false, "two flag emoji is not one glyph");
});

// ── Unit tests: isCJKGlyph ──────────────────────────────────────

QUnit.module("isCJKGlyph");

QUnit.test("hiragana returns true", (assert) => {
  assert.strictEqual(isCJKGlyph("\u3042"), true, "\u3042 (a) is hiragana");
  assert.strictEqual(isCJKGlyph("\u306C"), true, "\u306C (nu) is hiragana");
  assert.strictEqual(isCJKGlyph("\u3093"), true, "\u3093 (n) is hiragana");
});

QUnit.test("katakana returns true", (assert) => {
  assert.strictEqual(isCJKGlyph("\u30A2"), true, "\u30A2 (a) is katakana");
  assert.strictEqual(isCJKGlyph("\u30FC"), true, "\u30FC prolonged sound mark is katakana");
});

QUnit.test("CJK punctuation returns true", (assert) => {
  assert.strictEqual(isCJKGlyph("\u3001"), true, "\u3001 ideographic comma");
  assert.strictEqual(isCJKGlyph("\u3002"), true, "\u3002 ideographic full stop");
  assert.strictEqual(isCJKGlyph("\u30FB"), true, "\u30FB katakana middle dot");
  assert.strictEqual(isCJKGlyph("\u309B"), true, "\u309B dakuten");
  assert.strictEqual(isCJKGlyph("\u309C"), true, "\u309C handakuten");
});

QUnit.test("ideographic space returns false (Script=Common)", (assert) => {
  assert.strictEqual(isCJKGlyph("\u3000"), false, "\u3000 has no CJK Script_Extensions");
});

QUnit.test("CJK unified ideographs returns true", (assert) => {
  assert.strictEqual(isCJKGlyph("\u5B57"), true, "\u5B57 (ji/character) is CJK ideograph");
  assert.strictEqual(isCJKGlyph("\u4E00"), true, "\u4E00 (ichi/one) is CJK ideograph");
});

QUnit.test("halfwidth katakana returns true", (assert) => {
  assert.strictEqual(isCJKGlyph("\uFF66"), true, "\uFF66 halfwidth wo");
});

QUnit.test("Hangul syllables returns true", (assert) => {
  assert.strictEqual(isCJKGlyph("\uAC00"), true, "\uAC00 first Hangul syllable");
  assert.strictEqual(isCJKGlyph("\uD7A3"), true, "\uD7A3 last Hangul syllable");
});

QUnit.test("Hangul Jamo returns true", (assert) => {
  assert.strictEqual(isCJKGlyph("\u1100"), true, "\u1100 Jamo initial consonant");
  assert.strictEqual(isCJKGlyph("\u3131"), true, "\u3131 Hangul Compatibility Jamo");
});

QUnit.test("Bopomofo returns true", (assert) => {
  assert.strictEqual(isCJKGlyph("\u3105"), true, "\u3105 Bopomofo");
  assert.strictEqual(isCJKGlyph("\u31A0"), true, "\u31A0 Bopomofo Extended");
});

QUnit.test("Latin characters return false", (assert) => {
  assert.strictEqual(isCJKGlyph("A"), false, "uppercase Latin");
  assert.strictEqual(isCJKGlyph("z"), false, "lowercase Latin");
  assert.strictEqual(isCJKGlyph("@"), false, "at sign");
  assert.strictEqual(isCJKGlyph("1"), false, "digit");
});

QUnit.test("Arabic characters return false", (assert) => {
  assert.strictEqual(isCJKGlyph("\u0639"), false, "\u0639 Arabic ain");
});

QUnit.test("empty string returns false", (assert) => {
  assert.strictEqual(isCJKGlyph(""), false, "empty string");
});

QUnit.test("emoji returns false", (assert) => {
  assert.strictEqual(isCJKGlyph("\uD83D\uDE00"), false, "emoji is not CJK");
});

// ── Unit tests: isHangulGlyph ────────────────────────────────────

QUnit.module("isHangulGlyph");

QUnit.test("Hangul Compatibility Jamo consonants return true", (assert) => {
  assert.strictEqual(isHangulGlyph("\u3131"), true, "\u3131 kiyeok");
  assert.strictEqual(isHangulGlyph("\u3134"), true, "\u3134 nieun");
  assert.strictEqual(isHangulGlyph("\u3142"), true, "\u3142 pieup");
  assert.strictEqual(isHangulGlyph("\u314E"), true, "\u314E hieuh");
});

QUnit.test("Hangul Compatibility Jamo vowels return true", (assert) => {
  assert.strictEqual(isHangulGlyph("\u314F"), true, "\u314F a");
  assert.strictEqual(isHangulGlyph("\u3153"), true, "\u3153 eo");
  assert.strictEqual(isHangulGlyph("\u3163"), true, "\u3163 i");
});

QUnit.test("tense (ssang) consonants return true", (assert) => {
  assert.strictEqual(isHangulGlyph("\u3132"), true, "\u3132 ssangkiyeok");
  assert.strictEqual(isHangulGlyph("\u3143"), true, "\u3143 ssangpieup");
  assert.strictEqual(isHangulGlyph("\u3146"), true, "\u3146 ssangsios");
});

QUnit.test("Hangul syllables return true", (assert) => {
  assert.strictEqual(isHangulGlyph("\uAC00"), true, "\uAC00 first syllable");
  assert.strictEqual(isHangulGlyph("\uD7A3"), true, "\uD7A3 last syllable");
  assert.strictEqual(isHangulGlyph("\uD55C"), true, "\uD55C han");
});

QUnit.test("Hangul Jamo (conjoining) return true", (assert) => {
  assert.strictEqual(isHangulGlyph("\u1100"), true, "\u1100 initial consonant");
  assert.strictEqual(isHangulGlyph("\u1161"), true, "\u1161 medial vowel");
});

QUnit.test("Japanese hiragana/katakana return false", (assert) => {
  assert.strictEqual(isHangulGlyph("\u3042"), false, "\u3042 hiragana a");
  assert.strictEqual(isHangulGlyph("\u30A2"), false, "\u30A2 katakana a");
});

QUnit.test("CJK ideographs return false", (assert) => {
  assert.strictEqual(isHangulGlyph("\u4E00"), false, "\u4E00 CJK ideograph");
});

QUnit.test("Latin characters return false", (assert) => {
  assert.strictEqual(isHangulGlyph("A"), false, "uppercase Latin");
  assert.strictEqual(isHangulGlyph("1"), false, "digit");
});

QUnit.test("shared CJK punctuation returns false (Script=Common, not Hangul)", (assert) => {
  assert.strictEqual(isHangulGlyph("\u3001"), false, "\u3001 ideographic comma");
  assert.strictEqual(isHangulGlyph("\u3002"), false, "\u3002 ideographic full stop");
  assert.strictEqual(isHangulGlyph("\u30FB"), false, "\u30FB katakana middle dot");
});

QUnit.test("empty string returns false", (assert) => {
  assert.strictEqual(isHangulGlyph(""), false, "empty string");
});

// ── Unit tests: isIndicGlyph ─────────────────────────────────────

QUnit.module("isIndicGlyph");

QUnit.test("Devanagari characters return true", (assert) => {
  assert.strictEqual(isIndicGlyph("\u0905"), true, "\u0905 Devanagari a");
  assert.strictEqual(isIndicGlyph("\u0915"), true, "\u0915 Devanagari ka");
  assert.strictEqual(isIndicGlyph("\u0964"), true, "\u0964 danda (shared)");
  assert.strictEqual(isIndicGlyph("\u0965"), true, "\u0965 double danda");
});

QUnit.test("Bengali characters return true", (assert) => {
  assert.strictEqual(isIndicGlyph("\u0985"), true, "\u0985 Bengali a");
  assert.strictEqual(isIndicGlyph("\u0995"), true, "\u0995 Bengali ka");
});

QUnit.test("Tamil characters return true", (assert) => {
  assert.strictEqual(isIndicGlyph("\u0B85"), true, "\u0B85 Tamil a");
  assert.strictEqual(isIndicGlyph("\u0B95"), true, "\u0B95 Tamil ka");
});

QUnit.test("Telugu characters return true", (assert) => {
  assert.strictEqual(isIndicGlyph("\u0C05"), true, "\u0C05 Telugu a");
});

QUnit.test("Kannada characters return true", (assert) => {
  assert.strictEqual(isIndicGlyph("\u0C85"), true, "\u0C85 Kannada a");
});

QUnit.test("Malayalam characters return true", (assert) => {
  assert.strictEqual(isIndicGlyph("\u0D05"), true, "\u0D05 Malayalam a");
});

QUnit.test("Sinhala characters return true", (assert) => {
  assert.strictEqual(isIndicGlyph("\u0D85"), true, "\u0D85 Sinhala a");
});

QUnit.test("Gurmukhi characters return true", (assert) => {
  assert.strictEqual(isIndicGlyph("\u0A05"), true, "\u0A05 Gurmukhi a");
});

QUnit.test("Gujarati characters return true", (assert) => {
  assert.strictEqual(isIndicGlyph("\u0A85"), true, "\u0A85 Gujarati a");
});

QUnit.test("Oriya characters return true", (assert) => {
  assert.strictEqual(isIndicGlyph("\u0B05"), true, "\u0B05 Oriya a");
});

QUnit.test("Latin characters return false", (assert) => {
  assert.strictEqual(isIndicGlyph("A"), false, "uppercase Latin");
  assert.strictEqual(isIndicGlyph("1"), false, "digit");
});

QUnit.test("CJK characters return false", (assert) => {
  assert.strictEqual(isIndicGlyph("\u3042"), false, "\u3042 hiragana");
  assert.strictEqual(isIndicGlyph("\uAC00"), false, "\uAC00 Hangul syllable");
});

QUnit.test("Thai characters return false", (assert) => {
  assert.strictEqual(isIndicGlyph("\u0E01"), false, "\u0E01 Thai ko kai");
});

QUnit.test("empty string returns false", (assert) => {
  assert.strictEqual(isIndicGlyph(""), false, "empty string");
});

// -- Unit tests: isArabicGlyph -────────────────────────────────────

QUnit.module("isArabicGlyph");

QUnit.test("basic Arabic letters return true", (assert) => {
  assert.strictEqual(isArabicGlyph("\u0627"), true, "\u0627 alef");
  assert.strictEqual(isArabicGlyph("\u0628"), true, "\u0628 ba");
  assert.strictEqual(isArabicGlyph("\u062A"), true, "\u062A ta");
  assert.strictEqual(isArabicGlyph("\u0639"), true, "\u0639 ain");
  assert.strictEqual(isArabicGlyph("\u0641"), true, "\u0641 fa");
  assert.strictEqual(isArabicGlyph("\u0644"), true, "\u0644 lam");
  assert.strictEqual(isArabicGlyph("\u0645"), true, "\u0645 mim");
  assert.strictEqual(isArabicGlyph("\u0646"), true, "\u0646 nun");
  assert.strictEqual(isArabicGlyph("\u064A"), true, "\u064A ya");
});

QUnit.test("Arabic diacritical marks return true", (assert) => {
  assert.strictEqual(isArabicGlyph("\u064E"), true, "\u064E fatha");
  assert.strictEqual(isArabicGlyph("\u064F"), true, "\u064F damma");
  assert.strictEqual(isArabicGlyph("\u0650"), true, "\u0650 kasra");
  assert.strictEqual(isArabicGlyph("\u0651"), true, "\u0651 shadda");
  assert.strictEqual(isArabicGlyph("\u0652"), true, "\u0652 sukun");
});

QUnit.test("Arabic-Indic digits return true", (assert) => {
  assert.strictEqual(isArabicGlyph("\u0660"), true, "\u0660 zero");
  assert.strictEqual(isArabicGlyph("\u0669"), true, "\u0669 nine");
});

QUnit.test("Persian characters return true", (assert) => {
  assert.strictEqual(isArabicGlyph("\u067E"), true, "\u067E pe");
  assert.strictEqual(isArabicGlyph("\u0686"), true, "\u0686 che");
  assert.strictEqual(isArabicGlyph("\u0698"), true, "\u0698 zhe");
  assert.strictEqual(isArabicGlyph("\u06AF"), true, "\u06AF gaf");
});

QUnit.test("Urdu characters return true", (assert) => {
  assert.strictEqual(isArabicGlyph("\u0679"), true, "\u0679 tte");
  assert.strictEqual(isArabicGlyph("\u0688"), true, "\u0688 ddal");
  assert.strictEqual(isArabicGlyph("\u0691"), true, "\u0691 rreh");
  assert.strictEqual(isArabicGlyph("\u06BA"), true, "\u06BA noon ghunna");
  assert.strictEqual(isArabicGlyph("\u06D2"), true, "\u06D2 yeh barree");
});

QUnit.test("Arabic Presentation Forms return true", (assert) => {
  assert.strictEqual(isArabicGlyph("\uFB50"), true, "\uFB50 alef wasla isolated");
  assert.strictEqual(isArabicGlyph("\uFE70"), true, "\uFE70 fathatan isolated");
  assert.strictEqual(isArabicGlyph("\uFEFC"), true, "\uFEFC lam alef final");
});

QUnit.test("Latin characters return false", (assert) => {
  assert.strictEqual(isArabicGlyph("A"), false, "uppercase Latin");
  assert.strictEqual(isArabicGlyph("z"), false, "lowercase Latin");
  assert.strictEqual(isArabicGlyph("1"), false, "digit");
});

QUnit.test("CJK characters return false", (assert) => {
  assert.strictEqual(isArabicGlyph("\u3042"), false, "\u3042 hiragana");
  assert.strictEqual(isArabicGlyph("\uAC00"), false, "\uAC00 Hangul syllable");
});

QUnit.test("Indic characters return false", (assert) => {
  assert.strictEqual(isArabicGlyph("\u0905"), false, "\u0905 Devanagari a");
  assert.strictEqual(isArabicGlyph("\u0B85"), false, "\u0B85 Tamil a");
});

QUnit.test("Hebrew characters return false", (assert) => {
  assert.strictEqual(isArabicGlyph("\u05D0"), false, "\u05D0 aleph");
  assert.strictEqual(isArabicGlyph("\u05EA"), false, "\u05EA tav");
});

QUnit.test("empty string returns false", (assert) => {
  assert.strictEqual(isArabicGlyph(""), false, "empty string");
});

QUnit.test("emoji returns false", (assert) => {
  assert.strictEqual(isArabicGlyph("\uD83D\uDE00"), false, "emoji is not Arabic");
});
