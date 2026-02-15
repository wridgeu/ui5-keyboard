import { validateHotkey, assertValidHotkey, checkHotkey, BROWSER_SHORTCUTS, SAP_SHORTCUTS } from "ui5/hotkeys/validate";

QUnit.module("validate - validateHotkey");

QUnit.test("Valid simple key", (assert) => {
  const result = validateHotkey("Escape", "windows");
  assert.ok(result.valid, "Escape is valid");
  assert.strictEqual(result.normalizedHotkey, "Escape");
  assert.strictEqual(result.errors.length, 0, "No errors");
});

QUnit.test("Valid modifier combo", (assert) => {
  const result = validateHotkey("Ctrl+Shift+S", "windows");
  assert.ok(result.valid, "Ctrl+Shift+S is valid");
  assert.strictEqual(result.normalizedHotkey, "Control+Shift+S");
  assert.strictEqual(result.errors.length, 0, "No errors");
});

QUnit.test("Empty string returns error", (assert) => {
  const result = validateHotkey("", "windows");
  assert.notOk(result.valid, "Empty string is invalid");
  assert.ok(result.errors.length > 0, "Has errors");
  assert.ok(result.errors[0].includes("empty"), "Error mentions empty");
});

QUnit.test("Modifier-only returns error", (assert) => {
  const result = validateHotkey("Ctrl+Shift", "windows");
  assert.notOk(result.valid, "Modifier-only is invalid");
  assert.ok(result.errors.length > 0, "Has errors");
});

QUnit.test("Unknown key produces warning", (assert) => {
  const result = validateHotkey("Ctrl+FooBar", "windows");
  assert.ok(result.valid, "Still valid structurally");
  assert.ok(
    result.warnings.some((w) => w.includes("Unknown key")),
    "Warning about unknown key",
  );
});

QUnit.test("Browser conflict warning for F5", (assert) => {
  const result = validateHotkey("F5", "windows");
  assert.ok(result.valid, "F5 is valid");
  assert.ok(
    result.warnings.some((w) => w.includes("browser shortcut")),
    "Warning about browser conflict",
  );
});

QUnit.test("Browser conflict warning for Ctrl+W", (assert) => {
  const result = validateHotkey("Ctrl+W", "windows");
  assert.ok(result.valid, "Ctrl+W is valid");
  assert.ok(
    result.warnings.some((w) => w.includes("browser shortcut")),
    "Warning about browser conflict",
  );
});

QUnit.test("SAP conflict warning for Ctrl+S", (assert) => {
  const result = validateHotkey("Ctrl+S", "windows");
  assert.ok(result.valid, "Ctrl+S is valid");
  assert.ok(
    result.warnings.some((w) => w.includes("SAP shortcut")),
    "Warning about SAP conflict",
  );
});

QUnit.test("No warnings for conflict-free hotkey", (assert) => {
  const result = validateHotkey("Ctrl+Shift+K", "windows");
  assert.ok(result.valid, "Ctrl+Shift+K is valid");
  assert.strictEqual(result.warnings.length, 0, "No warnings");
});

QUnit.module("validate - assertValidHotkey");

QUnit.test("Returns normalized string for valid hotkey", (assert) => {
  const normalized = assertValidHotkey("Ctrl+S", "windows");
  assert.strictEqual(normalized, "Control+S", "Returns normalized form");
});

QUnit.test("Throws for invalid hotkey", (assert) => {
  assert.throws(() => assertValidHotkey("", "windows"), /Invalid hotkey/, "Throws on empty string");
});

QUnit.module("validate - checkHotkey");

QUnit.test("Returns true for valid hotkey", (assert) => {
  assert.ok(checkHotkey("Escape", "windows"), "Escape is valid");
  assert.ok(checkHotkey("Ctrl+Shift+S", "windows"), "Ctrl+Shift+S is valid");
});

QUnit.test("Returns false for invalid hotkey", (assert) => {
  assert.notOk(checkHotkey("", "windows"), "Empty string is invalid");
  assert.notOk(checkHotkey("Ctrl+Shift", "windows"), "Modifier-only is invalid");
});

QUnit.module("validate - blocklist completeness");

QUnit.test("BROWSER_SHORTCUTS has expected entries", (assert) => {
  assert.ok(BROWSER_SHORTCUTS.has("F5"), "F5 in browser blocklist");
  assert.ok(BROWSER_SHORTCUTS.has("Control+W"), "Ctrl+W in browser blocklist");
  assert.ok(BROWSER_SHORTCUTS.has("F12"), "F12 in browser blocklist");
  assert.ok(BROWSER_SHORTCUTS.size >= 15, "At least 15 browser shortcuts");
});

QUnit.test("SAP_SHORTCUTS has expected entries", (assert) => {
  assert.ok(SAP_SHORTCUTS.has("Control+S"), "Ctrl+S in SAP blocklist");
  assert.ok(SAP_SHORTCUTS.has("F6"), "F6 in SAP blocklist");
  assert.ok(SAP_SHORTCUTS.size >= 9, "At least 9 SAP shortcuts");
});
