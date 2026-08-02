import type { LayoutDefinition } from "../types.js";
import fkeyRowCompact from "./fkey-row-compact.js";

/**
 * Standalone function-key layout (F1--F12).
 *
 * @public
 * @since 0.1.0
 */
const fkeys: LayoutDefinition = [
  // Rows 1-2: F1-F6 over F7-F12
  ...fkeyRowCompact,
  // Row 3: ABC + Nav + Enter
  [
    { value: "{layout:base}", label: "ABC", width: "1.5", type: "modifier" },
    { value: "{layout:nav}", label: "Nav", width: "1.5", type: "modifier" },
    { value: "{enter}", width: "1.5", type: "action" },
  ],
];

export default fkeys;
