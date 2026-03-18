import { graphemeLengthAfter, graphemeLengthBefore, isSingleGlyph } from "ui5/kiosk/internal/grapheme";
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
