/** Keyboard type values that auto-detection can return. "Numeric" is only set programmatically via the keyboardType property. */
type KeyboardTypeValue = "Full" | "Numpad";

/** Valid values for the `data-keyboard-type` explicit override attribute. */
const VALID_DATA_OVERRIDES: ReadonlySet<string> = new Set(["Numpad", "Full"]);

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
    // Cross the shadow boundary to the host element
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
 * 2. DOM `inputmode` attribute (`numeric`, `decimal`, `tel`).
 * 3. HTML `type` attribute (`number`, `tel`).
 *
 * Expects an already-resolved native input/textarea - callers should
 * resolve the target via `resolveInputOrTextarea` before calling.
 */
export function detectKeyboardType(dom: HTMLInputElement | HTMLTextAreaElement): KeyboardTypeValue {
  // 1. Explicit override via data attribute (crosses shadow DOM boundaries)
  const explicit = closestDataKeyboardType(dom);
  if (explicit && VALID_DATA_OVERRIDES.has(explicit)) return explicit as KeyboardTypeValue;

  // 2. Check inputmode attribute
  const inputmode = dom.getAttribute("inputmode");
  if (inputmode && NUMPAD_INPUT_MODES.has(inputmode)) return "Numpad";

  // 3. Check HTML type attribute
  if (dom instanceof HTMLInputElement && NUMPAD_HTML_TYPES.has(dom.type)) {
    return "Numpad";
  }

  return "Full";
}
