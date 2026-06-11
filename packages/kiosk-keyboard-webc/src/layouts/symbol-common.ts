import type { KeyRow } from "../types.js";

/** Punctuation row shared by the numeric and special symbol layouts. */
export function punctuationRow(layoutSwitch: string, switchLabel: string): KeyRow {
  return [
    { value: layoutSwitch, label: switchLabel, width: "2.25", type: "modifier" },
    { value: "." },
    { value: "," },
    { value: "?" },
    { value: "!" },
    { value: "'" },
    { value: "{backspace}", label: "", width: "2.25", type: "action" },
  ];
}

/** Bottom row shared by the numeric and special symbol layouts. */
export const symbolBottomRow: KeyRow = [
  { value: "{layout:base}", label: "ABC", width: "1.5", type: "modifier" },
  { value: " ", width: "space", type: "space" },
  { value: "{enter}", width: "1.5", type: "action" },
];
