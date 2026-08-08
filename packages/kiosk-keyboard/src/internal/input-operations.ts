import Element from "sap/ui/core/Element";
import type { TargetElement } from "./types";
import { resolveWithCustomResolver, type TargetResolverFn } from "./dom";
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

/**
 * Inserts text at the given cursor position (or the DOM selection when
 * omitted) in the given input/textarea, replacing any active selection.
 *
 * Returns the new cursor position so the caller can track it in JS
 * without relying on the DOM's `selectionStart`/`selectionEnd` which
 * may be unreliable on unfocused inputs in some environments.
 */
export function insertText(
  dom: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  cursor?: CursorPos,
  customResolver?: TargetResolverFn | null,
): CursorPos | null {
  if (dom.readOnly || dom.disabled) return null;
  const [start, end] = resolveCursor(dom, cursor);
  const newValue = dom.value.slice(0, start) + text + dom.value.slice(end);
  const newPos = start + text.length;

  const element = Element.closestTo(dom);
  if (element) {
    setTargetValue(element, newValue, customResolver);
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
 * caller's contract.
 *
 * Returns the committed text, empty when the preedit was.
 */
export function commitComposition(state: CompositionState, dom: HTMLInputElement | HTMLTextAreaElement): string {
  const start = state.preeditStart;
  const text = dom.value.slice(start, start + state.preeditLength);
  dom.value = dom.value.slice(0, start) + dom.value.slice(start + state.preeditLength);
  state.preeditLength = 0;
  endComposition(state, dom);
  if (text) {
    insertText(dom, text, [start, start]);
  }
  return text;
}

/**
 * Deletes the grapheme cluster before the cursor, or removes the
 * active selection, in the given input/textarea.
 *
 * Returns the new cursor position, or `null` when nothing was deleted
 * (cursor already at position 0 with no selection).
 */
export function handleBackspace(
  dom: HTMLInputElement | HTMLTextAreaElement,
  cursor?: CursorPos,
  customResolver?: TargetResolverFn | null,
): CursorPos | null {
  if (dom.readOnly || dom.disabled) return null;
  const [start, end] = resolveCursor(dom, cursor);

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

  const element = Element.closestTo(dom);
  if (element) {
    setTargetValue(element, newValue, customResolver);
  } else {
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

/**
 * Sets the value on the UI5 element associated with the given DOM element.
 *
 * Prefers the typed `setValue()` method (e.g. `InputBase.setValue`) over
 * `setProperty("value")` because direct setProperty only updates the property
 * bag - InputBase.getValue() reads from the DOM when rendered, causing desync.
 *
 * Falls back to setting the DOM value directly for custom controls without
 * a `value` metadata property. Also fires `liveChange` when the event exists.
 */
export function setTargetValue(
  element: TargetElement,
  newValue: string,
  customResolver?: TargetResolverFn | null,
): void {
  const metadata = element.getMetadata();
  if ("setValue" in element && typeof element.setValue === "function") {
    (element.setValue as (v: string) => unknown).call(element, newValue);
  } else if (metadata.hasProperty("value")) {
    element.setProperty("value", newValue);
  } else {
    // Fallback for custom controls without a "value" metadata property:
    // set the inner DOM input value directly so typing still works.
    const dom = resolveWithCustomResolver(element.getFocusDomRef(), customResolver ?? null);
    if (dom) {
      dom.value = newValue;
    }
  }
  if (metadata.hasEvent("liveChange")) {
    element.fireEvent("liveChange", { value: newValue });
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
