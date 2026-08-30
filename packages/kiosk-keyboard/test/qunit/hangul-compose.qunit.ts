import { getMiddlewareFactory } from "ui5/kiosk/internal/middleware-registry";

const sandbox = sinon.createSandbox();
let input: HTMLInputElement;

function mw() {
  return getMiddlewareFactory("ko-hangul")!();
}

function commonAfterEach() {
  sandbox.restore();
}

QUnit.module("hangul-compose middleware", {
  beforeEach() {
    input = document.createElement("input");
    input.value = "";
    input.setSelectionRange(0, 0);
  },
  afterEach: commonAfterEach,
});

QUnit.test("Single L consonant shows as preedit", (assert) => {
  const m = mw();
  const consumed = m.handleKey("\u3131", input); // ㄱ
  assert.strictEqual(consumed, true, "Key consumed");
  // Preedit should show the leading jamo U+1100
  assert.strictEqual(input.value, "\u1100", "Preedit shows leading jamo");
});

QUnit.test("L + V composes to syllable in preedit", (assert) => {
  const m = mw();
  m.handleKey("\u3131", input); // ㄱ
  m.handleKey("\u314F", input); // ㅏ
  // ㄱ(L=0) + ㅏ(V=0) = 가 (U+AC00)
  assert.strictEqual(input.value, "\uAC00", "L + V composes to syllable");
});

QUnit.test("L + V + T composes to full syllable in preedit", (assert) => {
  const m = mw();
  m.handleKey("\u3131", input); // ㄱ
  m.handleKey("\u314F", input); // ㅏ
  m.handleKey("\u3134", input); // ㄴ
  // ㄱ(L=0) + ㅏ(V=0) + ㄴ(T=4) = 간 (U+AC04)
  assert.strictEqual(input.value, "\uAC04", "L + V + T composes to full syllable");
});

QUnit.test("LVT + V steals trailing consonant", (assert) => {
  const m = mw();
  m.handleKey("\u3131", input); // ㄱ
  m.handleKey("\u314F", input); // ㅏ
  m.handleKey("\u3134", input); // ㄴ -> 간
  m.handleKey("\u314F", input); // ㅏ -> commits 가, preedit 나

  // 가 = U+AC00, 나 = U+B098
  assert.strictEqual(input.value, "\uAC00\uB098", "Trailing consonant stolen for new syllable");
});

QUnit.test("LVT + L commits current and starts new", (assert) => {
  const m = mw();
  m.handleKey("\u3131", input); // ㄱ
  m.handleKey("\u314F", input); // ㅏ
  m.handleKey("\u3134", input); // ㄴ -> 간
  m.handleKey("\u3141", input); // ㅁ (new L)

  // 간 committed, ㅁ as preedit (U+1106)
  assert.strictEqual(input.value, "\uAC04\u1106", "LVT committed, new L in preedit");
});

QUnit.test("Backspace decomposes LVT to LV", (assert) => {
  const m = mw();
  m.handleKey("\u3131", input); // ㄱ
  m.handleKey("\u314F", input); // ㅏ
  m.handleKey("\u3134", input); // ㄴ -> 간
  m.handleKey("{backspace}", input);
  // Should decompose to 가
  assert.strictEqual(input.value, "\uAC00", "Backspace removes trailing consonant");
});

QUnit.test("Backspace decomposes LV to L", (assert) => {
  const m = mw();
  m.handleKey("\u3131", input); // ㄱ
  m.handleKey("\u314F", input); // ㅏ -> 가
  m.handleKey("{backspace}", input);
  // Should decompose to ㄱ (U+1100)
  assert.strictEqual(input.value, "\u1100", "Backspace removes vowel, leaves L");
});

QUnit.test("Backspace decomposes L to empty", (assert) => {
  const m = mw();
  m.handleKey("\u3131", input); // ㄱ
  m.handleKey("{backspace}", input);
  assert.strictEqual(input.value, "", "Backspace removes leading consonant");
});

QUnit.test("Backspace passes through when not composing", (assert) => {
  const m = mw();
  const consumed = m.handleKey("{backspace}", input);
  assert.strictEqual(consumed, false, "Backspace not consumed when not composing");
});

QUnit.test("Non-jamo characters pass through and commit preedit", (assert) => {
  const m = mw();
  m.handleKey("\u3131", input); // ㄱ -> preedit
  const consumed = m.handleKey("a", input);
  assert.strictEqual(consumed, false, "Non-jamo character not consumed");
  // ㄱ (U+1100) should be committed
  assert.strictEqual(input.value, "\u1100", "Preedit committed before pass-through");
});

QUnit.test("commit flushes preedit to target", (assert) => {
  const m = mw();
  m.handleKey("\u3131", input); // ㄱ
  m.handleKey("\u314F", input); // ㅏ -> 가
  const text = m.commit();
  assert.strictEqual(text, "\uAC00", "commit returns the composed syllable");
  assert.strictEqual(input.value, "\uAC00", "Value preserved after commit");
});

QUnit.test("commit reports the composed syllable as compositionend data", (assert) => {
  const m = mw();
  const seen: string[] = [];
  input.addEventListener("compositionend", (e) => seen.push((e as CompositionEvent).data ?? ""));
  m.handleKey("\u3131", input); // ㄱ
  m.handleKey("\u314F", input); // ㅏ -> 가
  m.commit();
  assert.deepEqual(seen, ["\uAC00"], "compositionend fires once, carrying the committed syllable");
});

QUnit.test("reset clears state without committing content", (assert) => {
  const m = mw();
  m.handleKey("\u3131", input); // ㄱ
  m.handleKey("\u314F", input); // ㅏ -> 가
  m.reset();
  // Preedit should be cleared
  assert.strictEqual(input.value, "", "Preedit cleared on reset");
});

QUnit.test("Multi-syllable composition", (assert) => {
  const m = mw();
  // 한 = ㅎ + ㅏ + ㄴ
  m.handleKey("\u314E", input); // ㅎ
  m.handleKey("\u314F", input); // ㅏ
  m.handleKey("\u3134", input); // ㄴ -> 한

  // 글 = ㄱ + ㅡ + ㄹ (ㄱ as new L commits 한)
  m.handleKey("\u3131", input); // ㄱ -> commits 한
  m.handleKey("\u3161", input); // ㅡ
  m.handleKey("\u3139", input); // ㄹ -> 글

  // 한 = U+D55C, 글 = U+AE00
  assert.strictEqual(input.value, "\uD55C\uAE00", "Multi-syllable composes correctly");
});

QUnit.test("Bare vowel inserts directly without composition", (assert) => {
  const m = mw();
  const consumed = m.handleKey("\u314F", input); // ㅏ
  assert.strictEqual(consumed, true, "Vowel key consumed");
  assert.strictEqual(input.value, "\u314F", "Bare vowel inserted as-is");
});

QUnit.test("Read-only target declines the key and leaves the value untouched", (assert) => {
  const m = mw();
  input.value = "ab";
  input.setSelectionRange(2, 2);
  input.readOnly = true;
  const consumed = m.handleKey("\u314E", input); // ㅎ
  assert.strictEqual(consumed, false, "Key declined on a read-only target");
  assert.strictEqual(input.value, "ab", "No preedit written");
});

QUnit.test("Disabled target declines the key and leaves the value untouched", (assert) => {
  const m = mw();
  input.value = "ab";
  input.setSelectionRange(2, 2);
  input.disabled = true;
  const consumed = m.handleKey("\u314E", input); // ㅎ
  assert.strictEqual(consumed, false, "Key declined on a disabled target");
  assert.strictEqual(input.value, "ab", "No preedit written");
});

QUnit.test("Jamo that would open a preedit past maxlength is refused", (assert) => {
  const m = mw();
  input.maxLength = 1;
  // 간 fills the field; the following ㅏ would steal the ㄴ into a second syllable.
  for (const key of ["ㄱ", "ㅏ", "ㄴ"]) m.handleKey(key, input);
  assert.strictEqual(input.value, "간", "Precondition: 간 is a live preedit");

  assert.strictEqual(m.handleKey("ㅏ", input), true, "The refused key is swallowed, not passed on");
  assert.strictEqual(input.value, "간", "Preedit never exceeds maxlength");
});

QUnit.test("Composition continues while the field still has room", (assert) => {
  const m = mw();
  input.maxLength = 2;
  for (const key of ["ㄱ", "ㅏ", "ㄴ", "ㅏ"]) m.handleKey(key, input);
  assert.strictEqual(input.value, "가나", "Both syllables fit and compose");
});

QUnit.test("Text a new composition replaces counts as room", (assert) => {
  const m = mw();
  input.value = "AB";
  input.setSelectionRange(0, 2);
  input.maxLength = 2;
  m.handleKey("ㄱ", input);
  assert.strictEqual(input.value, "ᄀ", "The replaced selection frees the room the preedit needs");
});

QUnit.test("Composition replaces the selected text instead of composing beside it", (assert) => {
  const m = mw();
  input.value = "ABCD";
  input.setSelectionRange(1, 3);
  m.handleKey("ㄱ", input);
  m.handleKey("ㅏ", input);
  assert.strictEqual(input.value, "A가D", "The selection is replaced, as a typed character would");
});

QUnit.test("Backspace declined on a target that turned read-only mid-composition", (assert) => {
  const m = mw();
  input.value = "ab";
  input.setSelectionRange(2, 2);
  m.handleKey("\u314E", input); // ㅎ
  m.handleKey("\u314F", input); // ㅏ -> 하
  assert.strictEqual(input.value, "ab\uD558", "Precondition: 하 is a live preedit");

  input.readOnly = true;
  assert.strictEqual(m.handleKey("{backspace}", input), false, "Backspace declined");
  assert.strictEqual(input.value, "ab\uD558", "Preedit left intact");
});
