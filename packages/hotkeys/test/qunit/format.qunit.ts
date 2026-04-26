import { formatForDisplay } from "ui5/hotkeys/format";
import { Platform } from "ui5/hotkeys/library";

QUnit.module("format - formatForDisplay");

QUnit.test("Mac: Mod+S displays as ⌘S", (assert) => {
  assert.strictEqual(formatForDisplay("Mod+S", Platform.Mac), "⌘S");
});

QUnit.test("Mac: Mod+Shift+S displays as ⇧⌘S", (assert) => {
  assert.strictEqual(formatForDisplay("Mod+Shift+S", Platform.Mac), "⇧⌘S");
});

QUnit.test("Mac: Ctrl+Alt+K displays as ⌃⌥K", (assert) => {
  assert.strictEqual(formatForDisplay("Ctrl+Alt+K", Platform.Mac), "⌃⌥K");
});

QUnit.test("Windows: Mod+S displays as Ctrl+S", (assert) => {
  assert.strictEqual(formatForDisplay("Mod+S", Platform.Windows), "Ctrl+S");
});

QUnit.test("Windows: Mod+Shift+S displays as Ctrl+Shift+S", (assert) => {
  assert.strictEqual(formatForDisplay("Mod+Shift+S", Platform.Windows), "Ctrl+Shift+S");
});

QUnit.test("Linux: Mod+S displays as Ctrl+S", (assert) => {
  assert.strictEqual(formatForDisplay("Mod+S", Platform.Linux), "Ctrl+S");
});

QUnit.test("Escape key displays as Esc", (assert) => {
  assert.strictEqual(formatForDisplay("Escape", Platform.Windows), "Esc");
  assert.strictEqual(formatForDisplay("Escape", Platform.Mac), "Esc");
});

QUnit.test("Arrow keys display as symbols", (assert) => {
  assert.strictEqual(formatForDisplay("Ctrl+ArrowUp", Platform.Windows), "Ctrl+↑");
});

QUnit.test("Standalone function key", (assert) => {
  assert.strictEqual(formatForDisplay("F5", Platform.Windows), "F5");
  assert.strictEqual(formatForDisplay("F5", Platform.Mac), "F5");
});

QUnit.test("Enter key displays as symbol", (assert) => {
  assert.strictEqual(formatForDisplay("Mod+Enter", Platform.Mac), "⌘↵");
  assert.strictEqual(formatForDisplay("Mod+Enter", Platform.Windows), "Ctrl+↵");
});
