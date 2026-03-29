import type { LayoutDefinition } from "../types.js";
import { _registerBuiltInLayout } from "../core/layout-registry.js";
import fkeyRow from "./fkey-row.js";

const fkeys: LayoutDefinition = [
  // Row 1: F1-F6
  fkeyRow.slice(0, 6),
  // Row 2: F7-F12
  fkeyRow.slice(6),
  // Row 3: ABC + Nav + Enter
  [
    { value: "{layout:base}", label: "ABC", width: "1.5", type: "modifier" },
    { value: "{layout:nav}", label: "Nav", width: "1.5", type: "modifier" },
    { value: "{enter}", width: "1.5", type: "action" },
  ],
];

_registerBuiltInLayout("fkeys", fkeys);

export default fkeys;
