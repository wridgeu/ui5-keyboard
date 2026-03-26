import type { LayoutDefinition } from "../types.js";

const fkeys: LayoutDefinition = [
  // Row 1: F1-F6
  [
    { value: "{fkey:F1}", label: "F1", type: "modifier" },
    { value: "{fkey:F2}", label: "F2", type: "modifier" },
    { value: "{fkey:F3}", label: "F3", type: "modifier" },
    { value: "{fkey:F4}", label: "F4", type: "modifier" },
    { value: "{fkey:F5}", label: "F5", type: "modifier" },
    { value: "{fkey:F6}", label: "F6", type: "modifier" },
  ],
  // Row 2: F7-F12
  [
    { value: "{fkey:F7}", label: "F7", type: "modifier" },
    { value: "{fkey:F8}", label: "F8", type: "modifier" },
    { value: "{fkey:F9}", label: "F9", type: "modifier" },
    { value: "{fkey:F10}", label: "F10", type: "modifier" },
    { value: "{fkey:F11}", label: "F11", type: "modifier" },
    { value: "{fkey:F12}", label: "F12", type: "modifier" },
  ],
  // Row 3: ABC + Nav + Enter
  [
    { value: "{layout:base}", label: "ABC", width: "1.5", type: "modifier" },
    { value: "{layout:nav}", label: "Nav", width: "1.5", type: "modifier" },
    { value: "{enter}", width: "1.5", type: "action" },
  ],
];

export default fkeys;
