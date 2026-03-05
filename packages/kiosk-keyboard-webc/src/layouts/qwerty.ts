import type { LayoutDefinition } from "../types.js";

const qwerty: LayoutDefinition = [
  // Row 1: number row
  [
    { value: "1", shiftLabel: "!", shiftValue: "!" },
    { value: "2", shiftLabel: "@", shiftValue: "@" },
    { value: "3", shiftLabel: "#", shiftValue: "#" },
    { value: "4", shiftLabel: "$", shiftValue: "$" },
    { value: "5", shiftLabel: "%", shiftValue: "%" },
    { value: "6", shiftLabel: "^", shiftValue: "^" },
    { value: "7", shiftLabel: "&", shiftValue: "&" },
    { value: "8", shiftLabel: "*", shiftValue: "*" },
    { value: "9", shiftLabel: "(", shiftValue: "(" },
    { value: "0", shiftLabel: ")", shiftValue: ")" },
    {
      value: "{backspace}",
      label: "",
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
    { value: ",", shiftLabel: "<", shiftValue: "<" },
    { value: " ", label: "Space", width: "space", type: "space" },
    { value: ".", shiftLabel: ">", shiftValue: ">" },
    {
      value: "{layout:fkeys}",
      label: "Fn",
      width: "1.5",
      type: "modifier",
    },
  ],
];

export default qwerty;
