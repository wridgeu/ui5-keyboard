import type { LayoutDefinition } from "../types.js";
import { _registerBuiltInLayout } from "../core/layout-registry.js";

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
      type: "action",
    },
  ],
  [
    {
      value: "{enter}",
      width: "space",
      type: "action",
    },
  ],
];

_registerBuiltInLayout("numpad", numpad);

export default numpad;
