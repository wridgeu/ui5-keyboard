import type { CompositionMiddleware } from "../types";
import type { CompositionState } from "../internal/composition-utils";
import {
  createCompositionState,
  startComposition,
  updateComposition,
  endComposition,
  isComposing,
} from "../internal/composition-utils";
import { insertText } from "../internal/input-operations";

const S_BASE = 0xac00;
const V_COUNT = 21;
const T_COUNT = 28;
const N_COUNT = V_COUNT * T_COUNT; // 588

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

/**
 * Maps trailing consonant (jongseong) index to leading consonant (choseong) index.
 * Used during T-stealing: when a vowel follows an LVT syllable, the trailing
 * consonant detaches and becomes the leading consonant of the next syllable.
 */
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

/** Composes a Hangul syllable character from L/V/T indices per Unicode Standard (SBase + L*NCount + V*TCount + T). */
function composeSyllable(l: number, v: number, t = 0): string {
  return String.fromCharCode(S_BASE + l * N_COUNT + v * T_COUNT + t);
}

/**
 * Hangul syllable composition phase.
 *
 * A syllable block is built from up to three components defined by the
 * Unicode Standard (UAX #15, Section 3.12):
 * - **L**: Leading consonant (choseong, e.g. ㄱ)
 * - **V**: Vowel (jungseong, e.g. ㅏ)
 * - **T**: Trailing consonant (jongseong, e.g. ㄴ)
 *
 * Phases track how far composition has progressed:
 * - `"empty"`: No active composition.
 * - `"L"`: Leading consonant entered, waiting for vowel.
 * - `"LV"`: Leading + vowel entered (e.g. 가), waiting for trailing or next syllable.
 * - `"LVT"`: Full syllable (e.g. 간). A following vowel triggers T-stealing:
 *   the trailing consonant detaches and becomes the leading consonant of a
 *   new syllable (간 + ㅏ -> 가 + 나).
 */
type Phase = "empty" | "L" | "LV" | "LVT";

export function createHangulComposeMiddleware(): CompositionMiddleware {
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
    const start = compState.preeditStart;
    const text = el.value.slice(start, start + compState.preeditLength);
    // Splice the preedit out of the raw DOM, end composition, then re-insert
    // the committed text through insertText so the host's setValue/liveChange
    // pipeline observes the syllable. The composition-utils contract documents
    // this requirement; without it the UI5 model and DOM drift apart.
    el.value = el.value.slice(0, start) + el.value.slice(start + compState.preeditLength);
    compState.preeditLength = 0;
    endComposition(compState, el);
    if (text) {
      insertText(el, text, [start, start]);
    }
    return text || null;
  }

  return {
    handleKey(key: string, el: HTMLInputElement | HTMLTextAreaElement): boolean {
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
        if (isComposing(compState)) {
          commitPreedit(el);
          resetInternal();
        }
        return false;
      }

      const code = key.charCodeAt(0);
      const lIdx = COMPAT_TO_L.get(code);
      const vIdx = COMPAT_TO_V.get(code);

      if (lIdx === undefined && vIdx === undefined) {
        if (isComposing(compState)) {
          commitPreedit(el);
          resetInternal();
        }
        return false;
      }

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
          curT = tIdx;
          phase = "LVT";
          updateComposition(compState, el, composeSyllable(curL, curV, curT));
          target = el;
          return true;
        }
        if (vIdx !== undefined) {
          commitPreedit(el);
          resetInternal();
          insertText(el, key);
          return true;
        }
        if (lIdx !== undefined) {
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
          // T-stealing: decompose LVT -> LV, use stolen T as leading consonant of new syllable
          const stolenL = T_TO_L.get(curT);
          if (stolenL !== undefined) {
            updateComposition(compState, el, composeSyllable(curL, curV));
            commitPreedit(el);
            resetInternal();
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
