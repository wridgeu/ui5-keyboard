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

QUnit.test("Non-US layout: the typed letter wins over the physical key", (assert) => {
  // QWERTZ swaps Y and Z: the physical Z key types "y".
  const event = mockKeyEvent({ key: "y", code: "KeyZ", ctrlKey: true });
  assert.notOk(
    matchesKeyboardEvent(event, parseHotkey("Ctrl+Z", Platform.Windows)),
    "Ctrl+Z does not fire for the key that typed 'y'",
  );
  assert.ok(matchesKeyboardEvent(event, parseHotkey("Ctrl+Y", Platform.Windows)), "Ctrl+Y fires");
});

QUnit.test("Non-US layout: an unshifted digit key that types a symbol does not match the digit", (assert) => {
  // AZERTY types "&" from Digit1 without Shift; the digit needs Shift.
  const event = mockKeyEvent({ key: "&", code: "Digit1" });
  assert.notOk(matchesKeyboardEvent(event, parseHotkey("1", Platform.Windows)), "hotkey 1 does not fire");
  assert.ok(matchesKeyboardEvent(event, parseHotkey("&", Platform.Windows)), "the typed symbol still matches");
});

QUnit.test("macOS Option+digit matches the digit hotkey", (assert) => {
  // Option+3 on a US Mac layout types "£" from Digit3, with no Shift held.
  const event = mockKeyEvent({ key: "\u00a3", code: "Digit3", altKey: true });
  assert.ok(matchesKeyboardEvent(event, parseHotkey("Alt+3", Platform.Mac)), "Alt+3 fires");
  assert.notOk(
    matchesKeyboardEvent(event, parseHotkey("Alt+4", Platform.Mac)),
    "a different digit on the same row does not fire",
  );
});

QUnit.test("macOS Option+letter matches the letter hotkey", (assert) => {
  // Option+D on a US Mac layout types "∂" from KeyD.
  const event = mockKeyEvent({ key: "\u2202", code: "KeyD", altKey: true });
  assert.ok(matchesKeyboardEvent(event, parseHotkey("Alt+D", Platform.Mac)), "Alt+D fires");
  assert.notOk(matchesKeyboardEvent(event, parseHotkey("Alt+E", Platform.Mac)), "a neighbouring letter does not fire");
});
