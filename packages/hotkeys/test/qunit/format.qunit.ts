import { formatForDisplay } from "ui5/hotkeys/format";

QUnit.module("format - formatForDisplay");

QUnit.test("Mac: Mod+S displays as ⌘S", (assert) => {
  assert.strictEqual(formatForDisplay("Mod+S", "mac"), "\u2318S");
});

QUnit.test("Mac: Mod+Shift+S displays as ⇧⌘S", (assert) => {
  assert.strictEqual(formatForDisplay("Mod+Shift+S", "mac"), "\u21E7\u2318S");
});

QUnit.test("Mac: Ctrl+Alt+K displays as ⌃⌥K", (assert) => {
  assert.strictEqual(formatForDisplay("Ctrl+Alt+K", "mac"), "\u2303\u2325K");
});

QUnit.test("Windows: Mod+S displays as Ctrl+S", (assert) => {
  assert.strictEqual(formatForDisplay("Mod+S", "windows"), "Ctrl+S");
});

QUnit.test("Windows: Mod+Shift+S displays as Ctrl+Shift+S", (assert) => {
  assert.strictEqual(formatForDisplay("Mod+Shift+S", "windows"), "Ctrl+Shift+S");
});

QUnit.test("Linux: Mod+S displays as Ctrl+S", (assert) => {
  assert.strictEqual(formatForDisplay("Mod+S", "linux"), "Ctrl+S");
});

QUnit.test("Escape key displays as Esc", (assert) => {
  assert.strictEqual(formatForDisplay("Escape", "windows"), "Esc");
  assert.strictEqual(formatForDisplay("Escape", "mac"), "Esc");
});

QUnit.test("Arrow keys display as symbols", (assert) => {
  assert.strictEqual(formatForDisplay("Ctrl+ArrowUp", "windows"), "Ctrl+\u2191");
});

QUnit.test("Standalone function key", (assert) => {
  assert.strictEqual(formatForDisplay("F5", "windows"), "F5");
  assert.strictEqual(formatForDisplay("F5", "mac"), "F5");
});

QUnit.test("Enter key displays as symbol", (assert) => {
  assert.strictEqual(formatForDisplay("Mod+Enter", "mac"), "\u2318\u21B5");
  assert.strictEqual(formatForDisplay("Mod+Enter", "windows"), "Ctrl+\u21B5");
});
