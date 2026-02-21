import type { LayoutDefinition } from "../types";

const nav: LayoutDefinition = [
  [
    { value: "{fkey:Home}", label: "Home", type: "modifier" },
    { value: "{fkey:ArrowUp}", label: "Up", type: "modifier" },
    { value: "{fkey:End}", label: "End", type: "modifier" },
  ],
  [
    { value: "{fkey:ArrowLeft}", label: "Left", type: "modifier" },
    { value: "{fkey:ArrowDown}", label: "Down", type: "modifier" },
    { value: "{fkey:ArrowRight}", label: "Right", type: "modifier" },
  ],
  [
    { value: "{fkey:PageUp}", label: "PgUp", type: "modifier" },
    { value: "{fkey:PageDown}", label: "PgDn", type: "modifier" },
    { value: "{enter}", label: "Enter", type: "action" },
  ],
  [
    { value: "{layout:base}", label: "ABC", width: "1.5", type: "modifier" },
    {
      value: "{backspace}",
      label: "",
      icon: "sap-icon://arrow-left",
      width: "1.5",
      type: "action",
    },
    { value: "{layout:fkeys}", label: "Fn", width: "1.5", type: "modifier" },
  ],
];

export default nav;
