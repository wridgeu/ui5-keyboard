import type { LayoutDefinition } from "../types.js";
import { _registerBuiltInLayout } from "../core/layout-registry.js";

const qwertzDe: LayoutDefinition = [
  // Row 1: number row (German shift symbols)
  [
    { value: "1", shiftValue: "!" },
    { value: "2", shiftValue: '"' },
    { value: "3", shiftValue: "\u00A7" },
    { value: "4", shiftValue: "$" },
    { value: "5", shiftValue: "%" },
    { value: "6", shiftValue: "&" },
    { value: "7", shiftValue: "/" },
    { value: "8", shiftValue: "(" },
    { value: "9", shiftValue: ")" },
    { value: "0", shiftValue: "=" },
    {
      value: "{backspace}",
      width: "2",
      type: "action",
    },
  ],
  // Row 2: QWERTZ + ü
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
  // Row 3: ASDF + ö ä
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
  // Row 4: YXCV + ß + Shift/Enter
  [
    {
      value: "{shift}",
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
    { value: "\u00DF", shiftValue: "?" },
    {
      value: "{enter}",
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
    { value: ",", shiftValue: ";" },
    { value: " ", width: "space", type: "space" },
    { value: ".", shiftValue: ":" },
    {
      value: "{layout:fkeys}",
      label: "Fn",
      width: "1.5",
      type: "modifier",
    },
  ],
];

_registerBuiltInLayout("qwertz-de", qwertzDe);

export default qwertzDe;
