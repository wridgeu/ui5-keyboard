import { getMiddlewareForLayout, deactivateMiddleware } from "ui5/kiosk/internal/middleware-registry";
import "ui5/kiosk/middleware/kana-dakuten";

// --- Helpers ---

const sandbox = sinon.createSandbox();

function commonAfterEach() {
  sandbox.restore();
  deactivateMiddleware("ja-kana");
}

// --- kana-dakuten middleware ---

QUnit.module("kana-dakuten middleware", { afterEach: commonAfterEach });

QUnit.test("Registers itself for ja-kana layout", (assert) => {
  const mw = getMiddlewareForLayout("ja-kana");
  assert.notStrictEqual(mw, null, "Middleware registered for ja-kana");
});

QUnit.test("Passes through regular kana (not dakuten/handakuten)", (assert) => {
  const mw = getMiddlewareForLayout("ja-kana")!;
  const input = document.createElement("input");
  input.value = "";
  input.setSelectionRange(0, 0);
  const consumed = mw.handleKey("\u304B", input); // か
  assert.strictEqual(consumed, false, "Regular kana is not consumed");
});

QUnit.test("Composes ka + dakuten into ga", (assert) => {
  const mw = getMiddlewareForLayout("ja-kana")!;
  const input = document.createElement("input");
  input.value = "\u304B"; // か
  input.setSelectionRange(1, 1);
  const consumed = mw.handleKey("\u309B", input); // ゛
  assert.strictEqual(consumed, true, "Dakuten consumed");
  assert.strictEqual(input.value, "\u304C", "か + ゛ = が");
});

QUnit.test("Composes ha + handakuten into pa", (assert) => {
  const mw = getMiddlewareForLayout("ja-kana")!;
  const input = document.createElement("input");
  input.value = "\u306F"; // は
  input.setSelectionRange(1, 1);
  const consumed = mw.handleKey("\u309C", input); // ゜
  assert.strictEqual(consumed, true, "Handakuten consumed");
  assert.strictEqual(input.value, "\u3071", "は + ゜ = ぱ");
});

QUnit.test("Composes ha + dakuten into ba", (assert) => {
  const mw = getMiddlewareForLayout("ja-kana")!;
  const input = document.createElement("input");
  input.value = "\u306F"; // は
  input.setSelectionRange(1, 1);
  mw.handleKey("\u309B", input); // ゛
  assert.strictEqual(input.value, "\u3070", "は + ゛ = ば");
});

QUnit.test("Does not compose when preceding char has no dakuten form", (assert) => {
  const mw = getMiddlewareForLayout("ja-kana")!;
  const input = document.createElement("input");
  input.value = "\u3042"; // あ
  input.setSelectionRange(1, 1);
  const consumed = mw.handleKey("\u309B", input); // ゛
  assert.strictEqual(consumed, false, "Dakuten not consumed for あ");
});

QUnit.test("Does not compose when input is empty", (assert) => {
  const mw = getMiddlewareForLayout("ja-kana")!;
  const input = document.createElement("input");
  input.value = "";
  input.setSelectionRange(0, 0);
  const consumed = mw.handleKey("\u309B", input); // ゛
  assert.strictEqual(consumed, false, "Dakuten not consumed on empty input");
});

QUnit.test("Passes through backspace", (assert) => {
  const mw = getMiddlewareForLayout("ja-kana")!;
  const input = document.createElement("input");
  const consumed = mw.handleKey("{backspace}", input);
  assert.strictEqual(consumed, false, "Backspace not consumed");
});

QUnit.test("Passes through enter", (assert) => {
  const mw = getMiddlewareForLayout("ja-kana")!;
  const input = document.createElement("input");
  const consumed = mw.handleKey("{enter}", input);
  assert.strictEqual(consumed, false, "Enter not consumed");
});

QUnit.test("commit and reset are no-ops", (assert) => {
  const mw = getMiddlewareForLayout("ja-kana")!;
  assert.strictEqual(mw.commit(), null, "commit returns null");
  mw.reset(); // should not throw
  assert.ok(true, "reset completes without error");
});
