import type { LayoutDefinition } from "../types";

const nav: LayoutDefinition = [
  [
    { value: "{fkey:Home}", label: "Home" },
    { value: "{fkey:ArrowUp}", label: "Up" },
    { value: "{fkey:End}", label: "End" },
  ],
  [
    { value: "{fkey:ArrowLeft}", label: "Left" },
    { value: "{fkey:ArrowDown}", label: "Down" },
    { value: "{fkey:ArrowRight}", label: "Right" },
  ],
  [
    { value: "{fkey:PageUp}", label: "PgUp" },
    { value: "{fkey:PageDown}", label: "PgDn" },
    { value: "{enter}", type: "action" },
  ],
  [
    { value: "{layout:base}", label: "ABC", width: "1.5", type: "modifier" },
    {
      value: "{backspace}",
      label: "",
      width: "1.5",
      type: "action",
    },
    { value: "{layout:fkeys}", label: "Fn", width: "1.5", type: "modifier" },
  ],
];

export default nav;
