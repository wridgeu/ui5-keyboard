import Element from "sap/ui/core/Element";
import { isInputOrTextarea } from "./dom-util";

/** Cursor position tuple: [selectionStart, selectionEnd]. */
export type CursorPos = [number, number];

/**
 * Inserts text at the given cursor position (or the DOM selection when
 * omitted) in the given input/textarea, replacing any active selection.
 *
 * Returns the new cursor position so the caller can track it in JS
 * without relying on the DOM's `selectionStart`/`selectionEnd` which
 * may be unreliable on unfocused inputs in some environments.
 */
export function insertText(dom: HTMLInputElement | HTMLTextAreaElement, text: string, cursor?: CursorPos): CursorPos {
  const start = cursor ? cursor[0] : (dom.selectionStart ?? dom.value.length);
  const end = cursor ? cursor[1] : (dom.selectionEnd ?? start);
  const newValue = dom.value.slice(0, start) + text + dom.value.slice(end);
  const newPos = start + text.length;

  const element = Element.closestTo(dom);
  if (element) {
    setTargetValue(element, newValue);
  } else {
    // Target control destroyed — fall back to raw DOM value
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
 * Deletes the character before the cursor, or removes the active
 * selection, in the given input/textarea.
 *
 * Returns the new cursor position, or `null` when nothing was deleted
 * (cursor already at position 0 with no selection).
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
    newValue = dom.value.slice(0, start - 1) + dom.value.slice(start);
    newPos = start - 1;
  } else {
    return null;
  }

  const element = Element.closestTo(dom);
  if (element) {
    setTargetValue(element, newValue);
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
 * Sets the value on the UI5 element associated with the given DOM element.
 *
 * Prefers the typed `setValue()` method (e.g. `InputBase.setValue`) over
 * `setProperty("value")` because direct setProperty only updates the property
 * bag — InputBase.getValue() reads from the DOM when rendered, causing desync.
 *
 * Falls back to setting the DOM value directly for custom controls without
 * a `value` metadata property. Also fires `liveChange` when the event exists.
 */
export function setTargetValue(element: Element, newValue: string): void {
  const metadata = element.getMetadata();
  if (metadata.hasProperty("value")) {
    const ctrl = element as unknown as Record<string, unknown>;
    if (typeof ctrl.setValue === "function") {
      (ctrl.setValue as (v: string) => unknown).call(element, newValue);
    } else {
      element.setProperty("value", newValue);
    }
  } else {
    // Fallback for custom controls without a "value" metadata property:
    // set the inner DOM input value directly so typing still works.
    const dom = element.getFocusDomRef();
    if (isInputOrTextarea(dom)) {
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
export function fireTargetChange(element: Element, value: string): void {
  if (element.getMetadata().hasEvent("change")) {
    element.fireEvent("change", { value });
  }
}
