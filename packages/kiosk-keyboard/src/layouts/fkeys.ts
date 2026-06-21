import type { LayoutDefinition } from "../types";
import fkeyRow from "./fkey-row";

/**
 * Standalone function-key layout (F1--F12).
 *
 * @public
 * @since 0.1.0
 */
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

export default fkeys;
