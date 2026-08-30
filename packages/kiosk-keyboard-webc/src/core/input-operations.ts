import clamp from "@ui5/webcomponents-base/dist/util/clamp.js";
import { graphemeLengthAfter, graphemeLengthBefore } from "./grapheme.js";
import { endComposition, type CompositionState } from "./composition-utils.js";

/** Cursor position tuple: [selectionStart, selectionEnd]. */
type CursorPos = [number, number];

/** Resolves the effective cursor range from an explicit tuple or the DOM selection. */
function resolveCursor(dom: HTMLInputElement | HTMLTextAreaElement, cursor?: CursorPos): CursorPos {
  if (cursor) return cursor;
  const len = dom.value.length;
  const start = dom.selectionStart ?? len;
  return [start, dom.selectionEnd ?? start];
}

function resolveVerticalCaret(value: string, caret: number, direction: -1 | 1): number {
  const len = value.length;
  const pos = clamp(caret, 0, len);

  const currentLineStart = value.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
  const currentLineEndRaw = value.indexOf("\n", pos);
  const currentLineEnd = currentLineEndRaw === -1 ? len : currentLineEndRaw;
  // Clamp: pos can precede currentLineStart when caret sits before a leading "\n"
  const column = Math.max(0, pos - currentLineStart);

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

/** Returns the focused element, descending through open shadow roots. */
function activeElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

/**
 * Performs `command` as a platform edit over [start, end] of `dom`, so the
 * browser records it on its undo stack and applies `maxlength` itself.
 *
 * Returns whether the platform ran it. `false` means the caller must do the
 * edit itself.
 */
function nativeEdit(
  dom: HTMLInputElement | HTMLTextAreaElement,
  start: number,
  end: number,
  command: () => boolean,
): boolean {
  // `lib.dom` types `execCommand` as always present, but it is deprecated and absent in
  // non-browser DOM shims. Probed before `setSelectionRange` has moved the caret, rather than
  // left to the `catch` below.
  if (typeof document.execCommand !== "function") return false;
  // The command edits whatever is focused, never the element it is handed
  if (activeElement() !== dom) return false;
  try {
    dom.setSelectionRange(start, end);
  } catch {
    // May throw on certain input types (e.g. type="number")
    return false;
  }
  try {
    return command();
  } catch {
    // May throw where the command is unsupported
    return false;
  }
}

/**
 * Truncates `text` to the room `maxLength` leaves once [start, end] is
 * replaced.
 *
 * Mirrors the platform: the limit counts UTF-16 code units, and a surrogate
 * pair is never split.
 */
function clampToMaxLength(
  dom: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  start: number,
  end: number,
): string {
  const max = dom.maxLength;
  if (max < 0) return text;
  const room = max - (dom.value.length - (end - start));
  if (room <= 0) return "";
  if (text.length <= room) return text;
  const lastUnit = text.charCodeAt(room - 1);
  const isHighSurrogate = lastUnit >= 0xd800 && lastUnit <= 0xdbff;
  return text.slice(0, isHighSurrogate ? room - 1 : room);
}

/**
 * Inserts text at the given cursor position (or the DOM selection when
 * omitted) in the given input/textarea, replacing any active selection.
 *
 * Runs as a platform edit when the target is focused, so the insertion joins
 * the browser's undo stack and honours `maxlength`; otherwise the value is
 * assigned, `maxlength` applied in JS, and an `input` event dispatched.
 *
 * Returns the new cursor position, or `null` when the element is
 * read-only or disabled.
 */
export function insertText(
  dom: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  cursor?: CursorPos,
): CursorPos | null {
  if (dom.readOnly || dom.disabled) return null;
  const [start, end] = resolveCursor(dom, cursor);

  if (nativeEdit(dom, start, end, () => document.execCommand("insertText", false, text))) {
    // maxlength may have truncated the insertion
    const pos = dom.selectionStart ?? start;
    return [pos, pos];
  }

  const inserted = clampToMaxLength(dom, text, start, end);
  if (!inserted && start === end) return [start, start];

  const newPos = start + inserted.length;

  dom.value = dom.value.slice(0, start) + inserted + dom.value.slice(end);
  try {
    dom.setSelectionRange(newPos, newPos);
  } catch {
    // May throw on certain input types (e.g. type="number")
  }
  const inputType = inserted === "\n" ? "insertLineBreak" : "insertText";
  dom.dispatchEvent(new InputEvent("input", { bubbles: true, inputType, data: inserted }));
  return [newPos, newPos];
}

/**
 * Ends an active composition and re-applies its preedit text as a real edit: the
 * preedit range is spliced out of the raw value and re-inserted through
 * {@link insertText}, so the committed text passes the read-only/disabled guard,
 * honours `maxlength` and joins the browser's undo stack. `compositionend` fires
 * ahead of the splice, so its `data` carries the composed text.
 *
 * A refused target keeps the splice and loses the insert, which leaves the field
 * at its pre-composition value rather than at a half-written preedit.
 *
 * Returns the committed text, empty when the preedit was.
 */
export function commitComposition(state: CompositionState, dom: HTMLInputElement | HTMLTextAreaElement): string {
  const start = state.preeditStart;
  const end = start + state.preeditLength;
  const text = dom.value.slice(start, end);
  endComposition(state, dom);
  dom.value = dom.value.slice(0, start) + dom.value.slice(end);
  if (text) {
    insertText(dom, text, [start, start]);
  }
  return text;
}

/**
 * Deletes the grapheme cluster before the cursor, or removes the
 * active selection, in the given input/textarea.
 *
 * The range to remove is resolved here and only its removal runs as a platform
 * edit, so the cluster stays the library's notion of one while the deletion
 * joins the browser's undo stack.
 *
 * Returns the new cursor position, or `null` when nothing was deleted
 * or the element is read-only/disabled.
 */
export function handleBackspace(dom: HTMLInputElement | HTMLTextAreaElement, cursor?: CursorPos): CursorPos | null {
  if (dom.readOnly || dom.disabled) return null;
  const [start, end] = resolveCursor(dom, cursor);

  let from: number;
  let to: number;

  if (start !== end) {
    from = start;
    to = end;
  } else if (start > 0) {
    from = start - graphemeLengthBefore(dom.value, start);
    to = start;
  } else {
    return null;
  }

  if (nativeEdit(dom, from, to, () => document.execCommand("delete"))) {
    const pos = dom.selectionStart ?? from;
    return [pos, pos];
  }

  dom.value = dom.value.slice(0, from) + dom.value.slice(to);
  try {
    dom.setSelectionRange(from, from);
  } catch {
    // May throw on certain input types (e.g. type="number")
  }
  dom.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
  return [from, from];
}

/**
 * Moves the caret/selection for navigation-like keys without changing value.
 */
export function handleNavigation(
  dom: HTMLInputElement | HTMLTextAreaElement,
  key: string,
  cursor?: CursorPos,
): CursorPos | null {
  const [start, end] = resolveCursor(dom, cursor);
  const len = dom.value.length;

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
