import { normalizeHotkey, parseHotkey, keyboardEventToHotkey, convertToModFormat } from "ui5/hotkeys/parse";
import { Platform } from "ui5/hotkeys/library";

QUnit.module("parse - parseHotkey");

QUnit.test("Simple key", (assert) => {
  const parsed = parseHotkey("Escape", Platform.Windows);
  assert.strictEqual(parsed.key, "Escape");
  assert.strictEqual(parsed.ctrl, false);
  assert.strictEqual(parsed.shift, false);
  assert.strictEqual(parsed.alt, false);
  assert.strictEqual(parsed.meta, false);
  assert.deepEqual(parsed.modifiers, []);
});

QUnit.test("Single modifier + key", (assert) => {
  const parsed = parseHotkey("Ctrl+S", Platform.Windows);
  assert.strictEqual(parsed.key, "S");
  assert.strictEqual(parsed.ctrl, true);
  assert.strictEqual(parsed.shift, false);
  assert.deepEqual(parsed.modifiers, ["Control"]);
});

QUnit.test("Mod resolves to Meta on Mac", (assert) => {
  const parsed = parseHotkey("Mod+S", Platform.Mac);
  assert.strictEqual(parsed.key, "S");
  assert.strictEqual(parsed.meta, true);
  assert.strictEqual(parsed.ctrl, false);
  assert.deepEqual(parsed.modifiers, ["Meta"]);
});

QUnit.test("Mod resolves to Control on Windows", (assert) => {
  const parsed = parseHotkey("Mod+S", Platform.Windows);
  assert.strictEqual(parsed.key, "S");
  assert.strictEqual(parsed.ctrl, true);
  assert.strictEqual(parsed.meta, false);
  assert.deepEqual(parsed.modifiers, ["Control"]);
});

QUnit.test("Multiple modifiers in canonical order", (assert) => {
  const parsed = parseHotkey("Shift+Ctrl+K", Platform.Windows);
  assert.strictEqual(parsed.key, "K");
  assert.strictEqual(parsed.ctrl, true);
  assert.strictEqual(parsed.shift, true);
  assert.deepEqual(parsed.modifiers, ["Control", "Shift"]);
});

QUnit.test("Case-insensitive modifier aliases", (assert) => {
  const parsed = parseHotkey("cmd+shift+s", Platform.Mac);
  assert.strictEqual(parsed.key, "S");
  assert.strictEqual(parsed.meta, true);
  assert.strictEqual(parsed.shift, true);
});

QUnit.test("Function key", (assert) => {
  const parsed = parseHotkey("f5", Platform.Windows);
  assert.strictEqual(parsed.key, "F5");
  assert.deepEqual(parsed.modifiers, []);
});

QUnit.test("Literal plus key: Ctrl++", (assert) => {
  const parsed = parseHotkey("Ctrl++", Platform.Windows);
  assert.strictEqual(parsed.key, "+");
  assert.strictEqual(parsed.ctrl, true);
});

QUnit.test("Standalone plus key", (assert) => {
  const parsed = parseHotkey("+", Platform.Windows);
  assert.strictEqual(parsed.key, "+");
  assert.strictEqual(parsed.ctrl, false);
  assert.strictEqual(parsed.shift, false);
  assert.strictEqual(parsed.alt, false);
  assert.strictEqual(parsed.meta, false);
  assert.deepEqual(parsed.modifiers, []);
});

QUnit.test("Key alias resolution", (assert) => {
  const parsed = parseHotkey("Ctrl+Esc", Platform.Windows);
  assert.strictEqual(parsed.key, "Escape");
});

QUnit.test("Throws on empty string", (assert) => {
  assert.throws(() => parseHotkey("", Platform.Windows), /must not be empty/);
});

QUnit.test("Throws on modifier-only", (assert) => {
  assert.throws(() => parseHotkey("Ctrl+Shift", Platform.Windows), /no non-modifier key/);
});

QUnit.test("Throws on malformed separators (Ctrl++S)", (assert) => {
  assert.throws(() => parseHotkey("Ctrl++S", Platform.Windows), /malformed "\+" separators/);
});

QUnit.test("Throws on malformed separators (++S)", (assert) => {
  assert.throws(() => parseHotkey("++S", Platform.Windows), /malformed "\+" separators/);
});

QUnit.test("Throws when multiple keys are provided (A++)", (assert) => {
  assert.throws(() => parseHotkey("A++", Platform.Windows), /multiple non-modifier keys/);
});

QUnit.test("Throws on multiple non-modifier keys (A+B)", (assert) => {
  assert.throws(() => parseHotkey("A+B", Platform.Windows), /unexpected segment/);
});

QUnit.module("parse - normalizeHotkey");

QUnit.test("Normalizes modifier order", (assert) => {
  assert.strictEqual(normalizeHotkey("Shift+Ctrl+S", Platform.Windows), "Control+Shift+S");
});

QUnit.test("Normalizes aliases", (assert) => {
  assert.strictEqual(normalizeHotkey("cmd+shift+s", Platform.Mac), "Shift+Meta+S");
});

QUnit.test("Standalone key", (assert) => {
  assert.strictEqual(normalizeHotkey("Escape", Platform.Windows), "Escape");
});

// ──────────────────────────────────────────────
// keyboardEventToHotkey (Feature 10)
// ──────────────────────────────────────────────

QUnit.module("parse - keyboardEventToHotkey");

QUnit.test("Simple key event", (assert) => {
  const event = new KeyboardEvent("keydown", { key: "F5" });
  assert.strictEqual(keyboardEventToHotkey(event), "F5");
});

QUnit.test("Modifier combo in canonical order", (assert) => {
  const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, shiftKey: true });
  assert.strictEqual(keyboardEventToHotkey(event), "Control+Shift+S", "Canonical order: Control before Shift");

  const event2 = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, shiftKey: true, altKey: true });
  assert.strictEqual(keyboardEventToHotkey(event2), "Control+Alt+Shift+K", "Full canonical order: Control+Alt+Shift");
});

QUnit.test("Returns null for modifier-only press", (assert) => {
  const event = new KeyboardEvent("keydown", { key: "Control", ctrlKey: true });
  assert.strictEqual(keyboardEventToHotkey(event), null, "Control alone returns null");
});

// ──────────────────────────────────────────────
// convertToModFormat (Feature 10)
// ──────────────────────────────────────────────

QUnit.module("parse - convertToModFormat");

QUnit.test("Control+S to Mod+S on Windows", (assert) => {
  assert.strictEqual(convertToModFormat("Control+S", Platform.Windows), "Mod+S");
});

QUnit.test("Meta+S to Mod+S on Mac", (assert) => {
  assert.strictEqual(convertToModFormat("Meta+S", Platform.Mac), "Mod+S");
});

QUnit.test("Multi-modifier: Control+Shift+S to Mod+Shift+S on Windows", (assert) => {
  assert.strictEqual(convertToModFormat("Control+Shift+S", Platform.Windows), "Mod+Shift+S");
});

QUnit.test("No conversion for non-platform modifier", (assert) => {
  // Meta+S on Windows is NOT the platform modifier - should not convert
  assert.strictEqual(convertToModFormat("Meta+S", Platform.Windows), "Meta+S");
});

QUnit.test("No conversion for mixed Control+Meta", (assert) => {
  assert.strictEqual(convertToModFormat("Control+Meta+S", Platform.Windows), "Control+Meta+S");
});
