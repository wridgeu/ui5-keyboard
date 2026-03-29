/** Tracks the preedit range for the active composition. */
let preeditStart = -1;
let preeditLength = 0;

/**
 * Begins a composition session. Dispatches `compositionstart` on the target.
 */
export function startComposition(target: HTMLInputElement | HTMLTextAreaElement): void {
  const pos = target.selectionStart ?? target.value.length;
  preeditStart = pos;
  preeditLength = 0;
  target.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
}

/**
 * Updates the preedit text. Replaces the current preedit range with the new text
 * and dispatches `compositionupdate`.
 */
export function updateComposition(target: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  const value = target.value;
  const before = value.slice(0, preeditStart);
  const after = value.slice(preeditStart + preeditLength);
  target.value = before + text + after;
  preeditLength = text.length;

  const newPos = preeditStart + preeditLength;
  try {
    target.setSelectionRange(newPos, newPos);
  } catch {
    // May throw on certain input types
  }

  target.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: text }));
  target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertCompositionText", data: text }));
}

/**
 * Ends the composition session. Dispatches `compositionend` and resets preedit tracking.
 */
export function endComposition(target: HTMLInputElement | HTMLTextAreaElement): void {
  const committed = target.value.slice(preeditStart, preeditStart + preeditLength);
  target.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: committed }));
  preeditStart = -1;
  preeditLength = 0;
}

/**
 * Returns whether a composition is currently active.
 */
export function isComposing(): boolean {
  return preeditStart >= 0;
}

/**
 * Resets composition state without dispatching events. Test-only.
 * @internal
 */
export function _resetComposition(): void {
  preeditStart = -1;
  preeditLength = 0;
}
