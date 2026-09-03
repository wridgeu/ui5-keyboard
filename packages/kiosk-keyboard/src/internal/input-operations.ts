import Element from "sap/ui/core/Element";
import type { TargetElement } from "./types";
import { graphemeLengthAfter, graphemeLengthBefore } from "./grapheme";
import { endComposition, type CompositionState } from "./composition-utils";

/** Cursor position tuple: [selectionStart, selectionEnd]. */
export type CursorPos = [number, number];

/** Resolves the effective cursor range from an explicit tuple or the DOM selection. */
function resolveCursor(dom: HTMLInputElement | HTMLTextAreaElement, cursor?: CursorPos): CursorPos {
  if (cursor) return cursor;
  const len = dom.value.length;
  const start = dom.selectionStart ?? len;
  return [start, dom.selectionEnd ?? start];
}

function resolveVerticalCaret(value: string, caret: number, direction: -1 | 1): number {
  const len = value.length;
  const pos = Math.max(0, Math.min(caret, len));

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
function activeElement(): globalThis.Element | null {
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
 * Runs `command` as a platform edit and brings the owning UI5 element back in
 * step with the DOM value it produced.
 *
 * Returns whether the platform ran it.
 *
 * A platform edit dispatches a real `input` event, and most editable controls
 * turn that into `liveChange` themselves - `sap.m.Input` from its `oninput`
 * handler, `sap.m.SearchField` from a listener bound in `onAfterRendering`.
 * This watches the element for that `liveChange` while the edit runs and fires
 * one itself only when none arrived.
 */
function nativeEditWithSync(
  dom: HTMLInputElement | HTMLTextAreaElement,
  element: Element | undefined,
  start: number,
  end: number,
  command: () => boolean,
): boolean {
  if (!element) return nativeEdit(dom, start, end, command);

  let announced = false;
  const observer = () => {
    announced = true;
  };

  let ran = false;
  element.attachEvent("liveChange", observer);
  try {
    ran = nativeEdit(dom, start, end, command);
    if (ran) {
      writeTargetValue(element, dom.value, dom);
    }
  } finally {
    element.detachEvent("liveChange", observer);
  }

  if (ran && !announced) {
    fireTargetLiveChange(element, dom.value);
  }
  return ran;
}

/**
 * Inserts text at the given cursor position (or the DOM selection when
 * omitted) in the given input/textarea, replacing any active selection.
 *
 * Runs as a platform edit when the target is focused, so the insertion joins
 * the browser's undo stack and honours `maxlength`; otherwise the value is
 * assigned and `maxlength` applied in JS.
 *
 * Returns the new cursor position so the caller can track it in JS
 * without relying on the DOM's `selectionStart`/`selectionEnd` which
 * may be unreliable on unfocused inputs in some environments.
 */
export function insertText(
  dom: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  cursor?: CursorPos,
): CursorPos | null {
  if (dom.readOnly || dom.disabled) return null;
  const [start, end] = resolveCursor(dom, cursor);
  const element = Element.closestTo(dom);
  const command = () => document.execCommand("insertText", false, text);

  if (nativeEditWithSync(dom, element, start, end, command)) {
    // maxlength may have truncated the insertion
    const pos = dom.selectionStart ?? start;
    return [pos, pos];
  }

  const clamped = clampToMaxLength(dom, text, start, end);
  if (!clamped && start === end) return [start, start];

  const newValue = dom.value.slice(0, start) + clamped + dom.value.slice(end);
  const newPos = start + clamped.length;

  if (element) {
    setTargetValue(element, newValue, dom);
  } else {
    // Target control destroyed - fall back to raw DOM value
    dom.value = newValue;
  }
  try {
    dom.setSelectionRange(newPos, newPos);
  } catch {
    // May throw on certain input types (e.g. type="number")
  }
  return [newPos, newPos];
}

/**
 * Ends an active composition and hands its preedit text to the host as a real
 * edit: the preedit range is spliced out of the raw DOM and re-inserted through
 * {@link insertText}, so UI5's `setValue` / `liveChange` pipeline observes the
 * committed text. This is the sync step {@link endComposition} documents as the
 * caller's contract. `compositionend` fires ahead of the splice, so its `data`
 * carries the composed text.
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
 * (cursor already at position 0 with no selection).
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

  const element = Element.closestTo(dom);

  if (nativeEditWithSync(dom, element, from, to, () => document.execCommand("delete"))) {
    const pos = dom.selectionStart ?? from;
    return [pos, pos];
  }

  const newValue = dom.value.slice(0, from) + dom.value.slice(to);

  if (element) {
    setTargetValue(element, newValue, dom);
  } else {
    dom.value = newValue;
  }
  try {
    dom.setSelectionRange(from, from);
  } catch {
    // May throw on certain input types (e.g. type="number")
  }
  return [from, from];
}

/**
 * Moves the caret for navigation-like keys without changing value. With
 * `extend`, moves the selection's focus and keeps its anchor instead, the way
 * Shift+Arrow does on a physical keyboard. The browser records which end is the
 * anchor as `selectionDirection`: "backward" puts the focus at `selectionStart`;
 * "forward" and "none" put it at `selectionEnd`.
 */
export function handleNavigation(
  dom: HTMLInputElement | HTMLTextAreaElement,
  key: string,
  cursor?: CursorPos,
  extend = false,
): CursorPos | null {
  const [start, end] = resolveCursor(dom, cursor);
  const value = dom.value;
  const len = value.length;
  const backward = dom.selectionDirection === "backward";
  const focus = backward ? start : end;
  const anchor = backward ? end : start;

  let newPos: number | null = null;
  switch (key) {
    case "ArrowLeft":
      newPos = !extend && start !== end ? start : Math.max(0, focus - graphemeLengthBefore(value, focus));
      break;
    case "ArrowRight":
      newPos = !extend && start !== end ? end : Math.min(len, focus + graphemeLengthAfter(value, focus));
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
      newPos = resolveVerticalCaret(value, extend ? focus : start, -1);
      break;
    case "ArrowDown":
      newPos = resolveVerticalCaret(value, extend ? focus : end, 1);
      break;
    default:
      return null;
  }

  const range: CursorPos = extend ? [Math.min(anchor, newPos), Math.max(anchor, newPos)] : [newPos, newPos];
  try {
    if (extend) {
      dom.setSelectionRange(range[0], range[1], newPos < anchor ? "backward" : "forward");
    } else {
      dom.setSelectionRange(newPos, newPos);
    }
  } catch {
    // May throw on certain input types (e.g. type="number")
  }
  return range;
}

/**
 * Sets the value on the UI5 element owning `dom` and announces it as a live
 * edit.
 */
function setTargetValue(element: TargetElement, newValue: string, dom: HTMLInputElement | HTMLTextAreaElement): void {
  writeTargetValue(element, newValue, dom);
  fireTargetLiveChange(element, newValue);
}

/**
 * Writes the value onto the UI5 element owning `dom`.
 *
 * Prefers the typed `setValue()` method (e.g. `InputBase.setValue`) over
 * `setProperty("value")` because direct setProperty only updates the property
 * bag - InputBase.getValue() reads from the DOM when rendered, causing desync.
 *
 * Falls back to `dom` itself for custom controls without a `value` metadata
 * property. That is the element the caller resolved the edit against - through
 * whatever target resolver is in effect - so the fallback lands on the input the
 * new value was computed from rather than re-resolving from the control.
 */
function writeTargetValue(element: TargetElement, newValue: string, dom: HTMLInputElement | HTMLTextAreaElement): void {
  // `in` narrows the member to `unknown`, so the `typeof` is what makes it callable. `element` is
  // whatever control the target resolver landed on, where `setValue` may be a data member.
  if ("setValue" in element && typeof element.setValue === "function") {
    element.setValue(newValue);
  } else if (element.getMetadata().hasProperty("value")) {
    element.setProperty("value", newValue);
  } else {
    dom.value = newValue;
  }
}

/**
 * Fires a `liveChange` event on the given UI5 element, if it supports one.
 *
 * Carries the value under both names sap.m declares it by: `sap.m.Input` takes
 * `value`, `sap.m.SearchField` only `newValue`; `sap.m.InputBase` sends both.
 */
function fireTargetLiveChange(element: TargetElement, value: string): void {
  if (element.getMetadata().hasEvent("liveChange")) {
    element.fireEvent("liveChange", { value, newValue: value });
  }
}

/**
 * Fires a `change` event on the given UI5 element, if it supports one.
 */
export function fireTargetChange(element: TargetElement, value: string): void {
  if (element.getMetadata().hasEvent("change")) {
    element.fireEvent("change", { value });
  }
}
