/** Per-instance composition state. Each middleware holds its own. */
export interface CompositionState {
  composing: boolean;
  preeditStart: number;
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
 *
 * **Caller contract:** the preedit text written via {@link updateComposition}
 * is committed to the DOM directly and bypasses UI5's `setValue` / `liveChange`
 * pipeline. Callers MUST sync the UI5 model after `endComposition` returns -
 * typically by removing the preedit range from the DOM and re-inserting the
 * committed text through their host's `insertText` (which routes through
 * `setValue` and fires `liveChange`).
 *
 * Skipping this step lets the JS model and the underlying `<input>` value
 * drift apart silently.
 */
export function endComposition(state: CompositionState, target: HTMLInputElement | HTMLTextAreaElement): void {
  const committed = target.value.slice(state.preeditStart, state.preeditStart + state.preeditLength);
  target.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: committed }));
  state.composing = false;
  state.preeditStart = 0;
  state.preeditLength = 0;
}

/** Returns whether a composition is currently active. */
export function isComposing(state: CompositionState): boolean {
  return state.composing;
}
