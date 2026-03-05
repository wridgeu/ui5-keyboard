import { resolveInputOrTextarea } from "./dom-utils.js";

/** Keyboard type values for the web component. */
type KeyboardTypeValue = "Full" | "Numpad" | "Numeric";

/** Numeric input modes that map to Numpad keyboard. */
const NUMPAD_INPUT_MODES: ReadonlySet<string> = new Set(["numeric", "decimal", "tel"]);
const NUMPAD_HTML_TYPES: ReadonlySet<string> = new Set(["number", "tel"]);

/**
 * Detects whether the target element should use a Numpad or Full
 * keyboard type. Checks DOM inputmode and HTML type attributes.
 */
export function detectKeyboardType(el: HTMLElement): KeyboardTypeValue {
  const dom = resolveInputOrTextarea(el);
  if (!dom) return "Full";

  // Check inputmode attribute
  const inputmode = dom.getAttribute("inputmode");
  if (inputmode && NUMPAD_INPUT_MODES.has(inputmode)) return "Numpad";

  // Check HTML type attribute
  if (dom instanceof HTMLInputElement && NUMPAD_HTML_TYPES.has(dom.type)) {
    return "Numpad";
  }

  return "Full";
}
