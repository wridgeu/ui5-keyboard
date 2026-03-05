import type { LayoutDefinition } from "../types.js";

const numeric: LayoutDefinition = [
  // Row 1
  [
    { value: "1" },
    { value: "2" },
    { value: "3" },
    { value: "4" },
    { value: "5" },
    { value: "6" },
    { value: "7" },
    { value: "8" },
    { value: "9" },
    { value: "0" },
  ],
  // Row 2: common symbols
  [
    { value: "-" },
    { value: "/" },
    { value: ":" },
    { value: ";" },
    { value: "(" },
    { value: ")" },
    { value: "$" },
    { value: "&" },
    { value: "@" },
    { value: '"' },
  ],
  // Row 3
  [
    {
      value: "{layout:special}",
      label: "#+=",
      width: "2.25",
      type: "modifier",
    },
    { value: "." },
    { value: "," },
    { value: "?" },
    { value: "!" },
    { value: "'" },
    {
      value: "{backspace}",
      label: "",
      width: "2.25",
      type: "action",
    },
  ],
  // Row 4: bottom
  [
    {
      value: "{layout:base}",
      label: "ABC",
      width: "1.5",
      type: "modifier",
    },
    { value: " ", width: "space", type: "space" },
    {
      value: "{enter}",
      width: "1.5",
      type: "action",
    },
  ],
];

export default numeric;
