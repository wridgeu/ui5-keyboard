import { getMiddlewareFactory } from "ui5/kiosk/internal/middleware-registry";

const sandbox = sinon.createSandbox();
let input: HTMLInputElement;

function mw() {
  return getMiddlewareFactory("ja-kana")!();
}

function commonAfterEach() {
  sandbox.restore();
}

// kana-dakuten middleware

QUnit.module("kana-dakuten middleware", {
  beforeEach() {
    input = document.createElement("input");
    input.value = "";
    input.setSelectionRange(0, 0);
  },
  afterEach: commonAfterEach,
});

QUnit.test("Built-in factory registered for ja-kana layout", (assert) => {
  assert.notStrictEqual(getMiddlewareFactory("ja-kana"), null, "Factory registered for ja-kana");
});

QUnit.test("Passes through regular kana (not dakuten/handakuten)", (assert) => {
  const consumed = mw().handleKey("か", input); // か
  assert.strictEqual(consumed, false, "Regular kana is not consumed");
});

QUnit.test("Composes ka + dakuten into ga", (assert) => {
  input.value = "か"; // か
  input.setSelectionRange(1, 1);
  const consumed = mw().handleKey("゛", input); // ゛
  assert.strictEqual(consumed, true, "Dakuten consumed");
  assert.strictEqual(input.value, "が", "か + ゛ = が");
});

QUnit.test("Composes ha + handakuten into pa", (assert) => {
  input.value = "は"; // は
  input.setSelectionRange(1, 1);
  const consumed = mw().handleKey("゜", input); // ゜
  assert.strictEqual(consumed, true, "Handakuten consumed");
  assert.strictEqual(input.value, "ぱ", "は + ゜ = ぱ");
});

QUnit.test("Composes ha + dakuten into ba", (assert) => {
  input.value = "は"; // は
  input.setSelectionRange(1, 1);
  mw().handleKey("゛", input); // ゛
  assert.strictEqual(input.value, "ば", "は + ゛ = ば");
});

QUnit.test("Does not compose when preceding char has no dakuten form", (assert) => {
  input.value = "あ"; // あ
  input.setSelectionRange(1, 1);
  const consumed = mw().handleKey("゛", input); // ゛
  assert.strictEqual(consumed, false, "Dakuten not consumed for あ");
});

QUnit.test("Does not compose when input is empty", (assert) => {
  const consumed = mw().handleKey("゛", input); // ゛
  assert.strictEqual(consumed, false, "Dakuten not consumed on empty input");
});

QUnit.test("Passes through control tokens (early return)", (assert) => {
  const m = mw();
  for (const token of ["{backspace}", "{enter}", "{shift}", "{tab}"]) {
    assert.strictEqual(m.handleKey(token, input), false, `${token} not consumed`);
  }
});

QUnit.test("commit and reset are no-ops", (assert) => {
  const m = mw();
  assert.strictEqual(m.commit(), null, "commit returns null");
  m.reset(); // should not throw
  assert.ok(true, "reset completes without error");
});
