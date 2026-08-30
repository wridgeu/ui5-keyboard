import type { CompositionMiddleware } from "../../src/types.js";
import {
  createCompositionState,
  startComposition,
  updateComposition,
  endComposition,
} from "../../src/core/composition-utils.js";

/**
 * Test-only consumer CompositionMiddleware: a committed accent variant must be
 * able to SEED composition, exactly like a pressed key (Layer 2). The returned
 * factory opens an in-place preedit the first time it sees the `seed` glyph and
 * keeps a live buffer; any following single-character key extends the buffer,
 * and any non-character key finalizes. The preedit is rendered wrapped in
 * `⟦…⟧`, deliberately distinct from a literal insert of the raw glyph, so that
 * routing is observable: a literal insert would show the bare glyph, whereas
 * composition shows the bracketed buffer.
 *
 * Genuine test scaffolding (CLAUDE.md §4): declared on a slotted
 * `<kiosk-keyboard-custom-layout>`; the production modules gain no exports.
 */
export function createSeedComposeMiddleware(seed: string): () => CompositionMiddleware {
  return function seedComposeMiddleware(): CompositionMiddleware {
    const state = createCompositionState();
    let buffer = "";
    let target: HTMLInputElement | HTMLTextAreaElement | null = null;

    const render = (el: HTMLInputElement | HTMLTextAreaElement): void => {
      updateComposition(state, el, `⟦${buffer}⟧`);
    };

    return {
      handleKey(key: string, el: HTMLInputElement | HTMLTextAreaElement): boolean {
        if (key === seed) {
          if (!state.composing) {
            startComposition(state, el);
            buffer = "";
            target = el;
          }
          buffer += key;
          render(el);
          return true;
        }
        if (state.composing) {
          if (key.length === 1) {
            buffer += key;
            render(el);
            return true;
          }
          endComposition(state, el);
          buffer = "";
          target = null;
          return false;
        }
        return false;
      },

      commit(): string | null {
        if (state.composing && target) endComposition(state, target);
        const text = buffer;
        buffer = "";
        target = null;
        return text || null;
      },

      reset(): void {
        if (state.composing && target) {
          updateComposition(state, target, "");
          endComposition(state, target);
        }
        buffer = "";
        target = null;
      },
    };
  };
}
