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
    // Attach to a parent to verify bubbling
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
});
