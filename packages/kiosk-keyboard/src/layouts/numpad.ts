import type { LayoutDefinition } from "../types";

const numpad: LayoutDefinition = [
  [{ value: "7" }, { value: "8" }, { value: "9" }],
  [{ value: "4" }, { value: "5" }, { value: "6" }],
  [{ value: "1" }, { value: "2" }, { value: "3" }],
  [
    { value: "." },
    { value: "0" },
    {
      value: "{backspace}",
      label: "",
      icon: "sap-icon://arrow-left",
      type: "action",
    },
  ],
  [
    {
      value: "{enter}",
      label: "Enter",
      width: "space",
      type: "action",
    },
  ],
];

export default numpad;
