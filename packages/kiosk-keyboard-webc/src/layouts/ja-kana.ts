import type { LayoutDefinition } from "../types.js";
import { _registerBuiltInLayout } from "../core/layout-registry.js";

/**
 * Japanese kana direct-input layout following JIS X 6002.
 *
 * Each key produces a hiragana character directly. The shift layer provides
 * small kana on the same key as their full-size counterpart (JIS standard),
 * and JIS punctuation variants on row 4. Dakuten and handakuten are on the
 * base layer at their standard JIS positions (row 2, after せ).
 *
 * Digits are accessible via the `{layout:numeric}` switch on row 5.
 *
 * @see {@link https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/fe_kbds/jpn/106/kbd106.c | Microsoft kbd106.c}
 * @public
 */
const jaKana: LayoutDefinition = [
  // Row 1: number row -- kana base, small kana / を on shift
  [
    { value: "\u306C" }, // ぬ (1)
    { value: "\u3075" }, // ふ (2)
    { value: "\u3042", shiftValue: "\u3041" }, // あ → ぁ (3)
    { value: "\u3046", shiftValue: "\u3045" }, // う → ぅ (4)
    { value: "\u3048", shiftValue: "\u3047" }, // え → ぇ (5)
    { value: "\u304A", shiftValue: "\u3049" }, // お → ぉ (6)
    { value: "\u3084", shiftValue: "\u3083" }, // や → ゃ (7)
    { value: "\u3086", shiftValue: "\u3085" }, // ゆ → ゅ (8)
    { value: "\u3088", shiftValue: "\u3087" }, // よ → ょ (9)
    { value: "\u308F", shiftValue: "\u3092" }, // わ → を (0)
    { value: "\u307B", shiftValue: "\u3078" }, // ほ → へ (-)
    { value: "{backspace}", width: "1.5", type: "action" },
  ],
  // Row 2: upper letter row + dakuten/handakuten at JIS positions
  [
    { value: "\u305F" }, // た (Q)
    { value: "\u3066" }, // て (W)
    { value: "\u3044", shiftValue: "\u3043" }, // い → ぃ (E)
    { value: "\u3059" }, // す (R)
    { value: "\u304B" }, // か (T)
    { value: "\u3093" }, // ん (Y)
    { value: "\u306A" }, // な (U)
    { value: "\u306B" }, // に (I)
    { value: "\u3089" }, // ら (O)
    { value: "\u305B" }, // せ (P)
    { value: "\u309B", type: "modifier" }, // ゛ dakuten (@ on JIS)
    { value: "\u309C", type: "modifier" }, // ゜ handakuten ([ on JIS)
  ],
  // Row 3: home row + JIS extra keys
  [
    { value: "\u3061" }, // ち (A)
    { value: "\u3068" }, // と (S)
    { value: "\u3057" }, // し (D)
    { value: "\u306F" }, // は (F)
    { value: "\u304D" }, // き (G)
    { value: "\u304F" }, // く (H)
    { value: "\u307E" }, // ま (J)
    { value: "\u306E" }, // の (K)
    { value: "\u308A" }, // り (L)
    { value: "\u308C" }, // れ (; on JIS)
    { value: "\u3051" }, // け (: on JIS)
    { value: "\u3080" }, // む (] on JIS)
  ],
  // Row 4: lower row + shift/enter + JIS punctuation shifts
  [
    { value: "{shift}", width: "1.5", type: "modifier" },
    { value: "\u3064", shiftValue: "\u3063" }, // つ → っ (Z)
    { value: "\u3055" }, // さ (X)
    { value: "\u305D" }, // そ (C)
    { value: "\u3072" }, // ひ (V)
    { value: "\u3053" }, // こ (B)
    { value: "\u307F" }, // み (N)
    { value: "\u3082" }, // も (M)
    { value: "\u306D", shiftValue: "\u3001" }, // ね → 、 (,)
    { value: "\u308B", shiftValue: "\u3002" }, // る → 。 (.)
    { value: "\u3081", shiftValue: "\u30FB" }, // め → ・ (/)
    { value: "{enter}", width: "1.5", type: "action" },
  ],
  // Row 5: bottom row
  [
    { value: "{layout:numeric}", label: "123", width: "1.5", type: "modifier" },
    { value: "{layout:ja-romaji}", label: "\u30ED\u30FC\u30DE\u5B57", type: "modifier" }, // ローマ字
    { value: " ", width: "space", type: "space" },
    { value: "\u30FC" }, // ー prolonged sound mark
    { value: "\u308D" }, // ろ (JIS \ key)
    { value: "\u3002" }, // 。 period (convenience)
    { value: "{layout:fkeys}", label: "Fn", width: "1.5", type: "modifier" },
  ],
];

_registerBuiltInLayout("ja-kana", jaKana);

export default jaKana;
