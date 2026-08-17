import { matchesKeyboardEvent } from "ui5/hotkeys/match";
import { parseHotkey } from "ui5/hotkeys/parse";
import { Platform } from "ui5/hotkeys/library";

/**
 * Create an undispatched KeyboardEvent carrying the given key and modifier state.
 * Unset fields keep the constructor's defaults.
 */
function mockKeyEvent(init: KeyboardEventInit & { key: string }): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

QUnit.module("match - matchesKeyboardEvent");

QUnit.test("Simple key match", (assert) => {
  const parsed = parseHotkey("Escape", Platform.Windows);
  const event = mockKeyEvent({ key: "Escape" });
  assert.ok(matchesKeyboardEvent(event, parsed));
});

QUnit.test("Case-insensitive letter matching", (assert) => {
  const parsed = parseHotkey("Ctrl+S", Platform.Windows);
  const eventLower = mockKeyEvent({ key: "s", ctrlKey: true });
  const eventUpper = mockKeyEvent({ key: "S", ctrlKey: true });
  assert.ok(matchesKeyboardEvent(eventLower, parsed));
  assert.ok(matchesKeyboardEvent(eventUpper, parsed));
});

QUnit.test("Extra modifier rejects match (Ctrl+Shift+S vs Ctrl+S)", (assert) => {
  const parsed = parseHotkey("Ctrl+S", Platform.Windows);
  const event = mockKeyEvent({ key: "s", ctrlKey: true, shiftKey: true });
  assert.notOk(matchesKeyboardEvent(event, parsed));
});

QUnit.test("Missing modifier rejects match", (assert) => {
  const parsed = parseHotkey("Ctrl+S", Platform.Windows);
  const event = mockKeyEvent({ key: "s" });
  assert.notOk(matchesKeyboardEvent(event, parsed));
});

QUnit.test("event.code fallback for letter keys (macOS Option+letter)", (assert) => {
  const parsed = parseHotkey("Alt+D", Platform.Mac);
  // On macOS, Option+D produces event.key = "∂" but event.code = "KeyD"
  const event = mockKeyEvent({ key: "\u2202", code: "KeyD", altKey: true });
  assert.ok(matchesKeyboardEvent(event, parsed));
});

QUnit.test("event.code fallback for digit keys (Shift+digit)", (assert) => {
  const parsed = parseHotkey("Shift+4", Platform.Windows);
  // Shift+4 produces "$" on US layout
  const event = mockKeyEvent({ key: "$", code: "Digit4", shiftKey: true });
  assert.ok(matchesKeyboardEvent(event, parsed));
});

QUnit.test("No false match for wrong letter via event.code", (assert) => {
  const parsed = parseHotkey("Alt+S", Platform.Mac);
  const event = mockKeyEvent({ key: "\u2202", code: "KeyD", altKey: true });
  assert.notOk(matchesKeyboardEvent(event, parsed));
});

QUnit.test("Mod+S on Mac matches Meta+S event", (assert) => {
  const parsed = parseHotkey("Mod+S", Platform.Mac);
  const event = mockKeyEvent({ key: "s", metaKey: true });
  assert.ok(matchesKeyboardEvent(event, parsed));
});

QUnit.test("Mod+S on Windows matches Ctrl+S event", (assert) => {
  const parsed = parseHotkey("Mod+S", Platform.Windows);
  const event = mockKeyEvent({ key: "s", ctrlKey: true });
  assert.ok(matchesKeyboardEvent(event, parsed));
});

QUnit.test("Function key match", (assert) => {
  const parsed = parseHotkey("F5", Platform.Windows);
  const event = mockKeyEvent({ key: "F5" });
  assert.ok(matchesKeyboardEvent(event, parsed));
});

QUnit.test("Ctrl+Shift+K two-modifier combo", (assert) => {
  const parsed = parseHotkey("Ctrl+Shift+K", Platform.Windows);
  const event = mockKeyEvent({ key: "K", ctrlKey: true, shiftKey: true });
  assert.ok(matchesKeyboardEvent(event, parsed));
});
