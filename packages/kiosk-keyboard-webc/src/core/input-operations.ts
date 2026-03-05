import { graphemeLengthAfter, graphemeLengthBefore } from "./grapheme.js";

/** Cursor position tuple: [selectionStart, selectionEnd]. */
type CursorPos = [number, number];

function resolveVerticalCaret(value: string, caret: number, direction: -1 | 1): number {
  const len = value.length;
  const pos = Math.max(0, Math.min(caret, len));

  const currentLineStart = value.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
  const currentLineEndRaw = value.indexOf("\n", pos);
  const currentLineEnd = currentLineEndRaw === -1 ? len : currentLineEndRaw;
  const column = pos - currentLineStart;

  if (direction < 0) {
    if (currentLineStart === 0) return 0;
    const prevLineEnd = currentLineStart - 1;
    const prevLineStart = value.lastIndexOf("\n", Math.max(0, prevLineEnd - 1)) + 1;
    const prevLineLen = prevLineEnd - prevLineStart;
    return prevLineStart + Math.min(column, prevLineLen);
  }

  if (currentLineEnd === len) return len;
  const nextLineStart = currentLineEnd + 1;
  const nextLineEndRaw = value.indexOf("\n", nextLineStart);
  const nextLineEnd = nextLineEndRaw === -1 ? len : nextLineEndRaw;
  const nextLineLen = nextLineEnd - nextLineStart;
  return nextLineStart + Math.min(column, nextLineLen);
}

/**
 * Inserts text at the given cursor position (or the DOM selection when
 * omitted) in the given input/textarea, replacing any active selection.
 *
 * Returns the new cursor position.
 */
export function insertText(dom: HTMLInputElement | HTMLTextAreaElement, text: string, cursor?: CursorPos): CursorPos {
  const start = cursor ? cursor[0] : (dom.selectionStart ?? dom.value.length);
  const end = cursor ? cursor[1] : (dom.selectionEnd ?? start);
  const newValue = dom.value.slice(0, start) + text + dom.value.slice(end);
  const newPos = start + text.length;

  dom.value = newValue;
  try {
    dom.setSelectionRange(newPos, newPos);
  } catch {
    // May throw on certain input types (e.g. type="number")
  }
  const inputType = text === "\n" ? "insertLineBreak" : "insertText";
  dom.dispatchEvent(new InputEvent("input", { bubbles: true, inputType, data: text }));
  return [newPos, newPos];
}

/**
 * Deletes the grapheme cluster before the cursor, or removes the
 * active selection, in the given input/textarea.
 *
 * Returns the new cursor position, or `null` when nothing was deleted.
 */
export function handleBackspace(dom: HTMLInputElement | HTMLTextAreaElement, cursor?: CursorPos): CursorPos | null {
  const start = cursor ? cursor[0] : (dom.selectionStart ?? dom.value.length);
  const end = cursor ? cursor[1] : (dom.selectionEnd ?? start);

  let newValue: string;
  let newPos: number;

  if (start !== end) {
    newValue = dom.value.slice(0, start) + dom.value.slice(end);
    newPos = start;
  } else if (start > 0) {
    const deleteLen = graphemeLengthBefore(dom.value, start);
    newValue = dom.value.slice(0, start - deleteLen) + dom.value.slice(start);
    newPos = start - deleteLen;
  } else {
    return null;
  }

  dom.value = newValue;
  try {
    dom.setSelectionRange(newPos, newPos);
  } catch {
    // May throw on certain input types (e.g. type="number")
  }
  dom.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
  return [newPos, newPos];
}

/**
 * Moves the caret/selection for navigation-like keys without changing value.
 */
export function handleNavigation(
  dom: HTMLInputElement | HTMLTextAreaElement,
  key: string,
  cursor?: CursorPos,
): CursorPos | null {
  const len = dom.value.length;
  const start = cursor ? cursor[0] : (dom.selectionStart ?? len);
  const end = cursor ? cursor[1] : (dom.selectionEnd ?? start);

  let newPos: number | null = null;

  switch (key) {
    case "ArrowLeft":
      newPos = start !== end ? start : Math.max(0, start - graphemeLengthBefore(dom.value, start));
      break;
    case "ArrowRight":
      newPos = start !== end ? end : Math.min(len, end + graphemeLengthAfter(dom.value, end));
      break;
    case "Home":
    case "PageUp":
      newPos = 0;
      break;
    case "End":
    case "PageDown":
      newPos = len;
      break;
    case "ArrowUp":
      newPos = resolveVerticalCaret(dom.value, start, -1);
      break;
    case "ArrowDown":
      newPos = resolveVerticalCaret(dom.value, end, 1);
      break;
    default:
      return null;
  }

  try {
    dom.setSelectionRange(newPos, newPos);
  } catch {
    // May throw on certain input types (e.g. type="number")
  }

  return [newPos, newPos];
}
