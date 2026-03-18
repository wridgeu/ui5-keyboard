import type { TargetElement } from "ui5/kiosk/types";

import {
  insertText,
  handleBackspace,
  handleNavigation,
  setTargetValue,
  fireTargetChange,
  type CursorPos,
} from "ui5/kiosk/internal/input-operations";

const fixture = document.getElementById("qunit-fixture")!;

/** Creates a fresh <input> in the fixture with the given value and cursor. */
function makeInput(value: string, cursor: CursorPos): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  fixture.appendChild(input);
  input.setSelectionRange(cursor[0], cursor[1]);
  return input;
}

/** Creates a fresh <textarea> in the fixture with the given value and cursor. */
function makeTextarea(value: string, cursor: CursorPos): HTMLTextAreaElement {
  const ta = document.createElement("textarea");
  ta.value = value;
  fixture.appendChild(ta);
  ta.setSelectionRange(cursor[0], cursor[1]);
  return ta;
}

// ──────────────────────────────────────────────
// insertText
// ──────────────────────────────────────────────

QUnit.module("input-operations - insertText", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Inserts text at cursor position", (assert) => {
  const input = makeInput("abcd", [2, 2]);
  const result = insertText(input, "XY", [2, 2]);

  assert.strictEqual(input.value, "abXYcd", "Text inserted at position 2");
  assert.deepEqual(result, [4, 4], "Cursor positioned after inserted text");
});

QUnit.test("Replaces active selection with text", (assert) => {
  const input = makeInput("abcdef", [1, 4]);
  const result = insertText(input, "X", [1, 4]);

  assert.strictEqual(input.value, "aXef", "Selection 'bcd' replaced with 'X'");
  assert.deepEqual(result, [2, 2], "Cursor positioned after replacement");
});

QUnit.test("Replaces entire value when fully selected", (assert) => {
  const input = makeInput("hello", [0, 5]);
  const result = insertText(input, "world", [0, 5]);

  assert.strictEqual(input.value, "world", "Entire value replaced");
  assert.deepEqual(result, [5, 5], "Cursor at end of new text");
});

QUnit.test("Inserts at start (position 0)", (assert) => {
  const input = makeInput("abc", [0, 0]);
  const result = insertText(input, "Z", [0, 0]);

  assert.strictEqual(input.value, "Zabc", "Text prepended");
  assert.deepEqual(result, [1, 1], "Cursor after inserted character");
});

QUnit.test("Inserts at end", (assert) => {
  const input = makeInput("abc", [3, 3]);
  const result = insertText(input, "Z", [3, 3]);

  assert.strictEqual(input.value, "abcZ", "Text appended");
  assert.deepEqual(result, [4, 4], "Cursor at end");
});

QUnit.test("Inserts empty string (no-op value, cursor unchanged)", (assert) => {
  const input = makeInput("abc", [2, 2]);
  const result = insertText(input, "", [2, 2]);

  assert.strictEqual(input.value, "abc", "Value unchanged");
  assert.deepEqual(result, [2, 2], "Cursor stays at position 2");
});

QUnit.test("Inserts multi-character text", (assert) => {
  const input = makeInput("ab", [1, 1]);
  const result = insertText(input, "XYZ", [1, 1]);

  assert.strictEqual(input.value, "aXYZb", "Multi-char text inserted");
  assert.deepEqual(result, [4, 4], "Cursor after all inserted chars");
});

QUnit.test("Falls back to dom.value when no UI5 element", (assert) => {
  // Raw DOM input not attached to any UI5 control - Element.closestTo returns null
  const input = makeInput("test", [0, 0]);
  const result = insertText(input, "A", [0, 0]);

  assert.strictEqual(input.value, "Atest", "Fallback path sets dom.value directly");
  assert.deepEqual(result, [1, 1], "Returns correct cursor position");
});

QUnit.test("Works in a textarea with newlines", (assert) => {
  const ta = makeTextarea("line1\nline2", [6, 6]);
  const result = insertText(ta, "X", [6, 6]);

  assert.strictEqual(ta.value, "line1\nXline2", "Text inserted in second line");
  assert.deepEqual(result, [7, 7], "Cursor after insertion");
});

// ──────────────────────────────────────────────
// handleBackspace
// ──────────────────────────────────────────────

QUnit.module("input-operations - handleBackspace", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Deletes single ASCII character before cursor", (assert) => {
  const input = makeInput("abcd", [3, 3]);
  const result = handleBackspace(input, [3, 3]);

  assert.strictEqual(input.value, "abd", "Character 'c' deleted");
  assert.deepEqual(result, [2, 2], "Cursor moved back by 1");
});

QUnit.test("Returns null at position 0 with no selection", (assert) => {
  const input = makeInput("abc", [0, 0]);
  const result = handleBackspace(input, [0, 0]);

  assert.strictEqual(result, null, "Returns null - nothing to delete");
  assert.strictEqual(input.value, "abc", "Value unchanged");
});

QUnit.test("Removes active selection", (assert) => {
  const input = makeInput("abcdef", [2, 5]);
  const result = handleBackspace(input, [2, 5]);

  assert.strictEqual(input.value, "abf", "Selection 'cde' removed");
  assert.deepEqual(result, [2, 2], "Cursor at selection start");
});

QUnit.test("Removes entire surrogate-pair emoji", (assert) => {
  // 😀 = U+1F600 = 2 code units
  const input = makeInput("a😀b", [3, 3]);
  const result = handleBackspace(input, [3, 3]);

  assert.strictEqual(input.value, "ab", "Entire emoji deleted in one backspace");
  assert.deepEqual(result, [1, 1], "Cursor moved back by 2 code units (one grapheme)");
});

QUnit.test("Removes entire ZWJ sequence", (assert) => {
  const emoji = "👨‍👩‍👧"; // ZWJ family
  const input = makeInput(`a${emoji}b`, [1 + emoji.length, 1 + emoji.length]);
  const result = handleBackspace(input, [1 + emoji.length, 1 + emoji.length]);

  assert.strictEqual(input.value, "ab", "ZWJ sequence fully deleted");
  assert.deepEqual(result, [1, 1], "Cursor after 'a'");
});

QUnit.test("Removes combining mark sequence as one grapheme", (assert) => {
  // ñ as n(U+006E) + combining tilde(U+0303) = 2 code units, 1 grapheme
  const input = makeInput("an\u0303o", [3, 3]);
  const result = handleBackspace(input, [3, 3]);

  assert.strictEqual(input.value, "ao", "n + combining tilde deleted as one grapheme");
  assert.deepEqual(result, [1, 1], "Cursor moved back by 2 code units");
});

QUnit.test("Removes regional indicator pair (flag)", (assert) => {
  const flag = "🇩🇪"; // 4 code units
  const input = makeInput(`x${flag}y`, [1 + flag.length, 1 + flag.length]);
  const result = handleBackspace(input, [1 + flag.length, 1 + flag.length]);

  assert.strictEqual(input.value, "xy", "Flag emoji deleted as one grapheme");
  assert.deepEqual(result, [1, 1], "Cursor after 'x'");
});

QUnit.test("Removes variation selector sequence (heart)", (assert) => {
  // ❤️ = U+2764 + U+FE0F = 2 code units
  const input = makeInput("a❤️b", [3, 3]);
  const result = handleBackspace(input, [3, 3]);

  assert.strictEqual(input.value, "ab", "Heart emoji deleted as one grapheme");
  assert.deepEqual(result, [1, 1], "Cursor after 'a'");
});

QUnit.test("Deletes last character from single-char value", (assert) => {
  const input = makeInput("x", [1, 1]);
  const result = handleBackspace(input, [1, 1]);

  assert.strictEqual(input.value, "", "Value is now empty");
  assert.deepEqual(result, [0, 0], "Cursor at position 0");
});

QUnit.test("Selection removal takes precedence over grapheme deletion", (assert) => {
  // With selection active, removes only the selection (not grapheme before start)
  const input = makeInput("a😀bc", [1, 3]);
  const result = handleBackspace(input, [1, 3]);

  assert.strictEqual(input.value, "abc", "Selection removed (the emoji)");
  assert.deepEqual(result, [1, 1], "Cursor at selection start");
});

// ──────────────────────────────────────────────
// handleNavigation
// ──────────────────────────────────────────────

QUnit.module("input-operations - handleNavigation", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("ArrowLeft moves by one ASCII character", (assert) => {
  const input = makeInput("abcd", [3, 3]);
  const result = handleNavigation(input, "ArrowLeft", [3, 3]);

  assert.deepEqual(result, [2, 2], "Cursor moved left by 1");
});

QUnit.test("ArrowLeft collapses selection to start", (assert) => {
  const input = makeInput("abcdef", [2, 5]);
  const result = handleNavigation(input, "ArrowLeft", [2, 5]);

  assert.deepEqual(result, [2, 2], "Cursor at selection start");
});

QUnit.test("ArrowLeft steps over emoji as one grapheme", (assert) => {
  const input = makeInput("a😀b", [3, 3]);
  const result = handleNavigation(input, "ArrowLeft", [3, 3]);

  assert.deepEqual(result, [1, 1], "Skipped entire 😀 (2 code units)");
});

QUnit.test("ArrowLeft at position 0 stays at 0", (assert) => {
  const input = makeInput("abc", [0, 0]);
  const result = handleNavigation(input, "ArrowLeft", [0, 0]);

  assert.deepEqual(result, [0, 0], "Stays at start");
});

QUnit.test("ArrowRight moves by one ASCII character", (assert) => {
  const input = makeInput("abcd", [1, 1]);
  const result = handleNavigation(input, "ArrowRight", [1, 1]);

  assert.deepEqual(result, [2, 2], "Cursor moved right by 1");
});

QUnit.test("ArrowRight collapses selection to end", (assert) => {
  const input = makeInput("abcdef", [2, 5]);
  const result = handleNavigation(input, "ArrowRight", [2, 5]);

  assert.deepEqual(result, [5, 5], "Cursor at selection end");
});

QUnit.test("ArrowRight steps over emoji as one grapheme", (assert) => {
  const input = makeInput("a😀b", [1, 1]);
  const result = handleNavigation(input, "ArrowRight", [1, 1]);

  assert.deepEqual(result, [3, 3], "Skipped entire 😀 (2 code units)");
});

QUnit.test("ArrowRight at end stays at end", (assert) => {
  const input = makeInput("abc", [3, 3]);
  const result = handleNavigation(input, "ArrowRight", [3, 3]);

  assert.deepEqual(result, [3, 3], "Stays at end");
});

QUnit.test("Home moves to position 0", (assert) => {
  const input = makeInput("hello", [3, 3]);
  const result = handleNavigation(input, "Home", [3, 3]);

  assert.deepEqual(result, [0, 0], "Cursor at start");
});

QUnit.test("End moves to end of value", (assert) => {
  const input = makeInput("hello", [2, 2]);
  const result = handleNavigation(input, "End", [2, 2]);

  assert.deepEqual(result, [5, 5], "Cursor at end");
});

QUnit.test("PageUp moves to position 0", (assert) => {
  const input = makeInput("hello", [4, 4]);
  const result = handleNavigation(input, "PageUp", [4, 4]);

  assert.deepEqual(result, [0, 0], "Cursor at start");
});

QUnit.test("PageDown moves to end of value", (assert) => {
  const input = makeInput("hello", [1, 1]);
  const result = handleNavigation(input, "PageDown", [1, 1]);

  assert.deepEqual(result, [5, 5], "Cursor at end");
});

QUnit.test("Unsupported key returns null", (assert) => {
  const input = makeInput("hello", [2, 2]);
  const result = handleNavigation(input, "Tab", [2, 2]);

  assert.strictEqual(result, null, "Returns null for unsupported key");
});

// ── ArrowUp / ArrowDown via resolveVerticalCaret ──

QUnit.test("ArrowDown moves from line 1 to line 2 preserving column", (assert) => {
  // "abc\ndefgh\nij" → line1="abc", line2="defgh", line3="ij"
  const ta = makeTextarea("abc\ndefgh\nij", [2, 2]); // line 1 col 2
  const result = handleNavigation(ta, "ArrowDown", [2, 2]);

  // line2 starts at 4, col 2 → position 6
  assert.deepEqual(result, [6, 6], "Moved to line 2 col 2");
});

QUnit.test("ArrowUp moves from line 2 to line 1 preserving column", (assert) => {
  const ta = makeTextarea("abc\ndefgh\nij", [6, 6]); // line 2 col 2
  const result = handleNavigation(ta, "ArrowUp", [6, 6]);

  // line1 starts at 0, col 2 → position 2
  assert.deepEqual(result, [2, 2], "Moved to line 1 col 2");
});

QUnit.test("ArrowDown clamps column to shorter target line", (assert) => {
  // line1="abcdef"(6), line2="hi"(2)
  const ta = makeTextarea("abcdef\nhi", [5, 5]); // line 1 col 5
  const result = handleNavigation(ta, "ArrowDown", [5, 5]);

  // line2 starts at 7, length 2 → clamp col 5 to 2 → position 9
  assert.deepEqual(result, [9, 9], "Column clamped to shorter line");
});

QUnit.test("ArrowUp clamps column to shorter target line", (assert) => {
  // line1="ab"(2), line2="cdefgh"(6)
  const ta = makeTextarea("ab\ncdefgh", [7, 7]); // line 2 col 4
  const result = handleNavigation(ta, "ArrowUp", [7, 7]);

  // line1 starts at 0, length 2 → clamp col 4 to 2 → position 2
  assert.deepEqual(result, [2, 2], "Column clamped to shorter line");
});

QUnit.test("ArrowUp at first line moves to position 0", (assert) => {
  const ta = makeTextarea("abc\ndef", [2, 2]); // line 1 col 2
  const result = handleNavigation(ta, "ArrowUp", [2, 2]);

  assert.deepEqual(result, [0, 0], "Moved to start of content");
});

QUnit.test("ArrowDown at last line moves to end of value", (assert) => {
  const ta = makeTextarea("abc\ndef", [5, 5]); // line 2 col 1
  const result = handleNavigation(ta, "ArrowDown", [5, 5]);

  assert.deepEqual(result, [7, 7], "Moved to end of content");
});

QUnit.test("ArrowDown in single-line value moves to end", (assert) => {
  const ta = makeTextarea("hello", [2, 2]);
  const result = handleNavigation(ta, "ArrowDown", [2, 2]);

  assert.deepEqual(result, [5, 5], "Moved to end (only one line)");
});

QUnit.test("ArrowUp in single-line value moves to start", (assert) => {
  const ta = makeTextarea("hello", [3, 3]);
  const result = handleNavigation(ta, "ArrowUp", [3, 3]);

  assert.deepEqual(result, [0, 0], "Moved to start (only one line)");
});

QUnit.test("ArrowDown with three lines navigates correctly", (assert) => {
  // 3 lines: "ab"(2), "cde"(3), "f"(1)
  const ta = makeTextarea("ab\ncde\nf", [1, 1]); // line 1 col 1
  let result = handleNavigation(ta, "ArrowDown", [1, 1]);
  // line2 starts at 3, col 1 → position 4
  assert.deepEqual(result, [4, 4], "line1→line2: col 1 preserved");

  result = handleNavigation(ta, "ArrowDown", [4, 4]);
  // line3 starts at 7, length 1, clamp col 1 to 1 → position 8
  assert.deepEqual(result, [8, 8], "line2→line3: col 1 preserved");
});

QUnit.test("ArrowDown collapses selection and moves from end position", (assert) => {
  // handleNavigation uses `end` for ArrowDown per source (line 134)
  const ta = makeTextarea("abc\ndef", [1, 3]); // selection covers "bc" on line 1
  const result = handleNavigation(ta, "ArrowDown", [1, 3]);

  // end=3, which is col 3 of line 1 → line2 col 3 = 4+3=7, but line2 len=3, so 7
  assert.deepEqual(result, [7, 7], "Uses selection end for ArrowDown");
});

QUnit.test("ArrowUp collapses selection and moves from start position", (assert) => {
  // handleNavigation uses `start` for ArrowUp per source (line 131)
  const ta = makeTextarea("abc\ndef", [5, 7]); // selection covers "ef" on line 2
  const result = handleNavigation(ta, "ArrowUp", [5, 7]);

  // start=5, line2 starts at 4, col=1 → line1 col 1 → position 1
  assert.deepEqual(result, [1, 1], "Uses selection start for ArrowUp");
});

QUnit.test("ArrowDown with caret at 0 and leading newline moves to line 2", (assert) => {
  const ta = makeTextarea("\nfoo\nbar", [0, 0]);
  const result = handleNavigation(ta, "ArrowDown", [0, 0]);
  assert.deepEqual(result, [1, 1], "Moved to start of 'foo'");
});

QUnit.test("ArrowUp with caret at 0 and leading newline stays at 0", (assert) => {
  const ta = makeTextarea("\nfoo", [0, 0]);
  const result = handleNavigation(ta, "ArrowUp", [0, 0]);
  assert.deepEqual(result, [0, 0], "Stays at position 0");
});

// ──────────────────────────────────────────────
// setTargetValue
// ──────────────────────────────────────────────

QUnit.module("input-operations - setTargetValue", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Tier 1: calls setValue() when method exists", (assert) => {
  let received = "";
  const element: TargetElement & { setValue(v: string): void } = {
    setValue(v: string) {
      received = v;
    },
    getFocusDomRef: () => null,
    getMetadata: () => ({
      hasProperty: () => true,
      hasEvent: () => false,
    }),
    fireEvent() {},
    setProperty() {},
  };

  setTargetValue(element, "hello");
  assert.strictEqual(received, "hello", "setValue called with new value");
});

QUnit.test("Tier 2: calls setProperty when metadata has value property but no setValue", (assert) => {
  let propName = "";
  let propValue = "";
  const element: TargetElement = {
    // No setValue method
    setProperty(name: string, value: unknown) {
      propName = name;
      propValue = value as string;
    },
    getFocusDomRef: () => null,
    getMetadata: () => ({
      hasProperty: (name: string) => name === "value",
      hasEvent: () => false,
    }),
    fireEvent() {},
  };

  setTargetValue(element, "test");
  assert.strictEqual(propName, "value", "setProperty called with 'value'");
  assert.strictEqual(propValue, "test", "setProperty called with new value");
});

QUnit.test("Tier 3: falls back to DOM value when no metadata property", (assert) => {
  const innerInput = document.createElement("input");
  innerInput.type = "text";
  innerInput.value = "old";

  const wrapper = document.createElement("div");
  wrapper.appendChild(innerInput);
  fixture.appendChild(wrapper);

  const element: TargetElement = {
    // No setValue method
    setProperty() {
      assert.notOk(true, "setProperty should not be called");
    },
    getMetadata: () => ({
      hasProperty: () => false,
      hasEvent: () => false,
    }),
    getFocusDomRef: () => wrapper,
    fireEvent() {},
  };

  setTargetValue(element, "new");
  assert.strictEqual(innerInput.value, "new", "DOM input value set directly");
});

QUnit.test("Tier 3: getFocusDomRef returns input directly", (assert) => {
  const input = document.createElement("input");
  input.type = "text";
  input.value = "old";
  fixture.appendChild(input);

  const element: TargetElement = {
    getMetadata: () => ({
      hasProperty: () => false,
      hasEvent: () => false,
    }),
    getFocusDomRef: () => input,
    fireEvent() {},
    setProperty() {},
  };

  setTargetValue(element, "direct");
  assert.strictEqual(input.value, "direct", "Input value set via direct getFocusDomRef");
});

QUnit.test("Fires liveChange event when supported", (assert) => {
  let firedEvent = "";
  let firedValue = "";
  const element: TargetElement & { setValue(): void } = {
    setValue() {},
    getFocusDomRef: () => null,
    getMetadata: () => ({
      hasProperty: () => false,
      hasEvent: (name: string) => name === "liveChange",
    }),
    fireEvent(name: string, params?: Record<string, unknown>) {
      firedEvent = name;
      firedValue = (params as { value: string })?.value ?? "";
    },
    setProperty() {},
  };

  setTargetValue(element, "typed");
  assert.strictEqual(firedEvent, "liveChange", "liveChange event fired");
  assert.strictEqual(firedValue, "typed", "liveChange passes new value");
});

QUnit.test("Does not fire liveChange when not supported", (assert) => {
  let eventFired = false;
  const element: TargetElement & { setValue(): void } = {
    setValue() {},
    getFocusDomRef: () => null,
    getMetadata: () => ({
      hasProperty: () => false,
      hasEvent: () => false,
    }),
    fireEvent() {
      eventFired = true;
    },
    setProperty() {},
  };

  setTargetValue(element, "test");
  assert.notOk(eventFired, "No event fired when liveChange not in metadata");
});

// ──────────────────────────────────────────────
// fireTargetChange
// ──────────────────────────────────────────────

QUnit.module("input-operations - fireTargetChange");

QUnit.test("Fires change event when supported", (assert) => {
  let firedEvent = "";
  let firedValue = "";
  const element: TargetElement = {
    getFocusDomRef: () => null,
    getMetadata: () => ({
      hasProperty: () => false,
      hasEvent: (name: string) => name === "change",
    }),
    fireEvent(name: string, params?: Record<string, unknown>) {
      firedEvent = name;
      firedValue = (params as { value: string })?.value ?? "";
    },
    setProperty() {},
  };

  fireTargetChange(element, "done");
  assert.strictEqual(firedEvent, "change", "change event fired");
  assert.strictEqual(firedValue, "done", "change passes the value");
});

QUnit.test("Does not fire when change event not supported", (assert) => {
  let eventFired = false;
  const element: TargetElement = {
    getFocusDomRef: () => null,
    getMetadata: () => ({
      hasProperty: () => false,
      hasEvent: () => false,
    }),
    fireEvent() {
      eventFired = true;
    },
    setProperty() {},
  };

  fireTargetChange(element, "test");
  assert.notOk(eventFired, "No event fired");
});
