import type { LayoutDefinition } from "../types";

/**
 * Spanish QWERTY keyboard layout (Spain, ISO).
 *
 * Based on the standard US QWERTY with Spanish-specific additions:
 * - Dedicated ñ key on the home row (after L)
 * - Accented vowels (á, é, í, ó, ú) on the shift layer of their base vowels
 * - Inverted punctuation ¿ and ¡ accessible from the bottom row
 * - Standard Caps Lock still provides uppercase letters
 *
 * The shift layer trades uppercase for accented vowels, following the
 * convention of mobile Spanish keyboards where accented characters are
 * more frequently needed than uppercase in running text. Uppercase is
 * available via Caps Lock.
 *
 * @see {@link https://en.wikipedia.org/wiki/QWERTY#Spanish | Spanish QWERTY layout}
 * @public
 */
const qwertyEs: LayoutDefinition = [
  // Row 1: number row
  [
    { value: "1", shiftValue: "!" },
    { value: "2", shiftValue: '"' },
    { value: "3", shiftValue: "#" },
    { value: "4", shiftValue: "$" },
    { value: "5", shiftValue: "%" },
    { value: "6", shiftValue: "&" },
    { value: "7", shiftValue: "/" },
    { value: "8", shiftValue: "(" },
    { value: "9", shiftValue: ")" },
    { value: "0", shiftValue: "=" },
    { value: "{backspace}", width: "2", type: "action" },
  ],
  // Row 2: QWERTY with accented vowels on shift
  [
    { value: "q" },
    { value: "w" },
    { value: "e", shiftValue: "\u00E9" }, // é
    { value: "r" },
    { value: "t" },
    { value: "y" },
    { value: "u", shiftValue: "\u00FA" }, // ú
    { value: "i", shiftValue: "\u00ED" }, // í
    { value: "o", shiftValue: "\u00F3" }, // ó
    { value: "p" },
  ],
  // Row 3: home row with ñ
  [
    { value: "a", shiftValue: "\u00E1" }, // á
    { value: "s" },
    { value: "d" },
    { value: "f" },
    { value: "g" },
    { value: "h" },
    { value: "j" },
    { value: "k" },
    { value: "l" },
    { value: "\u00F1" }, // ñ (auto-uppercases to Ñ with shift/caps)
  ],
  // Row 4: lower row + shift/enter
  [
    { value: "{shift}", width: "2.25", type: "modifier" },
    { value: "z" },
    { value: "x" },
    { value: "c" },
    { value: "v" },
    { value: "b" },
    { value: "n" },
    { value: "m" },
    { value: "{enter}", width: "2.25", type: "action" },
  ],
  // Row 5: bottom row
  [
    { value: "{layout:numeric}", label: "123", width: "1.5", type: "modifier" },
    { value: ",", shiftValue: ";" },
    { value: " ", width: "space", type: "space" },
    { value: ".", shiftValue: ":" },
    { value: "\u00BF", shiftValue: "\u00A1" }, // ¿ → ¡
    { value: "{layout:fkeys}", label: "Fn", width: "1.5", type: "modifier" },
  ],
];

export default qwertyEs;
