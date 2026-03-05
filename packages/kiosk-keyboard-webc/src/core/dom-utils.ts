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
export function isInputOrTextarea(el: unknown): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/**
 * Resolve an editable input/textarea element from a DOM element.
 *
 * Supports:
 * - direct native input/textarea
 * - host elements that expose an inner input/textarea in light DOM
 * - host elements that expose an inner input/textarea in shadow DOM
 */
export function resolveInputOrTextarea(el: unknown): HTMLInputElement | HTMLTextAreaElement | null {
  if (isInputOrTextarea(el)) {
    return el;
  }

  if (!(el instanceof HTMLElement)) {
    return null;
  }

  const lightDom = el.querySelector("input,textarea");
  if (isInputOrTextarea(lightDom)) {
    return lightDom;
  }

  const shadowDom = el.shadowRoot?.querySelector("input,textarea");
  if (isInputOrTextarea(shadowDom)) {
    return shadowDom;
  }

  return null;
}
