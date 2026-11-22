import type { KeyboardType } from "../types.js";

/**
 * Keyboard type values that auto-detection can return.
 * `Numeric` is only set programmatically via the `keyboardType` property.
 */
type KeyboardTypeValue = Exclude<`${KeyboardType}`, "Numeric">;

/** Valid values for the `data-keyboard-type` explicit override attribute. */
const VALID_DATA_OVERRIDES: ReadonlySet<string> = new Set<KeyboardTypeValue>(["Full", "Numpad"]);

/** Whether an authored `data-keyboard-type` value names a keyboard type auto-detection can return. */
function isDataOverride(value: string): value is KeyboardTypeValue {
  return VALID_DATA_OVERRIDES.has(value);
}

/** Numeric input modes that map to Numpad keyboard. */
const NUMPAD_INPUT_MODES: ReadonlySet<string> = new Set(["numeric", "decimal", "tel"]);
const NUMPAD_HTML_TYPES: ReadonlySet<string> = new Set(["number", "tel"]);

/**
 * Walks up from `el` through shadow DOM boundaries, looking for
 * an ancestor with `[data-keyboard-type]`. `Element.closest()` alone
 * cannot cross shadow roots, so we manually traverse host elements.
 */
function closestDataKeyboardType(el: Element): string | null {
  let current: Element | null = el;
  while (current) {
    const match = current.closest<HTMLElement>("[data-keyboard-type]");
    if (match) return match.getAttribute("data-keyboard-type");
    const root = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : null;
  }
  return null;
}

/**
 * Detects whether the target input should use a Numpad or Full
 * keyboard type.
 *
 * Detection order:
 * 1. Explicit `data-keyboard-type` attribute on the element or any
 *    ancestor - crosses shadow DOM boundaries so the attribute can
 *    be placed on an outer host element.
 * 2. The `inputmode` the page authored (`numeric`, `decimal`, `tel`), passed
 *    in by a caller that may have overwritten the attribute itself.
 * 3. HTML `type` attribute (`number`, `tel`).
 */
export function detectKeyboardType(
  dom: HTMLInputElement | HTMLTextAreaElement,
  inputmode = dom.getAttribute("inputmode"),
): KeyboardTypeValue {
  const explicit = closestDataKeyboardType(dom);
  if (explicit !== null && isDataOverride(explicit)) {
    return explicit;
  }

  // `inputmode` is an enumerated HTML attribute matched case-insensitively.
  if (inputmode && NUMPAD_INPUT_MODES.has(inputmode.toLowerCase())) return "Numpad";

  if (dom instanceof HTMLInputElement && NUMPAD_HTML_TYPES.has(dom.type)) {
    return "Numpad";
  }

  return "Full";
}
