/** Per-instance composition state. Each middleware holds its own. */
export interface CompositionState {
  preeditStart: number;
  preeditLength: number;
}

/** Creates a fresh composition state for a middleware instance. */
export function createCompositionState(): CompositionState {
  return { preeditStart: -1, preeditLength: 0 };
}

/**
 * Begins a composition session. Dispatches `compositionstart` on the target.
 */
export function startComposition(state: CompositionState, target: HTMLInputElement | HTMLTextAreaElement): void {
  const pos = target.selectionStart ?? target.value.length;
  state.preeditStart = pos;
  state.preeditLength = 0;
  target.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
}

/**
 * Updates the preedit text. Replaces the current preedit range with the new text
 * and dispatches `compositionupdate`.
 */
export function updateComposition(
  state: CompositionState,
  target: HTMLInputElement | HTMLTextAreaElement,
  text: string,
): void {
  const value = target.value;
  const before = value.slice(0, state.preeditStart);
  const after = value.slice(state.preeditStart + state.preeditLength);
  target.value = before + text + after;
  state.preeditLength = text.length;

  const newPos = state.preeditStart + state.preeditLength;
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
export function endComposition(state: CompositionState, target: HTMLInputElement | HTMLTextAreaElement): void {
  const committed = target.value.slice(state.preeditStart, state.preeditStart + state.preeditLength);
  target.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: committed }));
  state.preeditStart = -1;
  state.preeditLength = 0;
}

/** Returns whether a composition is currently active. */
export function isComposing(state: CompositionState): boolean {
  return state.preeditStart >= 0;
}
