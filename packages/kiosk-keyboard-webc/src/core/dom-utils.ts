/**
 * Regex to extract row and column indices from a key element ID.
 *
 * Key elements use the pattern `{controlId}-key-{row}-{col}`.
 */
export const KEY_ID_SUFFIX_RE = /-key-(\d+)-(\d+)$/;

/**
 * Constructs the DOM element ID for a key at a given grid position.
 */
export function keyElementId(controlId: string, row: number, col: number): string {
  return `${controlId}-key-${row}-${col}`;
}

/** Type guard: returns true if the value is an HTMLInputElement or HTMLTextAreaElement. */
function isInputOrTextarea(el: unknown): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/**
 * Resolve an editable input/textarea element from a DOM element.
 *
 * Supports:
 * - direct native input/textarea
 * - host elements that expose an inner input/textarea in light DOM
 * - host elements that expose an inner input/textarea in shadow DOM
 * - nested web components (e.g. ui5-step-input → ui5-input → native input)
 *   up to `maxDepth` levels of shadow DOM nesting
 */
export function resolveInputOrTextarea(el: unknown, maxDepth = 3): HTMLInputElement | HTMLTextAreaElement | null {
  if (isInputOrTextarea(el)) {
    return el;
  }

  if (!(el instanceof HTMLElement) || maxDepth <= 0) {
    return null;
  }

  // Check light DOM children
  const lightDom = el.querySelector("input,textarea");
  if (isInputOrTextarea(lightDom)) {
    return lightDom;
  }

  // Check shadow DOM - direct native input/textarea first, then recurse into nested web components
  const shadow = el.shadowRoot;
  if (shadow) {
    const shadowInput = shadow.querySelector("input,textarea");
    if (isInputOrTextarea(shadowInput)) {
      return shadowInput;
    }

    // Recurse into nested custom elements (e.g. ui5-step-input wraps ui5-input)
    for (const child of shadow.querySelectorAll("*")) {
      if (child instanceof HTMLElement && child.shadowRoot) {
        const nested = resolveInputOrTextarea(child, maxDepth - 1);
        if (nested) return nested;
      }
    }
  }

  return null;
}

/** Callback type for custom target resolution. */
type TargetResolverFn = (el: HTMLElement) => HTMLInputElement | HTMLTextAreaElement | null;

/**
 * Resolve using a custom resolver first, falling back to the built-in resolver.
 *
 * Consumer-supplied resolvers are wrapped in try/catch so that a throwing
 * resolver cannot crash interaction paths (typing, focus, escape, etc.).
 */
export function resolveWithCustomResolver(
  el: HTMLElement,
  customResolver: TargetResolverFn | null,
): HTMLInputElement | HTMLTextAreaElement | null {
  if (customResolver) {
    try {
      const custom = customResolver(el);
      if (isInputOrTextarea(custom)) return custom;
    } catch (err) {
      console.warn("[kiosk-keyboard] Custom target resolver threw:", err);
      return resolveInputOrTextarea(el);
    }
  }
  return resolveInputOrTextarea(el);
}
