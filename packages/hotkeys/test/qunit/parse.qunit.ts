import { normalizeHotkey, parseHotkey, keyboardEventToHotkey, convertToModFormat } from "ui5/hotkeys/parse";

QUnit.module("parse - parseHotkey");

QUnit.test("Simple key", (assert) => {
  const parsed = parseHotkey("Escape", "windows");
  assert.strictEqual(parsed.key, "Escape");
  assert.strictEqual(parsed.ctrl, false);
  assert.strictEqual(parsed.shift, false);
  assert.strictEqual(parsed.alt, false);
  assert.strictEqual(parsed.meta, false);
  assert.deepEqual(parsed.modifiers, []);
});

QUnit.test("Single modifier + key", (assert) => {
  const parsed = parseHotkey("Ctrl+S", "windows");
  assert.strictEqual(parsed.key, "S");
  assert.strictEqual(parsed.ctrl, true);
  assert.strictEqual(parsed.shift, false);
  assert.deepEqual(parsed.modifiers, ["Control"]);
});

QUnit.test("Mod resolves to Meta on Mac", (assert) => {
  const parsed = parseHotkey("Mod+S", "mac");
  assert.strictEqual(parsed.key, "S");
  assert.strictEqual(parsed.meta, true);
  assert.strictEqual(parsed.ctrl, false);
  assert.deepEqual(parsed.modifiers, ["Meta"]);
});

QUnit.test("Mod resolves to Control on Windows", (assert) => {
  const parsed = parseHotkey("Mod+S", "windows");
  assert.strictEqual(parsed.key, "S");
  assert.strictEqual(parsed.ctrl, true);
  assert.strictEqual(parsed.meta, false);
  assert.deepEqual(parsed.modifiers, ["Control"]);
});

QUnit.test("Multiple modifiers in canonical order", (assert) => {
  const parsed = parseHotkey("Shift+Ctrl+K", "windows");
  assert.strictEqual(parsed.key, "K");
  assert.strictEqual(parsed.ctrl, true);
  assert.strictEqual(parsed.shift, true);
  assert.deepEqual(parsed.modifiers, ["Control", "Shift"]);
});

QUnit.test("Case-insensitive modifier aliases", (assert) => {
  const parsed = parseHotkey("cmd+shift+s", "mac");
  assert.strictEqual(parsed.key, "S");
  assert.strictEqual(parsed.meta, true);
  assert.strictEqual(parsed.shift, true);
});

QUnit.test("Function key", (assert) => {
  const parsed = parseHotkey("f5", "windows");
  assert.strictEqual(parsed.key, "F5");
  assert.deepEqual(parsed.modifiers, []);
});

QUnit.test("Literal plus key: Ctrl++", (assert) => {
  const parsed = parseHotkey("Ctrl++", "windows");
  assert.strictEqual(parsed.key, "+");
  assert.strictEqual(parsed.ctrl, true);
});

QUnit.test("Standalone plus key", (assert) => {
  const parsed = parseHotkey("+", "windows");
  assert.strictEqual(parsed.key, "+");
  assert.strictEqual(parsed.ctrl, false);
  assert.strictEqual(parsed.shift, false);
  assert.strictEqual(parsed.alt, false);
  assert.strictEqual(parsed.meta, false);
  assert.deepEqual(parsed.modifiers, []);
});

QUnit.test("Key alias resolution", (assert) => {
  const parsed = parseHotkey("Ctrl+Esc", "windows");
  assert.strictEqual(parsed.key, "Escape");
});

QUnit.test("Throws on empty string", (assert) => {
  assert.throws(() => parseHotkey("", "windows"), /must not be empty/);
});

QUnit.test("Throws on modifier-only", (assert) => {
  assert.throws(() => parseHotkey("Ctrl+Shift", "windows"), /no non-modifier key/);
});

QUnit.test("Throws on malformed separators (Ctrl++S)", (assert) => {
  assert.throws(() => parseHotkey("Ctrl++S", "windows"), /malformed "\+" separators/);
});

QUnit.test("Throws on malformed separators (++S)", (assert) => {
  assert.throws(() => parseHotkey("++S", "windows"), /malformed "\+" separators/);
});

QUnit.test("Throws when multiple keys are provided (A++)", (assert) => {
  assert.throws(() => parseHotkey("A++", "windows"), /multiple non-modifier keys/);
});

QUnit.module("parse - normalizeHotkey");

QUnit.test("Normalizes modifier order", (assert) => {
  assert.strictEqual(normalizeHotkey("Shift+Ctrl+S", "windows"), "Control+Shift+S");
});

QUnit.test("Resolves Mod on Mac", (assert) => {
  assert.strictEqual(normalizeHotkey("Mod+S", "mac"), "Meta+S");
});

QUnit.test("Resolves Mod on Windows", (assert) => {
  assert.strictEqual(normalizeHotkey("Mod+S", "windows"), "Control+S");
});

QUnit.test("Normalizes aliases", (assert) => {
  assert.strictEqual(normalizeHotkey("cmd+shift+s", "mac"), "Shift+Meta+S");
});

QUnit.test("Standalone key", (assert) => {
  assert.strictEqual(normalizeHotkey("Escape", "windows"), "Escape");
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
  assert.strictEqual(convertToModFormat("Control+S", "windows"), "Mod+S");
});

QUnit.test("Meta+S to Mod+S on Mac", (assert) => {
  assert.strictEqual(convertToModFormat("Meta+S", "mac"), "Mod+S");
});

QUnit.test("Multi-modifier: Control+Shift+S to Mod+Shift+S on Windows", (assert) => {
  assert.strictEqual(convertToModFormat("Control+Shift+S", "windows"), "Mod+Shift+S");
});

QUnit.test("Multi-modifier: Meta+Shift+S to Mod+Shift+S on Mac", (assert) => {
  assert.strictEqual(convertToModFormat("Meta+Shift+S", "mac"), "Mod+Shift+S");
});

QUnit.test("No conversion for non-platform modifier", (assert) => {
  // Meta+S on Windows is NOT the platform modifier - should not convert
  assert.strictEqual(convertToModFormat("Meta+S", "windows"), "Meta+S");
});

QUnit.test("No conversion for mixed Control+Meta", (assert) => {
  assert.strictEqual(convertToModFormat("Control+Meta+S", "windows"), "Control+Meta+S");
});
