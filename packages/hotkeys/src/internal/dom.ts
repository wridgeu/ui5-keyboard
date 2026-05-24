import type { ParsedHotkey } from "../types";

/**
 * Set of `<input>` types that are considered editable text fields.
 * Button-like inputs (button, submit, reset) and non-text inputs
 * (checkbox, radio, hidden, file, image, range, color) are excluded.
 */
const EDITABLE_INPUT_TYPES: ReadonlySet<string> = new Set([
  "text",
  "password",
  "email",
  "number",
  "search",
  "tel",
  "url",
  "date",
  "datetime-local",
  "month",
  "week",
  "time",
]);

/**
 * Get the actual event target, accounting for Shadow DOM retargeting.
 *
 * In Shadow DOM, `event.target` is retargeted to the shadow host.
 * `event.composedPath()[0]` returns the original target inside the shadow tree.
 */
export function getEventTarget(event: Event): EventTarget | null {
  return event.composedPath?.()[0] ?? event.target;
}

/**
 * Determine whether an event target is an editable input element
 * where single-key shortcuts should typically be suppressed.
 *
 * Returns `true` for:
 * - `<input>` with an editable text type (text, password, email, number, etc.)
 *   that is not `readonly`
 * - `<textarea>`
 * - Any element with `contentEditable` active (including inherited)
 *
 * Returns `false` for:
 * - `<input type="button|submit|reset|checkbox|radio|hidden|file|image|range|color">`
 * - `<input readonly>` (text cannot be entered, so hotkeys should fire)
 * - `<select>` (navigation control; browser handles arrows / type-ahead /
 *   Enter natively, so app-defined shortcuts can fire alongside)
 * - Non-editable elements
 * - `null` / non-Element targets
 */
export function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  // <input> - only editable text types that are not readonly
  if (target instanceof HTMLInputElement) {
    const type = (target.type || "text").toLowerCase();
    return EDITABLE_INPUT_TYPES.has(type) && !target.readOnly;
  }

  // <textarea> accepts freeform text
  if (target instanceof HTMLTextAreaElement) {
    return true;
  }

  // contentEditable (handles inheritance via the property, not the attribute)
  if (target.isContentEditable) {
    return true;
  }

  return false;
}

/**
 * Resolve the `ignoreInputs` option for a given hotkey.
 *
 * When set to `"auto"`:
 * - Ctrl/Meta combos and Escape → `false` (allow in inputs)
 * - Single keys and Alt/Shift-only combos → `true` (suppress in inputs)
 */
export function resolveIgnoreInputs(option: boolean | "auto", hotkey: ParsedHotkey): boolean {
  if (option !== "auto") return option;
  // Ctrl/Meta combos and Escape should work in inputs; everything else is suppressed
  return !(hotkey.ctrl || hotkey.meta || hotkey.key === "Escape");
}
