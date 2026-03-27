import type { LayoutDefinition } from "../types";

const qwerty: LayoutDefinition = [
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
  // Row 4: ZXCV + Shift
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
  // Row 5: bottom row
  [
    {
      value: "{layout:numeric}",
      label: "123",
      width: "1.5",
      type: "modifier",
    },
    { value: ",", shiftValue: "<" },
    { value: " ", width: "space", type: "space" },
    { value: ".", shiftValue: ">" },
    {
      value: "{layout:fkeys}",
      label: "Fn",
      width: "1.5",
      type: "modifier",
    },
  ],
];

export default qwerty;
