import type { TargetElement } from "ui5/kiosk/internal/types";

import {
  insertText,
  handleBackspace,
  handleNavigation,
  fireTargetChange,
  type CursorPos,
} from "ui5/kiosk/internal/input-operations";
import Control from "sap/ui/core/Control";
import UI5Element from "sap/ui/core/Element";
import type UI5Event from "sap/ui/base/Event";
import Input from "sap/m/Input";
import TextArea from "sap/m/TextArea";
import type RenderManager from "sap/ui/core/RenderManager";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";

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

/** Runtime interface for the generated accessors on the fixture controls. */
interface ValueInputControl extends Control {
  getValue(): string;
}

/** The one property the fixture controls declare. */
interface ValueInputSettings {
  value?: string;
}

const ValueInputBase = Control.extend("test.IoValueInput", {
  metadata: {
    properties: {
      value: { type: "string", defaultValue: "" },
    },
    events: {
      liveChange: { parameters: { value: { type: "string" } } },
    },
  },
  renderer: {
    apiVersion: 2,
    render(rm: RenderManager, ctrl: ValueInputControl) {
      rm.openStart("div", ctrl).openEnd();
      rm.voidStart("input")
        .attr("id", ctrl.getId() + "-inner")
        .attr("type", "text")
        .attr("value", ctrl.getValue())
        .voidEnd();
      rm.close("div");
    },
  },
  getFocusDomRef(this: Control) {
    return document.getElementById(this.getId() + "-inner");
  },
});

/** Minimal UI5 Control wrapping a single <input>, with a liveChange event and no `oninput` handler. */
const ValueInput = ValueInputBase as new (settings?: ValueInputSettings) => ValueInputControl;

/**
 * Minimal UI5 Control shaped like `sap.m.SearchField`: a `liveChange` event and
 * no `oninput` handler, announcing edits from an `input` listener it binds
 * itself.
 */
const SearchLikeInput = (ValueInputBase as typeof Control).extend("test.IoSearchLikeInput", {
  // apiVersion is read as an own property of the renderer, never inherited
  renderer: { apiVersion: 2 },
  onAfterRendering(this: ValueInputControl) {
    const dom = this.getFocusDomRef() as HTMLInputElement | null;
    dom?.addEventListener("input", () => {
      this.fireEvent("liveChange", { value: dom.value });
    });
  },
}) as new (settings?: ValueInputSettings) => ValueInputControl;

const controls: { destroy(): void }[] = [];

/** Renders a control into the fixture and registers it for teardown. */
async function renderControl<T extends { placeAt(id: string): void; destroy(): void }>(ctrl: T): Promise<T> {
  controls.push(ctrl);
  ctrl.placeAt("qunit-fixture");
  await nextUIUpdate();
  return ctrl;
}

/** Focuses a rendered control's inner input, the precondition for the platform edit path. */
function focusInner(ctrl: { getFocusDomRef(): Element | null }): HTMLInputElement | HTMLTextAreaElement {
  const dom = ctrl.getFocusDomRef() as HTMLInputElement | HTMLTextAreaElement;
  dom.focus();
  return dom;
}

/** Starts counting `input` events on `dom`; the returned function reads the count so far. */
function countInputEvents(dom: HTMLElement): () => number {
  let count = 0;
  dom.addEventListener("input", () => {
    count++;
  });
  return () => count;
}

/** The discriminator between the two paths: only the platform edit dispatches a real `input` event. */
const ONE_PLATFORM_EVENT = "The platform performed the edit - the fallback dispatches no input event";

/** QUnit hooks for the modules that render controls through {@link renderControl}. */
const renderedControlHooks = {
  async afterEach() {
    controls.forEach((c) => c.destroy());
    controls.length = 0;
    await nextUIUpdate();
  },
};

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

QUnit.test("Returns null and does not modify a readOnly input", (assert) => {
  const input = makeInput("abc", [1, 1]);
  input.readOnly = true;
  const result = insertText(input, "X", [1, 1]);
  assert.strictEqual(result, null, "Returns null for readOnly input");
  assert.strictEqual(input.value, "abc", "Value unchanged");
});

QUnit.test("Returns null and does not modify a disabled input", (assert) => {
  const input = makeInput("abc", [1, 1]);
  input.disabled = true;
  const result = insertText(input, "X", [1, 1]);
  assert.strictEqual(result, null, "Returns null for disabled input");
  assert.strictEqual(input.value, "abc", "Value unchanged");
});

QUnit.test("Clamps to the room left in a partially filled field", (assert) => {
  // Unfocused input: the browser never sees the edit, so the JS clamp applies
  const input = makeInput("a", [1, 1]);
  input.maxLength = 3;
  const result = insertText(input, "bcdef", [1, 1]);

  assert.strictEqual(input.value, "abc", "Insertion truncated to the two free code units");
  assert.deepEqual(result, [3, 3], "Cursor after the truncated insertion");
});

QUnit.test("Inserts nothing when maxLength is already reached", (assert) => {
  const input = makeInput("abc", [3, 3]);
  input.maxLength = 3;
  const result = insertText(input, "d", [3, 3]);

  assert.strictEqual(input.value, "abc", "Value unchanged");
  assert.deepEqual(result, [3, 3], "Cursor stays at the end");
});

QUnit.test("Counts the replaced selection as free room", (assert) => {
  const input = makeInput("abc", [0, 3]);
  input.maxLength = 3;
  const result = insertText(input, "xyz", [0, 3]);

  assert.strictEqual(input.value, "xyz", "Selection replaced in full");
  assert.deepEqual(result, [3, 3], "Cursor at end of the replacement");
});

QUnit.test("Does not split a surrogate pair when clamping", (assert) => {
  const input = makeInput("", [0, 0]);
  input.maxLength = 3;
  const result = insertText(input, "\u{1F44D}\u{1F44D}", [0, 0]);

  assert.strictEqual(input.value, "\u{1F44D}", "Second thumbs-up dropped whole");
  assert.strictEqual(input.value.length, 2, "Two code units, one short of the three maxLength allows");
  assert.deepEqual(result, [2, 2], "Cursor after the single emoji");
});

QUnit.test("Inserts unclamped when maxLength is unset", (assert) => {
  const input = makeInput("", [0, 0]);

  assert.strictEqual(input.maxLength, -1, "maxLength unset");

  const result = insertText(input, "abcdef", [0, 0]);

  assert.strictEqual(input.value, "abcdef", "Full text inserted");
  assert.deepEqual(result, [6, 6], "Cursor after all inserted chars");
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

QUnit.test("Returns null and does not modify a readOnly input", (assert) => {
  const input = makeInput("abc", [2, 2]);
  input.readOnly = true;
  const result = handleBackspace(input, [2, 2]);
  assert.strictEqual(result, null, "Returns null for readOnly input");
  assert.strictEqual(input.value, "abc", "Value unchanged");
});

QUnit.test("Returns null and does not modify a disabled input", (assert) => {
  const input = makeInput("abc", [2, 2]);
  input.disabled = true;
  const result = handleBackspace(input, [2, 2]);
  assert.strictEqual(result, null, "Returns null for disabled input");
  assert.strictEqual(input.value, "abc", "Value unchanged");
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
  const ta = makeTextarea("abc\ndef", [1, 3]); // selection covers "bc" on line 1
  const result = handleNavigation(ta, "ArrowDown", [1, 3]);

  // end=3, which is col 3 of line 1 → line2 col 3 = 4+3=7, but line2 len=3, so 7
  assert.deepEqual(result, [7, 7], "Uses selection end for ArrowDown");
});

QUnit.test("ArrowUp collapses selection and moves from start position", (assert) => {
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
// Target value write (through insertText)
// ──────────────────────────────────────────────

// `insertText` is the module's entry into the three-tier value write; the tier
// selection itself is not separately exported. Standing in for the control
// lookup is what lets a duck-typed target reach it, since each tier is defined
// by what the owning control does and does not declare.
const valueWriteSandbox = sinon.createSandbox();

QUnit.module("input-operations - target value write", {
  afterEach() {
    valueWriteSandbox.restore();
    fixture.innerHTML = "";
  },
});

/** Makes the module's control lookup land on `element` for the rest of the test. */
function ownedBy(element: TargetElement): void {
  valueWriteSandbox.stub(UI5Element, "closestTo").returns(element as unknown as UI5Element);
}

/** A target mock carrying only the members `insertText` calls on the owning control. */
function targetMock(overrides: Partial<TargetElement> & Record<string, unknown>): TargetElement {
  return {
    getFocusDomRef: () => null,
    getMetadata: () => ({ hasProperty: () => false, hasEvent: () => false }),
    fireEvent() {},
    setProperty() {},
    attachEvent() {},
    detachEvent() {},
    ...overrides,
  } as TargetElement;
}

QUnit.test("Tier 1: calls setValue() when the method exists", (assert) => {
  let received = "";
  ownedBy(
    targetMock({
      setValue(v: string) {
        received = v;
      },
      getMetadata: () => ({ hasProperty: () => true, hasEvent: () => false }),
    }),
  );

  insertText(makeInput("", [0, 0]), "hello");
  assert.strictEqual(received, "hello", "setValue called with new value");
});

QUnit.test("Tier 2: calls setProperty when the metadata declares value but no setter exists", (assert) => {
  let propName = "";
  let propValue = "";
  ownedBy(
    targetMock({
      setProperty(name: string, value: string) {
        propName = name;
        propValue = value;
      },
      getMetadata: () => ({ hasProperty: (name: string) => name === "value", hasEvent: () => false }),
    }),
  );

  insertText(makeInput("", [0, 0]), "test");
  assert.strictEqual(propName, "value", "setProperty called with 'value'");
  assert.strictEqual(propValue, "test", "setProperty called with new value");
});

QUnit.test("Tier 3: writes the edited input directly when the control declares no value", (assert) => {
  ownedBy(
    targetMock({
      setProperty() {
        assert.notOk(true, "setProperty should not be called");
      },
    }),
  );

  const input = makeInput("old", [0, 3]);
  insertText(input, "new", [0, 3]);
  assert.strictEqual(input.value, "new", "the edited input carries the new value");
});

QUnit.test("Tier 3 writes the input the edit resolved to, not the control's own focus ref", (assert) => {
  // The custom-resolver case: the control's focus ref is a host element the
  // built-in resolution would descend into, and the caller already resolved
  // past it. Only the resolved input may be written.
  const decoy = document.createElement("input");
  const host = document.createElement("div");
  host.appendChild(decoy);
  fixture.appendChild(host);

  ownedBy(targetMock({ getFocusDomRef: () => host }));

  const input = makeInput("", [0, 0]);
  insertText(input, "resolved");
  assert.strictEqual(input.value, "resolved", "the resolved input carries the new value");
  assert.strictEqual(decoy.value, "", "the control's own focus ref is left alone");
});

QUnit.test("Fires liveChange when the target supports it", (assert) => {
  let firedEvent = "";
  let firedValue = "";
  ownedBy(
    targetMock({
      setValue() {},
      getMetadata: () => ({ hasProperty: () => false, hasEvent: (name: string) => name === "liveChange" }),
      fireEvent(name: string, params?: { value: string }) {
        firedEvent = name;
        firedValue = params?.value ?? "";
      },
    }),
  );

  insertText(makeInput("", [0, 0]), "typed");
  assert.strictEqual(firedEvent, "liveChange", "liveChange event fired");
  assert.strictEqual(firedValue, "typed", "liveChange passes new value");
});

QUnit.test("Does not fire liveChange when the target does not declare it", (assert) => {
  let eventFired = false;
  ownedBy(
    targetMock({
      setValue() {},
      fireEvent() {
        eventFired = true;
      },
    }),
  );

  insertText(makeInput("", [0, 0]), "test");
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
    fireEvent(name, params) {
      firedEvent = name;
      firedValue = params?.value ?? "";
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

// ──────────────────────────────────────────────
// insertText - platform edit on a focused target
// ──────────────────────────────────────────────

QUnit.module("input-operations - native insertText", renderedControlHooks);

QUnit.test("Enforces maxLength through the platform edit", async (assert) => {
  // maxlength is the browser's to apply; UI5's setValue does not enforce it
  const ctrl = await renderControl(new Input({ maxLength: 3 }));
  const dom = focusInner(ctrl);
  const inputEvents = countInputEvents(dom);

  const result = insertText(dom, "abcd", [0, 0]);

  assert.strictEqual(dom.value, "abc", "Insertion truncated to maxLength");
  assert.deepEqual(result, [3, 3], "Cursor read back from the truncated insertion");
  assert.strictEqual(inputEvents(), 1, ONE_PLATFORM_EVENT);
});

QUnit.test("Syncs the UI5 value property with the edited DOM value", async (assert) => {
  const ctrl = await renderControl(new Input({ value: "ab" }));
  const dom = focusInner(ctrl);
  const inputEvents = countInputEvents(dom);

  insertText(dom, "X", [2, 2]);

  assert.strictEqual(dom.value, "abX", "DOM value carries the insertion");
  assert.strictEqual(ctrl.getProperty("value"), "abX", "Property matches the DOM value");
  assert.strictEqual(inputEvents(), 1, ONE_PLATFORM_EVENT);
});

QUnit.test("Fires liveChange exactly once on sap.m.Input", async (assert) => {
  const ctrl = await renderControl(new Input({ value: "ab" }));
  const values: unknown[] = [];
  ctrl.attachLiveChange((event) => {
    values.push(event.getParameter("value"));
  });
  const dom = focusInner(ctrl);
  const inputEvents = countInputEvents(dom);

  insertText(dom, "X", [2, 2]);

  assert.deepEqual(values, ["abX"], "Only the control's own liveChange fired");
  assert.strictEqual(inputEvents(), 1, ONE_PLATFORM_EVENT);
});

QUnit.test("Fires liveChange for a target without an oninput handler", async (assert) => {
  const ctrl = await renderControl(new ValueInput({ value: "ab" }));
  const values: unknown[] = [];
  ctrl.attachEvent("liveChange", (event: UI5Event<{ value: string }>) => {
    values.push(event.getParameter("value"));
  });
  const dom = focusInner(ctrl);
  const inputEvents = countInputEvents(dom);

  insertText(dom, "X", [2, 2]);

  assert.strictEqual(dom.value, "abX", "DOM value carries the insertion");
  assert.deepEqual(values, ["abX"], "liveChange fired once");
  assert.strictEqual(inputEvents(), 1, ONE_PLATFORM_EVENT);
});

QUnit.test("Fires liveChange once for a control that binds the input event itself", async (assert) => {
  const ctrl = await renderControl(new SearchLikeInput({ value: "ab" }));
  const values: unknown[] = [];
  ctrl.attachEvent("liveChange", (event: UI5Event<{ value: string }>) => {
    values.push(event.getParameter("value"));
  });
  const dom = focusInner(ctrl);
  const inputEvents = countInputEvents(dom);

  insertText(dom, "X", [2, 2]);

  assert.deepEqual(values, ["abX"], "Only the control's own liveChange fired");
  assert.strictEqual(inputEvents(), 1, ONE_PLATFORM_EVENT);
});

QUnit.test("Inserts a newline into a focused textarea", async (assert) => {
  // The shape TargetInputSession.handleEnter drives: Enter in a textarea inserts "\n"
  const ctrl = await renderControl(new TextArea({ value: "ab" }));
  const dom = focusInner(ctrl);
  const inputEvents = countInputEvents(dom);

  const result = insertText(dom, "\n", [2, 2]);

  assert.strictEqual(dom.value, "ab\n", "Newline inserted");
  assert.deepEqual(result, [3, 3], "Cursor after the newline");
  assert.strictEqual(ctrl.getProperty("value"), "ab\n", "Property matches the DOM value");
  assert.strictEqual(inputEvents(), 1, ONE_PLATFORM_EVENT);
});

QUnit.test("Undo reverts the DOM value; the value property keeps the pre-undo text", async (assert) => {
  const ctrl = await renderControl(new Input({ value: "hello" }));
  const dom = focusInner(ctrl);
  const inputEvents = countInputEvents(dom);

  insertText(dom, "!", [5, 5]);
  assert.strictEqual(dom.value, "hello!", "Insertion applied");
  assert.strictEqual(inputEvents(), 1, ONE_PLATFORM_EVENT);

  document.execCommand("undo");

  assert.strictEqual(dom.value, "hello", "Undo reverted the DOM value");
  assert.strictEqual(
    ctrl.getProperty("value"),
    "hello!",
    "Property stays at the pre-undo text - sap.m.Input writes it from oninput only under valueLiveUpdate",
  );
});

// ──────────────────────────────────────────────
// insertText - focus guard
// ──────────────────────────────────────────────

QUnit.module("input-operations - focus guard", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Editing an unfocused target leaves the focused element untouched", (assert) => {
  const focused = makeInput("keep", [4, 4]);
  const target = makeInput("abc", [1, 1]);
  focused.focus();

  const result = insertText(target, "X", [1, 1]);

  assert.strictEqual(focused.value, "keep", "Focused input unchanged");
  assert.strictEqual(target.value, "aXbc", "Target edited");
  assert.deepEqual(result, [2, 2], "Cursor after the inserted text");
});

// ──────────────────────────────────────────────
// handleBackspace - platform edit on a focused target
// ──────────────────────────────────────────────

QUnit.module("input-operations - native handleBackspace", renderedControlHooks);

QUnit.test("Deletes an entire surrogate-pair emoji", async (assert) => {
  const ctrl = await renderControl(new Input({ value: "a😀b" }));
  const dom = focusInner(ctrl);
  const inputEvents = countInputEvents(dom);

  const result = handleBackspace(dom, [3, 3]);

  assert.strictEqual(dom.value, "ab", "Entire emoji deleted in one backspace");
  assert.deepEqual(result, [1, 1], "Cursor moved back by 2 code units (one grapheme)");
  assert.strictEqual(inputEvents(), 1, ONE_PLATFORM_EVENT);
});

QUnit.test("Deletes an entire ZWJ sequence", async (assert) => {
  const emoji = "👨‍👩‍👧"; // ZWJ family
  const ctrl = await renderControl(new Input({ value: `a${emoji}b` }));
  const dom = focusInner(ctrl);
  const inputEvents = countInputEvents(dom);

  const result = handleBackspace(dom, [1 + emoji.length, 1 + emoji.length]);

  assert.strictEqual(dom.value, "ab", "ZWJ sequence fully deleted");
  assert.deepEqual(result, [1, 1], "Cursor after 'a'");
  assert.strictEqual(inputEvents(), 1, ONE_PLATFORM_EVENT);
});
