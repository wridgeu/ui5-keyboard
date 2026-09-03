import { describe, it, expect, beforeEach } from "vitest";
import { insertText, handleBackspace, handleNavigation } from "../../src/core/input-operations.js";

function mockInput(value = "", selStart = 0, selEnd?: number): HTMLInputElement {
  const el = document.createElement("input");
  el.value = value;
  el.setSelectionRange(selStart, selEnd ?? selStart);
  return el;
}

describe("insertText", () => {
  it("inserts at cursor position", () => {
    const el = mockInput("ac", 1);
    const pos = insertText(el, "b");
    expect(el.value).toBe("abc");
    expect(pos).toEqual([2, 2]);
  });

  it("replaces selection", () => {
    const el = mockInput("abcd", 1, 3);
    const pos = insertText(el, "X");
    expect(el.value).toBe("aXd");
    expect(pos).toEqual([2, 2]);
  });

  it("appends at end", () => {
    const el = mockInput("ab", 2);
    insertText(el, "c");
    expect(el.value).toBe("abc");
  });

  it("inserts at beginning", () => {
    const el = mockInput("bc", 0);
    insertText(el, "a");
    expect(el.value).toBe("abc");
  });

  it("uses explicit cursor parameter", () => {
    const el = mockInput("ac", 0);
    const pos = insertText(el, "b", [1, 1]);
    expect(el.value).toBe("abc");
    expect(pos).toEqual([2, 2]);
  });

  it("dispatches input event with insertText type", () => {
    const el = mockInput("a", 1);
    let fired: InputEvent | null = null;
    el.addEventListener(
      "input",
      (e) => {
        fired = e as InputEvent;
      },
      { once: true },
    );
    insertText(el, "b");
    expect(fired).not.toBeNull();
    expect(fired!.inputType).toBe("insertText");
    expect(fired!.data).toBe("b");
  });

  it("dispatches input event with insertLineBreak type for newline", () => {
    const el = document.createElement("textarea");
    el.value = "ab";
    el.setSelectionRange(2, 2);
    let fired: InputEvent | null = null;
    el.addEventListener(
      "input",
      (e) => {
        fired = e as InputEvent;
      },
      { once: true },
    );
    insertText(el, "\n");
    expect(fired).not.toBeNull();
    expect(fired!.inputType).toBe("insertLineBreak");
  });

  it("input event bubbles", () => {
    const el = mockInput("a", 1);
    let bubbled = false;
    const wrapper = document.createElement("div");
    wrapper.appendChild(el);
    wrapper.addEventListener(
      "input",
      () => {
        bubbled = true;
      },
      { once: true },
    );
    insertText(el, "b");
    expect(bubbled).toBe(true);
  });

  it.each(["readOnly", "disabled"] as const)("returns null and does not modify a %s input", (prop) => {
    const el = mockInput("abc", 1);
    el[prop] = true;
    const result = insertText(el, "X");
    expect(result).toBeNull();
    expect(el.value).toBe("abc");
  });

  it("does not dispatch input event on readOnly input", () => {
    const el = mockInput("abc", 1);
    el.readOnly = true;
    let fired = false;
    el.addEventListener(
      "input",
      () => {
        fired = true;
      },
      { once: true },
    );
    insertText(el, "X");
    expect(fired).toBe(false);
  });

  it("clamps to maxLength on an empty field", () => {
    const el = mockInput("", 0);
    el.maxLength = 3;
    const pos = insertText(el, "abcdef");
    expect(el.value).toBe("abc");
    expect(pos).toEqual([3, 3]);
  });

  it("clamps to the room left in a partially filled field", () => {
    const el = mockInput("a", 1);
    el.maxLength = 3;
    const pos = insertText(el, "bcdef");
    expect(el.value).toBe("abc");
    expect(pos).toEqual([3, 3]);
  });

  it("inserts nothing when maxLength is already reached", () => {
    const el = mockInput("abc", 3);
    el.maxLength = 3;
    let fired = false;
    el.addEventListener(
      "input",
      () => {
        fired = true;
      },
      { once: true },
    );
    const pos = insertText(el, "d");
    expect(el.value).toBe("abc");
    expect(pos).toEqual([3, 3]);
    expect(fired).toBe(false);
  });

  it("counts the replaced selection as free room", () => {
    const el = mockInput("abc", 0, 3);
    el.maxLength = 3;
    const pos = insertText(el, "xyz");
    expect(el.value).toBe("xyz");
    expect(pos).toEqual([3, 3]);
  });

  it("does not split a surrogate pair when clamping", () => {
    const el = mockInput("", 0);
    el.maxLength = 3;
    insertText(el, "👍👍");
    expect(el.value, "the pair lands whole on two code units rather than filling the third").toBe("👍");
  });

  it("inserts unclamped when maxLength is unset", () => {
    const el = mockInput("", 0);
    expect(el.maxLength).toBe(-1);
    const pos = insertText(el, "abcdef");
    expect(el.value).toBe("abcdef");
    expect(pos).toEqual([6, 6]);
  });
});

describe("handleBackspace", () => {
  it("deletes character before cursor", () => {
    const el = mockInput("abc", 2);
    const pos = handleBackspace(el);
    expect(el.value).toBe("ac");
    expect(pos).toEqual([1, 1]);
  });

  it("deletes selection", () => {
    const el = mockInput("abcd", 1, 3);
    const pos = handleBackspace(el);
    expect(el.value).toBe("ad");
    expect(pos).toEqual([1, 1]);
  });

  it("returns null at position 0", () => {
    const el = mockInput("abc", 0);
    expect(handleBackspace(el)).toBeNull();
    expect(el.value).toBe("abc");
  });

  it("handles emoji deletion", () => {
    const el = mockInput("a😀b", 3); // after the emoji
    const pos = handleBackspace(el);
    expect(el.value).toBe("ab");
    expect(pos).toEqual([1, 1]);
  });

  it("dispatches input event with deleteContentBackward type", () => {
    const el = mockInput("abc", 2);
    let fired: InputEvent | null = null;
    el.addEventListener(
      "input",
      (e) => {
        fired = e as InputEvent;
      },
      { once: true },
    );
    handleBackspace(el);
    expect(fired).not.toBeNull();
    expect(fired!.inputType).toBe("deleteContentBackward");
  });

  it("dispatches input event with deleteContentBackward when deleting selection", () => {
    const el = mockInput("abcd", 1, 3);
    let fired: InputEvent | null = null;
    el.addEventListener(
      "input",
      (e) => {
        fired = e as InputEvent;
      },
      { once: true },
    );
    handleBackspace(el);
    expect(fired).not.toBeNull();
    expect(fired!.inputType).toBe("deleteContentBackward");
  });

  it("does not dispatch input event when nothing is deleted", () => {
    const el = mockInput("abc", 0);
    let fired = false;
    el.addEventListener(
      "input",
      () => {
        fired = true;
      },
      { once: true },
    );
    handleBackspace(el);
    expect(fired).toBe(false);
  });

  it("input event bubbles", () => {
    const el = mockInput("abc", 2);
    let bubbled = false;
    const wrapper = document.createElement("div");
    wrapper.appendChild(el);
    wrapper.addEventListener(
      "input",
      () => {
        bubbled = true;
      },
      { once: true },
    );
    handleBackspace(el);
    expect(bubbled).toBe(true);
  });

  it.each(["readOnly", "disabled"] as const)("returns null and does not modify a %s input", (prop) => {
    const el = mockInput("abc", 2);
    el[prop] = true;
    const result = handleBackspace(el);
    expect(result).toBeNull();
    expect(el.value).toBe("abc");
  });

  it("does not dispatch input event on readOnly input", () => {
    const el = mockInput("abc", 2);
    el.readOnly = true;
    let fired = false;
    el.addEventListener(
      "input",
      () => {
        fired = true;
      },
      { once: true },
    );
    handleBackspace(el);
    expect(fired).toBe(false);
  });

  it("deletes at a saturated maxLength", () => {
    const el = mockInput("abc", 3);
    el.maxLength = 3;
    const pos = handleBackspace(el);
    expect(el.value).toBe("ab");
    expect(pos).toEqual([2, 2]);
  });
});

describe("handleNavigation", () => {
  let el: HTMLInputElement;

  beforeEach(() => {
    el = mockInput("abcde", 2);
  });

  it("ArrowLeft moves left by one grapheme", () => {
    const pos = handleNavigation(el, "ArrowLeft");
    expect(pos).toEqual([1, 1]);
  });

  it("ArrowRight moves right by one grapheme", () => {
    const pos = handleNavigation(el, "ArrowRight");
    expect(pos).toEqual([3, 3]);
  });

  it("Home moves to start", () => {
    const pos = handleNavigation(el, "Home");
    expect(pos).toEqual([0, 0]);
  });

  it("End moves to end", () => {
    const pos = handleNavigation(el, "End");
    expect(pos).toEqual([5, 5]);
  });

  it("ArrowLeft collapses selection to start", () => {
    const sel = mockInput("abcde", 1, 4);
    const pos = handleNavigation(sel, "ArrowLeft");
    expect(pos).toEqual([1, 1]);
  });

  it("ArrowRight collapses selection to end", () => {
    const sel = mockInput("abcde", 1, 4);
    const pos = handleNavigation(sel, "ArrowRight");
    expect(pos).toEqual([4, 4]);
  });

  it("ArrowUp moves to previous line at same column", () => {
    const ta = document.createElement("textarea");
    ta.value = "abc\ndef\nghi";
    ta.setSelectionRange(5, 5); // "e" on line 2
    const pos = handleNavigation(ta, "ArrowUp");
    expect(pos).toEqual([1, 1]); // "b" on line 1
  });

  it("ArrowDown moves to next line at same column", () => {
    const ta = document.createElement("textarea");
    ta.value = "abc\ndef\nghi";
    ta.setSelectionRange(5, 5); // "e" on line 2
    const pos = handleNavigation(ta, "ArrowDown");
    expect(pos).toEqual([9, 9]); // "h" on line 3
  });

  it("ArrowUp clamps column to shorter previous line", () => {
    const ta = document.createElement("textarea");
    ta.value = "ab\ndefgh";
    ta.setSelectionRange(7, 7); // "g" on line 2, column 4
    const pos = handleNavigation(ta, "ArrowUp");
    expect(pos).toEqual([2, 2]); // end of line 1 (length 2)
  });

  it("ArrowDown clamps column to shorter next line", () => {
    const ta = document.createElement("textarea");
    ta.value = "abcde\nfg";
    ta.setSelectionRange(4, 4); // "e" on line 1, column 4
    const pos = handleNavigation(ta, "ArrowDown");
    expect(pos).toEqual([8, 8]); // end of line 2 (length 2)
  });

  it("ArrowUp at first line stays at start", () => {
    const ta = document.createElement("textarea");
    ta.value = "abc\ndef";
    ta.setSelectionRange(2, 2); // "c" on line 1
    const pos = handleNavigation(ta, "ArrowUp");
    expect(pos).toEqual([0, 0]);
  });

  it("ArrowDown at last line stays at end", () => {
    const ta = document.createElement("textarea");
    ta.value = "abc\ndef";
    ta.setSelectionRange(5, 5); // "e" on line 2
    const pos = handleNavigation(ta, "ArrowDown");
    expect(pos).toEqual([7, 7]);
  });

  it("ArrowDown with caret at 0 and leading newline moves to line 2", () => {
    const ta = document.createElement("textarea");
    ta.value = "\nfoo\nbar";
    ta.setSelectionRange(0, 0); // before the leading newline
    const pos = handleNavigation(ta, "ArrowDown");
    expect(pos).toEqual([1, 1]); // start of "foo"
  });

  it("ArrowUp with caret at 0 and leading newline stays at 0", () => {
    const ta = document.createElement("textarea");
    ta.value = "\nfoo";
    ta.setSelectionRange(0, 0);
    const pos = handleNavigation(ta, "ArrowUp");
    expect(pos).toEqual([0, 0]);
  });

  it("returns null for unknown keys", () => {
    expect(handleNavigation(el, "Tab")).toBeNull();
  });

  it("does not dispatch input event (no value change)", () => {
    let fired = false;
    el.addEventListener(
      "input",
      () => {
        fired = true;
      },
      { once: true },
    );
    handleNavigation(el, "ArrowRight");
    expect(fired).toBe(false);
  });

  it("extending ArrowLeft twice then ArrowRight keeps the anchor", () => {
    const input = mockInput("hello", 5);

    let pos = handleNavigation(input, "ArrowLeft", undefined, true);
    expect(pos).toEqual([4, 5]);

    pos = handleNavigation(input, "ArrowLeft", pos ?? undefined, true);
    expect(pos).toEqual([3, 5]);
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(5);
    expect(input.selectionDirection).toBe("backward");

    pos = handleNavigation(input, "ArrowRight", pos ?? undefined, true);
    expect(pos).toEqual([4, 5]);
    expect(input.selectionStart).toBe(4);
    expect(input.selectionEnd).toBe(5);
    expect(input.selectionDirection).toBe("backward");
  });

  it("extending ArrowLeft from a collapsed caret selects backward", () => {
    const input = mockInput("hello", 5);
    const pos = handleNavigation(input, "ArrowLeft", undefined, true);

    expect(pos).toEqual([4, 5]);
    expect(input.selectionStart).toBe(4);
    expect(input.selectionEnd).toBe(5);
    expect(input.selectionDirection).toBe("backward");
  });

  it("extending ArrowRight from a collapsed caret selects forward", () => {
    const input = mockInput("hello", 0);
    const pos = handleNavigation(input, "ArrowRight", undefined, true);

    expect(pos).toEqual([0, 1]);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(1);
    expect(input.selectionDirection).toBe("forward");
  });

  it("extending Home and PageUp select back to the start", () => {
    const home = mockInput("hello", 3);
    expect(handleNavigation(home, "Home", undefined, true)).toEqual([0, 3]);
    expect(home.selectionStart).toBe(0);
    expect(home.selectionEnd).toBe(3);
    expect(home.selectionDirection).toBe("backward");

    const pageUp = mockInput("hello", 3);
    expect(handleNavigation(pageUp, "PageUp", undefined, true)).toEqual([0, 3]);
    expect(pageUp.selectionDirection).toBe("backward");
  });

  it("extending End and PageDown select forward to the end", () => {
    const end = mockInput("hello", 3);
    expect(handleNavigation(end, "End", undefined, true)).toEqual([3, 5]);
    expect(end.selectionStart).toBe(3);
    expect(end.selectionEnd).toBe(5);
    expect(end.selectionDirection).toBe("forward");

    const pageDown = mockInput("hello", 3);
    expect(handleNavigation(pageDown, "PageDown", undefined, true)).toEqual([3, 5]);
    expect(pageDown.selectionDirection).toBe("forward");
  });

  it("a plain ArrowLeft after an extension collapses the selection", () => {
    const input = mockInput("hello", 3, 5);
    input.setSelectionRange(3, 5, "backward");

    const pos = handleNavigation(input, "ArrowLeft");

    expect(pos).toEqual([3, 3]);
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(3);
  });

  it("extending takes the anchor end from selectionDirection and the positions from the tuple", () => {
    const input = mockInput("hello", 3, 5);
    input.setSelectionRange(3, 5, "backward");

    const pos = handleNavigation(input, "ArrowLeft", [3, 5], true);

    expect(pos).toEqual([2, 5]);
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(5);
    expect(input.selectionDirection).toBe("backward");
  });

  it("extending ArrowUp and ArrowDown move by line and keep the anchor", () => {
    const up = document.createElement("textarea");
    up.value = "abc\ndefgh\nij";
    up.setSelectionRange(6, 6); // line 2 col 2
    expect(handleNavigation(up, "ArrowUp", undefined, true)).toEqual([2, 6]);
    expect(up.selectionStart).toBe(2);
    expect(up.selectionEnd).toBe(6);
    expect(up.selectionDirection).toBe("backward");

    const down = document.createElement("textarea");
    down.value = "abc\ndefgh\nij";
    down.setSelectionRange(2, 2); // line 1 col 2
    expect(handleNavigation(down, "ArrowDown", undefined, true)).toEqual([2, 6]);
    expect(down.selectionStart).toBe(2);
    expect(down.selectionEnd).toBe(6);
    expect(down.selectionDirection).toBe("forward");
  });

  it("extending back onto the anchor collapses, then extends the other way", () => {
    const input = mockInput("hello!", 4, 5);
    input.setSelectionRange(4, 5, "backward");

    let pos = handleNavigation(input, "ArrowRight", undefined, true);
    expect(pos).toEqual([5, 5]);
    expect(input.selectionStart).toBe(5);
    expect(input.selectionEnd).toBe(5);

    pos = handleNavigation(input, "ArrowRight", pos ?? undefined, true);
    expect(pos).toEqual([5, 6]);
    expect(input.selectionDirection).toBe("forward");
  });
});
