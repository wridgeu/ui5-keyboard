import type { LayoutDefinition } from "../types";

const qwertzDe: LayoutDefinition = [
  // Row 1: number row (German shift symbols)
  [
    { value: "1", shiftLabel: "!", shiftValue: "!" },
    { value: "2", shiftLabel: '"', shiftValue: '"' },
    { value: "3", shiftLabel: "\u00A7", shiftValue: "\u00A7" },
    { value: "4", shiftLabel: "$", shiftValue: "$" },
    { value: "5", shiftLabel: "%", shiftValue: "%" },
    { value: "6", shiftLabel: "&", shiftValue: "&" },
    { value: "7", shiftLabel: "/", shiftValue: "/" },
    { value: "8", shiftLabel: "(", shiftValue: "(" },
    { value: "9", shiftLabel: ")", shiftValue: ")" },
    { value: "0", shiftLabel: "=", shiftValue: "=" },
    {
      value: "{backspace}",
      label: "",
      icon: "sap-icon://arrow-left",
      width: "2",
      type: "action",
    },
  ],
  // Row 2: QWERTZ + \u00DC
  [
    { value: "q" },
    { value: "w" },
    { value: "e" },
    { value: "r" },
    { value: "t" },
    { value: "z" },
    { value: "u" },
    { value: "i" },
    { value: "o" },
    { value: "p" },
    { value: "\u00FC", shiftValue: "\u00DC" },
  ],
  // Row 3: ASDF + \u00D6 \u00C4
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
    { value: "\u00F6", shiftValue: "\u00D6" },
    { value: "\u00E4", shiftValue: "\u00C4" },
  ],
  // Row 4: YXCV + \u00DF + Shift/Enter
  [
    {
      value: "{shift}",
      label: "Shift",
      width: "1.75",
      type: "modifier",
    },
    { value: "y" },
    { value: "x" },
    { value: "c" },
    { value: "v" },
    { value: "b" },
    { value: "n" },
    { value: "m" },
    { value: "\u00DF", shiftLabel: "?", shiftValue: "?" },
    {
      value: "{enter}",
      label: "Enter",
      width: "1.75",
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
    { value: ",", shiftLabel: ";", shiftValue: ";" },
    { value: " ", label: "Space", width: "space", type: "space" },
    { value: ".", shiftLabel: ":", shiftValue: ":" },
    {
      value: "{layout:special}",
      label: "#+=",
      width: "1.5",
      type: "modifier",
    },
  ],
];

export default qwertzDe;
