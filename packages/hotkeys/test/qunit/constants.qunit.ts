import { normalizeKeyName } from "ui5/hotkeys/constants";

QUnit.module("constants - normalizeKeyName");

QUnit.test("Single letter is uppercased", (assert) => {
  assert.strictEqual(normalizeKeyName("a"), "A");
  assert.strictEqual(normalizeKeyName("z"), "Z");
  assert.strictEqual(normalizeKeyName("A"), "A");
});

QUnit.test("Known aliases are resolved", (assert) => {
  assert.strictEqual(normalizeKeyName("Esc"), "Escape");
  assert.strictEqual(normalizeKeyName("esc"), "Escape");
  assert.strictEqual(normalizeKeyName("Return"), "Enter");
  assert.strictEqual(normalizeKeyName("enter"), "Enter");
  assert.strictEqual(normalizeKeyName(" "), "Space");
  assert.strictEqual(normalizeKeyName("space"), "Space");
  assert.strictEqual(normalizeKeyName("Del"), "Delete");
  assert.strictEqual(normalizeKeyName("Up"), "ArrowUp");
  assert.strictEqual(normalizeKeyName("Down"), "ArrowDown");
  assert.strictEqual(normalizeKeyName("Left"), "ArrowLeft");
  assert.strictEqual(normalizeKeyName("Right"), "ArrowRight");
  assert.strictEqual(normalizeKeyName("PgUp"), "PageUp");
  assert.strictEqual(normalizeKeyName("PgDn"), "PageDown");
});

QUnit.test("Function keys are normalized", (assert) => {
  assert.strictEqual(normalizeKeyName("f5"), "F5");
  assert.strictEqual(normalizeKeyName("F5"), "F5");
  assert.strictEqual(normalizeKeyName("f12"), "F12");
  assert.strictEqual(normalizeKeyName("F1"), "F1");
});

QUnit.test("Function key boundary validation (F1-F24 only)", (assert) => {
  assert.strictEqual(normalizeKeyName("F1"), "F1", "F1 normalizes");
  assert.strictEqual(normalizeKeyName("f1"), "F1", "f1 normalizes");
  assert.strictEqual(normalizeKeyName("F24"), "F24", "F24 normalizes");
  assert.strictEqual(normalizeKeyName("f24"), "F24", "f24 normalizes");
  assert.strictEqual(normalizeKeyName("F0"), "F0", "F0 passes through unchanged");
  assert.strictEqual(normalizeKeyName("f0"), "f0", "f0 passes through unchanged");
  assert.strictEqual(normalizeKeyName("F25"), "F25", "F25 passes through unchanged");
  assert.strictEqual(normalizeKeyName("F99"), "F99", "F99 passes through unchanged");
});

QUnit.test("Unknown keys are returned as-is", (assert) => {
  assert.strictEqual(normalizeKeyName("Escape"), "Escape");
  assert.strictEqual(normalizeKeyName("Enter"), "Enter");
  assert.strictEqual(normalizeKeyName("Tab"), "Tab");
});

QUnit.test("Special characters are returned as-is", (assert) => {
  assert.strictEqual(normalizeKeyName("+"), "+");
  assert.strictEqual(normalizeKeyName("-"), "-");
  assert.strictEqual(normalizeKeyName("/"), "/");
});
