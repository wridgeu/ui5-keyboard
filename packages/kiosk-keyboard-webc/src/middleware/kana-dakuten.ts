import type { CompositionMiddleware } from "../types.js";
import { _registerMiddleware } from "../core/middleware-registry.js";

const DAKUTEN = "\u309B"; // ゛
const HANDAKUTEN = "\u309C"; // ゜

/** Dakuten: base kana -> voiced kana. */
const DAKUTEN_MAP: ReadonlyMap<string, string> = new Map([
  ["\u304B", "\u304C"], // か → が
  ["\u304D", "\u304E"], // き → ぎ
  ["\u304F", "\u3050"], // く → ぐ
  ["\u3051", "\u3052"], // け → げ
  ["\u3053", "\u3054"], // こ → ご
  ["\u3055", "\u3056"], // さ → ざ
  ["\u3057", "\u3058"], // し → じ
  ["\u3059", "\u305A"], // す → ず
  ["\u305B", "\u305C"], // せ → ぜ
  ["\u305D", "\u305E"], // そ → ぞ
  ["\u305F", "\u3060"], // た → だ
  ["\u3061", "\u3062"], // ち → ぢ
  ["\u3064", "\u3065"], // つ → づ
  ["\u3066", "\u3067"], // て → で
  ["\u3068", "\u3069"], // と → ど
  ["\u306F", "\u3070"], // は → ば
  ["\u3072", "\u3073"], // ひ → び
  ["\u3075", "\u3076"], // ふ → ぶ
  ["\u3078", "\u3079"], // へ → べ
  ["\u307B", "\u307C"], // ほ → ぼ
  ["\u3046", "\u3094"], // う → ゔ
]);

/** Handakuten: base kana -> semi-voiced kana (ha-row only). */
const HANDAKUTEN_MAP: ReadonlyMap<string, string> = new Map([
  ["\u306F", "\u3071"], // は → ぱ
  ["\u3072", "\u3074"], // ひ → ぴ
  ["\u3075", "\u3077"], // ふ → ぷ
  ["\u3078", "\u307A"], // へ → ぺ
  ["\u307B", "\u307D"], // ほ → ぽ
]);

function createKanaDakutenMiddleware(): CompositionMiddleware {
  return {
    handleKey(key: string, target: HTMLInputElement | HTMLTextAreaElement): boolean {
      if (key !== DAKUTEN && key !== HANDAKUTEN) return false;

      const value = target.value;
      const pos = target.selectionStart ?? value.length;
      if (pos === 0) return false;

      const preceding = value[pos - 1];
      const map = key === DAKUTEN ? DAKUTEN_MAP : HANDAKUTEN_MAP;
      const composed = map.get(preceding);

      if (!composed) return false;

      target.value = value.slice(0, pos - 1) + composed + value.slice(pos);
      try {
        target.setSelectionRange(pos, pos);
      } catch {
        // May throw on certain input types
      }
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: composed }));
      return true;
    },

    commit(): string | null {
      return null;
    },

    reset(): void {
      // no state
    },
  };
}

_registerMiddleware(["ja-kana"], createKanaDakutenMiddleware);
