import type { LayoutDefinition } from "../types.js";

const jaRomaji: LayoutDefinition = [
  // Row 1: number row (JIS shifted symbols)
  [
    { value: "1", shiftValue: "!" },
    { value: "2", shiftValue: '"' },
    { value: "3", shiftValue: "#" },
    { value: "4", shiftValue: "$" },
    { value: "5", shiftValue: "%" },
    { value: "6", shiftValue: "&" },
    { value: "7", shiftValue: "'" },
    { value: "8", shiftValue: "(" },
    { value: "9", shiftValue: ")" },
    { value: "0", shiftValue: "~" },
    {
      value: "{backspace}",
      width: "2",
      type: "action",
    },
  ],
  // Row 2: QWERTY
  [
    { value: "q" },
    { value: "w" },
    { value: "e" },
    { value: "r" },
    { value: "t" },
    { value: "y" },
    { value: "u" },
    { value: "i" },
    { value: "o" },
    { value: "p" },
  ],
  // Row 3: ASDF
  [
    { value: "a" },
    { value: "s" },
    { value: "d" },
    { value: "f" },
    { value: "g" },
    { value: "h" },
    { value: "j" },
    { value: "k" },
    { value: "l" },
  ],
  // Row 4: ZXCV + Shift/Enter
  [
    {
      value: "{shift}",
      width: "2.25",
      type: "modifier",
    },
    { value: "z" },
    { value: "x" },
    { value: "c" },
    { value: "v" },
    { value: "b" },
    { value: "n" },
    { value: "m" },
    {
      value: "{enter}",
      width: "2.25",
      type: "action",
    },
  ],
  // Row 5: bottom row (Japanese punctuation)
  [
    {
      value: "{layout:numeric}",
      label: "123",
      width: "1.5",
      type: "modifier",
    },
    { value: "\u3001", shiftValue: "\u30FB" },
    { value: " ", label: "Space", width: "space", type: "space" },
    { value: "\u3002", shiftValue: "\u300C" },
    {
      value: "{layout:fkeys}",
      label: "Fn",
      width: "1.5",
      type: "modifier",
    },
  ],
];

export default jaRomaji;
