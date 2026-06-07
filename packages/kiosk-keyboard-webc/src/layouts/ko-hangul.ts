import type { LayoutDefinition } from "../types.js";

/**
 * Korean Dubeolsik (2-set, KS X 5002) keyboard layout.
 *
 * Each key produces a single Hangul Compatibility Jamo character. The OS IME
 * combines jamo into syllable blocks automatically. The shift layer provides
 * tense (ssang) consonants and additional vowels following the standard
 * Dubeolsik mapping.
 *
 * Digits are accessible via the `{layout:numeric}` switch on row 5.
 *
 * @see {@link https://en.wikipedia.org/wiki/Keyboard_layout#Dubeolsik | Dubeolsik layout}
 * @public
 */
const koHangul: LayoutDefinition = [
  // Row 1: number row
  [
    { value: "1", shiftValue: "!" },
    { value: "2", shiftValue: "@" },
    { value: "3", shiftValue: "#" },
    { value: "4", shiftValue: "$" },
    { value: "5", shiftValue: "%" },
    { value: "6", shiftValue: "^" },
    { value: "7", shiftValue: "&" },
    { value: "8", shiftValue: "*" },
    { value: "9", shiftValue: "(" },
    { value: "0", shiftValue: ")" },
    { value: "{backspace}", width: "1.5", type: "action" },
  ],
  // Row 2: upper letter row (Q-P positions) -- consonants and vowels
  [
    { value: "\u3142", shiftValue: "\u3143" }, // ㅂ → ㅃ (Q)
    { value: "\u3148", shiftValue: "\u3149" }, // ㅈ → ㅉ (W)
    { value: "\u3137", shiftValue: "\u3138" }, // ㄷ → ㄸ (E)
    { value: "\u3131", shiftValue: "\u3132" }, // ㄱ → ㄲ (R)
    { value: "\u3145", shiftValue: "\u3146" }, // ㅅ → ㅆ (T)
    { value: "\u315B" }, // ㅛ (Y)
    { value: "\u3155" }, // ㅕ (U)
    { value: "\u3151" }, // ㅑ (I)
    { value: "\u3150", shiftValue: "\u3152" }, // ㅐ → ㅒ (O)
    { value: "\u3154", shiftValue: "\u3156" }, // ㅔ → ㅖ (P)
  ],
  // Row 3: home row (A-L positions) -- consonants and vowels
  [
    { value: "\u3141" }, // ㅁ (A)
    { value: "\u3134" }, // ㄴ (S)
    { value: "\u3147" }, // ㅇ (D)
    { value: "\u3139" }, // ㄹ (F)
    { value: "\u314E" }, // ㅎ (G)
    { value: "\u3157" }, // ㅗ (H)
    { value: "\u3153" }, // ㅓ (J)
    { value: "\u314F" }, // ㅏ (K)
    { value: "\u3163" }, // ㅣ (L)
  ],
  // Row 4: lower row (Z-M positions) + shift/enter
  [
    { value: "{shift}", width: "1.5", type: "modifier" },
    { value: "\u314B" }, // ㅋ (Z)
    { value: "\u314C" }, // ㅌ (X)
    { value: "\u314A" }, // ㅊ (C)
    { value: "\u314D" }, // ㅍ (V)
    { value: "\u3160" }, // ㅠ (B)
    { value: "\u315C" }, // ㅜ (N)
    { value: "\u3161" }, // ㅡ (M)
    { value: ",", shiftValue: "<" },
    { value: ".", shiftValue: ">" },
    { value: "{enter}", width: "1.5", type: "action" },
  ],
  // Row 5: bottom row
  [
    { value: "{layout:numeric}", label: "123", width: "1.5", type: "modifier" },
    { value: "{layout:qwerty}", label: "ABC", type: "modifier" },
    { value: " ", width: "space", type: "space" },
    { value: "/", shiftValue: "?" },
    { value: "{layout:fkeys}", label: "Fn", width: "1.5", type: "modifier" },
  ],
];

export default koHangul;
