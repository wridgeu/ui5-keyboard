/** Per-instance composition state. Each middleware holds its own. */
export interface CompositionState {
  composing: boolean;
  /** Code-unit offset in the target's value where the preedit text begins. */
  preeditStart: number;
  /** Number of UTF-16 code units occupied by the current preedit text. */
  preeditLength: number;
}

/** Creates a fresh composition state for a middleware instance. */
export function createCompositionState(): CompositionState {
  return { composing: false, preeditStart: 0, preeditLength: 0 };
}

/**
 * Begins a composition session. Dispatches `compositionstart` on the target.
 */
export function startComposition(state: CompositionState, target: HTMLInputElement | HTMLTextAreaElement): void {
  const pos = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? pos;
  // A composition replaces the selection, the way a typed character does. The preedit is written
  // at `pos` and {@link updateComposition} derives its range from `pos` alone, so without this
  // the selected text survives beside the preedit instead of under it.
  if (end > pos) {
    target.value = target.value.slice(0, pos) + target.value.slice(end);
  }
  state.composing = true;
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
  state.composing = false;
  state.preeditStart = 0;
  state.preeditLength = 0;
}
