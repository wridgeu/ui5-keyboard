import type { LayoutDefinition } from "../types.js";

const special: LayoutDefinition = [
  // Row 1
  [
    { value: "[" },
    { value: "]" },
    { value: "{" },
    { value: "}" },
    { value: "#" },
    { value: "%" },
    { value: "^" },
    { value: "*" },
    { value: "+" },
    { value: "=" },
  ],
  // Row 2
  [
    { value: "_" },
    { value: "\\" },
    { value: "|" },
    { value: "~" },
    { value: "<" },
    { value: ">" },
    { value: "\u20AC" },
    { value: "\u00A3" },
    { value: "\u00A5" },
    { value: "\u2022" },
  ],
  // Row 3
  [
    {
      value: "{layout:numeric}",
      label: "123",
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
    { value: " ", label: "Space", width: "space", type: "space" },
    {
      value: "{enter}",
      width: "1.5",
      type: "action",
    },
  ],
];

export default special;
