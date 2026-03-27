import type { LayoutDefinition } from "../types.js";

const arabic: LayoutDefinition = [
  // Row 1: Western Arabic numerals (default), Arabic-Indic on shift
  [
    { value: "1", shiftValue: "\u0661" },
    { value: "2", shiftValue: "\u0662" },
    { value: "3", shiftValue: "\u0663" },
    { value: "4", shiftValue: "\u0664" },
    { value: "5", shiftValue: "\u0665" },
    { value: "6", shiftValue: "\u0666" },
    { value: "7", shiftValue: "\u0667" },
    { value: "8", shiftValue: "\u0668" },
    { value: "9", shiftValue: "\u0669" },
    { value: "0", shiftValue: "\u0660" },
    {
      value: "{backspace}",
      width: "2",
      type: "action",
    },
  ],
  // Row 2: Arabic letters (standard Arabic 101 top row)
  [
    { value: "\u0636", shiftValue: "\u0651" },
    { value: "\u0635", shiftValue: "\u064B" },
    { value: "\u062B", shiftValue: "\u064C" },
    { value: "\u0642", shiftValue: "\u064D" },
    { value: "\u0641", shiftValue: "\u064E" },
    { value: "\u063A", shiftValue: "\u064F" },
    { value: "\u0639", shiftValue: "\u0650" },
    { value: "\u0647", shiftValue: "\u0652" },
    { value: "\u062E", shiftValue: "\u0623" },
    { value: "\u062D", shiftValue: "\u0625" },
    { value: "\u062C", shiftValue: "\u0627\u0653" },
  ],
  // Row 3: Arabic letters (home row)
  [
    { value: "\u0634", shiftValue: "\u0624" },
    { value: "\u0633", shiftValue: "\u0626" },
    { value: "\u064A", shiftValue: "\u0649" },
    { value: "\u0628", shiftValue: "\u0644\u0627" },
    { value: "\u0644", shiftValue: "\u0644\u0623" },
    { value: "\u0627", shiftValue: "\u0644\u0625" },
    { value: "\u062A", shiftValue: "\u0640" },
    { value: "\u0646", shiftValue: "\u060C" },
    { value: "\u0645", shiftValue: "/" },
    { value: "\u0643", shiftValue: ":" },
    { value: "\u062F", shiftValue: '"' },
  ],
  // Row 4: Arabic letters (bottom row) + Shift/Enter
  [
    {
      value: "{shift}",
      width: "2.25",
      type: "modifier",
    },
    { value: "\u0626", shiftValue: "~" },
    { value: "\u0621", shiftValue: "\u0652" },
    { value: "\u0624", shiftValue: "{" },
    { value: "\u0631", shiftValue: "}" },
    { value: "\u0649", shiftValue: "\u0622" },
    { value: "\u0629", shiftValue: "\u2018" },
    { value: "\u0648", shiftValue: "\u2019" },
    { value: "\u0632", shiftValue: "," },
    { value: "\u0638", shiftValue: "." },
    {
      value: "{enter}",
      width: "2.25",
      type: "action",
    },
  ],
  // Row 5: bottom row (Arabic punctuation)
  [
    {
      value: "{layout:numeric}",
      label: "123",
      width: "1.5",
      type: "modifier",
    },
    { value: "\u060C", shiftValue: "\u061B" },
    { value: " ", width: "space", type: "space" },
    { value: ".", shiftValue: "\u061F" },
    {
      value: "{layout:fkeys}",
      label: "Fn",
      width: "1.5",
      type: "modifier",
    },
  ],
];

export default arabic;
