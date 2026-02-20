import { MODIFIER_KEYS } from "./constants";
import { Platform } from "../library";

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
 * - `<textarea>`
 * - `<select>`
 * - Any element with `contentEditable` active (including inherited)
 *
 * Returns `false` for:
 * - `<input type="button|submit|reset|checkbox|radio|hidden|file|image|range|color">`
 * - Non-editable elements
 * - `null` / non-Element targets
 */
export function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  // <input> — only editable text types
  if (target instanceof HTMLInputElement) {
    const type = (target.type || "text").toLowerCase();
    return EDITABLE_INPUT_TYPES.has(type);
  }

  // <textarea> and <select>
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
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
export function resolveIgnoreInputs(option: boolean | "auto", ctrl: boolean, meta: boolean, key: string): boolean {
  if (option !== "auto") return option;
  // Ctrl/Meta combos and Escape should work in inputs; everything else is suppressed
  return !(ctrl || meta || key === "Escape");
}

/**
 * Determine whether a keyboard event should be ignored entirely by hotkey/sequence managers.
 *
 * Filters out:
 * - IME composition events (not a hotkey attempt)
 * - Pure modifier-only key presses (not a hotkey attempt)
 * - AltGr character input on Windows (Ctrl+Alt with right-side Alt)
 *
 * Callers must track `lastAltLocation` themselves and pass it in, since
 * it needs to persist across events within each manager instance.
 */
export function shouldIgnoreKeyEvent(event: KeyboardEvent, platform: Platform, lastAltLocation: number): boolean {
  // IME composition — not a hotkey attempt
  if (event.isComposing || event.keyCode === 229) return true;

  // Pure modifier key press — not a hotkey attempt
  if (MODIFIER_KEYS.has(event.key)) return true;

  // AltGr guard: on Windows, AltGr sends both ctrlKey+altKey.
  // When the last Alt was right-side (location=2), this is AltGr character input.
  if (platform === Platform.Windows && event.ctrlKey && event.altKey && lastAltLocation === 2) return true;

  return false;
}
