import CustomLayout from "ui5/kiosk/CustomLayout";
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

QUnit.test("a multi-unit cluster is one grapheme", (assert) => {
  const clusters: [string, string][] = [
    ["😀", "surrogate pair"],
    ["❤️", "variation selector sequence"],
    ["👨‍👩‍👧", "ZWJ sequence"],
    ["n\u0303", "combining mark"],
    ["🇩🇪", "regional indicator pair"],
  ];
  for (const [cluster, name] of clusters) {
    const s = `a${cluster}b`;
    assert.strictEqual(
      graphemeLengthBefore(s, 1 + cluster.length),
      cluster.length,
      `${name} is one grapheme of ${cluster.length} code units`,
    );
  }
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

QUnit.test("a multi-unit cluster is one grapheme", (assert) => {
  const clusters: [string, string][] = [
    ["😀", "surrogate pair"],
    ["❤️", "variation selector sequence"],
    ["👨‍👩‍👧", "ZWJ sequence"],
    ["n\u0303", "combining mark"],
    ["🇩🇪", "regional indicator pair"],
  ];
  for (const [cluster, name] of clusters) {
    const s = `a${cluster}b`;
    assert.strictEqual(
      graphemeLengthAfter(s, 1),
      cluster.length,
      `${name} at offset 1 is one grapheme of ${cluster.length} code units`,
    );
  }
});

// ── Integration tests through KioskKeyboard ───────────────────

QUnit.module("Grapheme integration", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Backspace deletes an entire multi-unit emoji in one press", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const family = "👨‍👩‍👧";
  const emojiLayout: LayoutDefinition = [[{ value: "😀" }, { value: family }, { value: "{backspace}" }]];
  const kb = new KioskKeyboard({
    layout: "test-emoji-bs",
    controls: [input.getId()],
    customLayouts: [new CustomLayout({ name: "test-emoji-bs", rows: emojiLayout })],
  });
  await placeAndWait(kb);

  input.focus();
  await waitForRender();

  tapKey(kb, "😀");
  await waitForRender();
  assert.strictEqual(input.getValue(), "😀", "Surrogate-pair emoji inserted");

  tapKey(kb, "{backspace}");
  await waitForRender();
  assert.strictEqual(input.getValue(), "", "Surrogate-pair emoji fully deleted in one backspace");

  tapKey(kb, family);
  await waitForRender();
  assert.strictEqual(input.getValue(), family, "ZWJ emoji inserted");

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
  const kb = new KioskKeyboard({
    layout: "test-mixed-bs",
    controls: [input.getId()],
    customLayouts: [new CustomLayout({ name: "test-mixed-bs", rows: layout })],
  });
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
  const kb = new KioskKeyboard({
    layout: "test-emoji-nav",
    controls: [input.getId()],
    customLayouts: [new CustomLayout({ name: "test-emoji-nav", rows: layout })],
  });
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

QUnit.test("Hangul syllables returns true", (assert) => {
  assert.strictEqual(isCJKGlyph("\uAC00"), true, "\uAC00 first Hangul syllable");
  assert.strictEqual(isCJKGlyph("\uD7A3"), true, "\uD7A3 last Hangul syllable");
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

QUnit.test("empty string returns false", (assert) => {
  assert.strictEqual(isCJKGlyph(""), false, "empty string");
});

QUnit.test("emoji returns false", (assert) => {
  assert.strictEqual(isCJKGlyph("\uD83D\uDE00"), false, "emoji is not CJK");
});

// ── Unit tests: isHangulGlyph ────────────────────────────────────

QUnit.module("isHangulGlyph");

QUnit.test("Hangul code points return true", (assert) => {
  const rows: [string, string][] = [
    ["\u3131", "Compatibility Jamo consonant kiyeok"],
    ["\u314F", "Compatibility Jamo vowel a"],
    ["\u3132", "tense consonant ssangkiyeok"],
    ["\uAC00", "first syllable"],
    ["\uD7A3", "last syllable"],
    ["\u1100", "conjoining Jamo initial consonant"],
    ["\u1161", "conjoining Jamo medial vowel"],
  ];
  for (const [codePoint, name] of rows) {
    assert.strictEqual(isHangulGlyph(codePoint), true, name);
  }
});

QUnit.test("non-Hangul code points return false, including shared CJK punctuation (Script=Common)", (assert) => {
  assert.strictEqual(isHangulGlyph("\u3042"), false, "\u3042 hiragana a");
  assert.strictEqual(isHangulGlyph("\u30A2"), false, "\u30A2 katakana a");
  assert.strictEqual(isHangulGlyph("\u4E00"), false, "\u4E00 CJK ideograph");
  assert.strictEqual(isHangulGlyph("A"), false, "uppercase Latin");
  assert.strictEqual(isHangulGlyph("1"), false, "digit");
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

QUnit.test("each Indic script's range returns true", (assert) => {
  // One row per script range (with both 'a' and 'ka' where originally tested),
  // so dropping an alternation member fails an identifiable script row.
  const rows: [string, string][] = [
    ["\u0985", "Bengali a"],
    ["\u0995", "Bengali ka"],
    ["\u0B85", "Tamil a"],
    ["\u0B95", "Tamil ka"],
    ["\u0C05", "Telugu a"],
    ["\u0C85", "Kannada a"],
    ["\u0D05", "Malayalam a"],
    ["\u0D85", "Sinhala a"],
    ["\u0A05", "Gurmukhi a"],
    ["\u0A85", "Gujarati a"],
    ["\u0B05", "Oriya a"],
  ];

  rows.forEach(([codePoint, scriptName]) => {
    assert.strictEqual(isIndicGlyph(codePoint), true, scriptName);
  });
});

QUnit.test("other scripts return false (Latin, CJK, Thai)", (assert) => {
  assert.strictEqual(isIndicGlyph("A"), false, "uppercase Latin");
  assert.strictEqual(isIndicGlyph("1"), false, "digit");
  assert.strictEqual(isIndicGlyph("\u3042"), false, "\u3042 hiragana");
  assert.strictEqual(isIndicGlyph("\uAC00"), false, "\uAC00 Hangul syllable");
  assert.strictEqual(isIndicGlyph("\u0E01"), false, "\u0E01 Thai ko kai");
});

QUnit.test("empty string returns false", (assert) => {
  assert.strictEqual(isIndicGlyph(""), false, "empty string");
});

// ── Unit tests: isArabicGlyph ──────────────────────────────────────

QUnit.module("isArabicGlyph");

QUnit.test("Arabic code points return true, basic letters and Presentation Forms alike", (assert) => {
  const rows: [string, string][] = [
    ["\u0627", "alef"],
    ["\u0628", "ba"],
    ["\u0639", "ain"],
    ["\u064A", "ya"],
    ["\uFB50", "alef wasla isolated (Presentation Forms-A)"],
    ["\uFE70", "fathatan isolated (Presentation Forms-B)"],
    ["\uFEFC", "lam alef final (Presentation Forms-B)"],
  ];
  for (const [codePoint, name] of rows) {
    assert.strictEqual(isArabicGlyph(codePoint), true, name);
  }
});

QUnit.test("other scripts return false, Hebrew included, and so does the empty string", (assert) => {
  assert.strictEqual(isArabicGlyph("\u05D0"), false, "\u05D0 Hebrew aleph");
  assert.strictEqual(isArabicGlyph("\u05EA"), false, "\u05EA Hebrew tav");
  assert.strictEqual(isArabicGlyph(""), false, "empty string");
});

QUnit.test("checks only the first code point for multi-character strings", (assert) => {
  assert.strictEqual(isArabicGlyph("\u0627b"), true, "Arabic + Latin");
  assert.strictEqual(isArabicGlyph("A\u0627"), false, "Latin + Arabic");
});
