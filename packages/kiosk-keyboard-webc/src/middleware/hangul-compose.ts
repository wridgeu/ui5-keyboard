import type { CompositionMiddleware } from "../types.js";
import type { CompositionState } from "../core/composition-utils.js";
import {
  createCompositionState,
  startComposition,
  updateComposition,
  endComposition,
  isComposing,
} from "../core/composition-utils.js";
import { insertText } from "../core/input-operations.js";
import { _registerMiddleware } from "../core/middleware-registry.js";

// ── Unicode constants ──
const S_BASE = 0xac00;
const V_COUNT = 21;
const T_COUNT = 28;
const N_COUNT = V_COUNT * T_COUNT; // 588

// ── Compatibility jamo -> composition jamo mappings ──

const COMPAT_TO_L: ReadonlyMap<number, number> = new Map([
  [0x3131, 0], // ㄱ
  [0x3132, 1], // ㄲ
  [0x3134, 2], // ㄴ
  [0x3137, 3], // ㄷ
  [0x3138, 4], // ㄸ
  [0x3139, 5], // ㄹ
  [0x3141, 6], // ㅁ
  [0x3142, 7], // ㅂ
  [0x3143, 8], // ㅃ
  [0x3145, 9], // ㅅ
  [0x3146, 10], // ㅆ
  [0x3147, 11], // ㅇ
  [0x3148, 12], // ㅈ
  [0x3149, 13], // ㅉ
  [0x314a, 14], // ㅊ
  [0x314b, 15], // ㅋ
  [0x314c, 16], // ㅌ
  [0x314d, 17], // ㅍ
  [0x314e, 18], // ㅎ
]);

const COMPAT_TO_V: ReadonlyMap<number, number> = new Map([
  [0x314f, 0], // ㅏ
  [0x3150, 1], // ㅐ
  [0x3151, 2], // ㅑ
  [0x3152, 3], // ㅒ
  [0x3153, 4], // ㅓ
  [0x3154, 5], // ㅔ
  [0x3155, 6], // ㅕ
  [0x3156, 7], // ㅖ
  [0x3157, 8], // ㅗ
  [0x3158, 9], // ㅘ
  [0x3159, 10], // ㅙ
  [0x315a, 11], // ㅚ
  [0x315b, 12], // ㅛ
  [0x315c, 13], // ㅜ
  [0x315d, 14], // ㅝ
  [0x315e, 15], // ㅞ
  [0x315f, 16], // ㅟ
  [0x3160, 17], // ㅠ
  [0x3161, 18], // ㅡ
  [0x3162, 19], // ㅢ
  [0x3163, 20], // ㅣ
]);

const COMPAT_TO_T: ReadonlyMap<number, number> = new Map([
  [0x3131, 1], // ㄱ
  [0x3132, 2], // ㄲ
  [0x3134, 4], // ㄴ
  [0x3137, 7], // ㄷ
  [0x3139, 8], // ㄹ
  [0x3141, 16], // ㅁ
  [0x3142, 17], // ㅂ
  [0x3145, 19], // ㅅ
  [0x3146, 20], // ㅆ
  [0x3147, 21], // ㅇ
  [0x3148, 22], // ㅈ
  [0x314a, 23], // ㅊ
  [0x314b, 24], // ㅋ
  [0x314c, 25], // ㅌ
  [0x314d, 26], // ㅍ
  [0x314e, 27], // ㅎ
]);

/** Map trailing consonant index back to leading consonant index for T-stealing. */
const T_TO_L: ReadonlyMap<number, number> = new Map([
  [1, 0], // ㄱ
  [2, 1], // ㄲ
  [4, 2], // ㄴ
  [7, 3], // ㄷ
  [8, 5], // ㄹ
  [16, 6], // ㅁ
  [17, 7], // ㅂ
  [19, 9], // ㅅ
  [20, 10], // ㅆ
  [21, 11], // ㅇ
  [22, 12], // ㅈ
  [23, 14], // ㅊ
  [24, 15], // ㅋ
  [25, 16], // ㅌ
  [26, 17], // ㅍ
  [27, 18], // ㅎ
]);

/** Map leading consonant index to the jamo character U+1100-U+1112 for preedit display. */
function jamoL(index: number): string {
  return String.fromCharCode(0x1100 + index);
}

function composeSyllable(l: number, v: number, t = 0): string {
  return String.fromCharCode(S_BASE + l * N_COUNT + v * T_COUNT + t);
}

type Phase = "empty" | "L" | "LV" | "LVT";

function createHangulComposeMiddleware(): CompositionMiddleware {
  const compState: CompositionState = createCompositionState();
  let phase: Phase = "empty";
  let curL = 0;
  let curV = 0;
  let curT = 0;
  let target: HTMLInputElement | HTMLTextAreaElement | null = null;

  function resetInternal(): void {
    phase = "empty";
    curL = 0;
    curV = 0;
    curT = 0;
    target = null;
  }

  function commitPreedit(el: HTMLInputElement | HTMLTextAreaElement): string | null {
    if (!isComposing(compState)) return null;
    const text = el.value.slice(compState.preeditStart, compState.preeditStart + compState.preeditLength);
    endComposition(compState, el);
    return text || null;
  }

  return {
    handleKey(key: string, el: HTMLInputElement | HTMLTextAreaElement): boolean {
      // Handle backspace during composition
      if (key === "{backspace}") {
        if (!isComposing(compState)) return false;
        if (phase === "LVT") {
          phase = "LV";
          curT = 0;
          updateComposition(compState, el, composeSyllable(curL, curV));
          target = el;
          return true;
        }
        if (phase === "LV") {
          phase = "L";
          curV = 0;
          updateComposition(compState, el, jamoL(curL));
          target = el;
          return true;
        }
        if (phase === "L") {
          updateComposition(compState, el, "");
          endComposition(compState, el);
          resetInternal();
          return true;
        }
        return false;
      }

      if (key.length !== 1) {
        // Non-character key (e.g. {enter}, {shift}) -- commit and pass through
        if (isComposing(compState)) {
          commitPreedit(el);
          resetInternal();
        }
        return false;
      }

      const code = key.charCodeAt(0);
      const lIdx = COMPAT_TO_L.get(code);
      const vIdx = COMPAT_TO_V.get(code);

      // Not a jamo character -- commit and pass through
      if (lIdx === undefined && vIdx === undefined) {
        if (isComposing(compState)) {
          commitPreedit(el);
          resetInternal();
        }
        return false;
      }

      // ── State machine ──

      if (phase === "empty") {
        if (lIdx !== undefined) {
          startComposition(compState, el);
          updateComposition(compState, el, jamoL(lIdx));
          phase = "L";
          curL = lIdx;
          target = el;
          return true;
        }
        if (vIdx !== undefined) {
          // Bare vowel -- insert directly, no composition
          insertText(el, key);
          return true;
        }
      }

      if (phase === "L") {
        if (vIdx !== undefined) {
          curV = vIdx;
          phase = "LV";
          updateComposition(compState, el, composeSyllable(curL, curV));
          target = el;
          return true;
        }
        if (lIdx !== undefined) {
          // Another L -- commit current, start new
          commitPreedit(el);
          resetInternal();
          startComposition(compState, el);
          updateComposition(compState, el, jamoL(lIdx));
          phase = "L";
          curL = lIdx;
          target = el;
          return true;
        }
      }

      if (phase === "LV") {
        const tIdx = COMPAT_TO_T.get(code);
        if (tIdx !== undefined && lIdx !== undefined) {
          // Consonant that can be trailing -- treat as T
          curT = tIdx;
          phase = "LVT";
          updateComposition(compState, el, composeSyllable(curL, curV, curT));
          target = el;
          return true;
        }
        if (vIdx !== undefined) {
          // Another vowel -- commit current LV, insert bare vowel
          commitPreedit(el);
          resetInternal();
          insertText(el, key);
          return true;
        }
        if (lIdx !== undefined) {
          // Consonant that cannot be trailing -- commit LV, start new L
          commitPreedit(el);
          resetInternal();
          startComposition(compState, el);
          updateComposition(compState, el, jamoL(lIdx));
          phase = "L";
          curL = lIdx;
          target = el;
          return true;
        }
      }

      if (phase === "LVT") {
        if (vIdx !== undefined) {
          // Steal the trailing consonant: decompose LVT -> LV + stolen T as new L + V
          const stolenL = T_TO_L.get(curT);
          if (stolenL !== undefined) {
            // Rewrite current syllable to LV (drop T)
            updateComposition(compState, el, composeSyllable(curL, curV));
            commitPreedit(el);
            resetInternal();
            // Start new syllable with stolen consonant + new vowel
            startComposition(compState, el);
            curL = stolenL;
            curV = vIdx;
            phase = "LV";
            updateComposition(compState, el, composeSyllable(curL, curV));
            target = el;
            return true;
          }
        }
        if (lIdx !== undefined) {
          // New leading consonant -- commit current LVT, start new
          commitPreedit(el);
          resetInternal();
          startComposition(compState, el);
          updateComposition(compState, el, jamoL(lIdx));
          phase = "L";
          curL = lIdx;
          target = el;
          return true;
        }
      }

      return false;
    },

    commit(): string | null {
      if (!isComposing(compState) || !target) {
        resetInternal();
        return null;
      }
      const text = commitPreedit(target);
      resetInternal();
      return text;
    },

    reset(): void {
      if (isComposing(compState) && target) {
        updateComposition(compState, target, "");
        endComposition(compState, target);
      }
      resetInternal();
    },
  };
}

_registerMiddleware(["ko-hangul"], createHangulComposeMiddleware);
