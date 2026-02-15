import { matchesKeyboardEvent } from "ui5/hotkeys/match";
import { parseHotkey } from "ui5/hotkeys/parse";

/**
 * Create a minimal mock KeyboardEvent for testing.
 */
function mockKeyEvent(overrides: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    key: overrides.key,
    code: overrides.code ?? "",
    ctrlKey: overrides.ctrlKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    altKey: overrides.altKey ?? false,
    metaKey: overrides.metaKey ?? false,
    repeat: overrides.repeat ?? false,
    isComposing: overrides.isComposing ?? false,
    keyCode: overrides.keyCode ?? 0,
  } as unknown as KeyboardEvent;
}

QUnit.module("match - matchesKeyboardEvent");

QUnit.test("Simple key match", (assert) => {
  const parsed = parseHotkey("Escape", "windows");
  const event = mockKeyEvent({ key: "Escape" });
  assert.ok(matchesKeyboardEvent(event, parsed));
});

QUnit.test("Ctrl+S matches on Windows", (assert) => {
  const parsed = parseHotkey("Ctrl+S", "windows");
  const event = mockKeyEvent({ key: "s", ctrlKey: true });
  assert.ok(matchesKeyboardEvent(event, parsed));
});

QUnit.test("Case-insensitive letter matching", (assert) => {
  const parsed = parseHotkey("Ctrl+S", "windows");
  const eventLower = mockKeyEvent({ key: "s", ctrlKey: true });
  const eventUpper = mockKeyEvent({ key: "S", ctrlKey: true });
  assert.ok(matchesKeyboardEvent(eventLower, parsed));
  assert.ok(matchesKeyboardEvent(eventUpper, parsed));
});

QUnit.test("Extra modifier rejects match (Ctrl+Shift+S vs Ctrl+S)", (assert) => {
  const parsed = parseHotkey("Ctrl+S", "windows");
  const event = mockKeyEvent({ key: "s", ctrlKey: true, shiftKey: true });
  assert.notOk(matchesKeyboardEvent(event, parsed));
});

QUnit.test("Missing modifier rejects match", (assert) => {
  const parsed = parseHotkey("Ctrl+S", "windows");
  const event = mockKeyEvent({ key: "s" });
  assert.notOk(matchesKeyboardEvent(event, parsed));
});

QUnit.test("event.code fallback for letter keys (macOS Option+letter)", (assert) => {
  const parsed = parseHotkey("Alt+D", "mac");
  // On macOS, Option+D produces event.key = "∂" but event.code = "KeyD"
  const event = mockKeyEvent({ key: "\u2202", code: "KeyD", altKey: true });
  assert.ok(matchesKeyboardEvent(event, parsed));
});

QUnit.test("event.code fallback for digit keys (Shift+digit)", (assert) => {
  const parsed = parseHotkey("Shift+4", "windows");
  // Shift+4 produces "$" on US layout
  const event = mockKeyEvent({ key: "$", code: "Digit4", shiftKey: true });
  assert.ok(matchesKeyboardEvent(event, parsed));
});

QUnit.test("No false match for wrong letter via event.code", (assert) => {
  const parsed = parseHotkey("Alt+S", "mac");
  const event = mockKeyEvent({ key: "\u2202", code: "KeyD", altKey: true });
  assert.notOk(matchesKeyboardEvent(event, parsed));
});

QUnit.test("Mod+S on Mac matches Meta+S event", (assert) => {
  const parsed = parseHotkey("Mod+S", "mac");
  const event = mockKeyEvent({ key: "s", metaKey: true });
  assert.ok(matchesKeyboardEvent(event, parsed));
});

QUnit.test("Mod+S on Windows matches Ctrl+S event", (assert) => {
  const parsed = parseHotkey("Mod+S", "windows");
  const event = mockKeyEvent({ key: "s", ctrlKey: true });
  assert.ok(matchesKeyboardEvent(event, parsed));
});

QUnit.test("Function key match", (assert) => {
  const parsed = parseHotkey("F5", "windows");
  const event = mockKeyEvent({ key: "F5" });
  assert.ok(matchesKeyboardEvent(event, parsed));
});

QUnit.test("Ctrl+Shift+K two-modifier combo", (assert) => {
  const parsed = parseHotkey("Ctrl+Shift+K", "windows");
  const event = mockKeyEvent({ key: "K", ctrlKey: true, shiftKey: true });
  assert.ok(matchesKeyboardEvent(event, parsed));
});
