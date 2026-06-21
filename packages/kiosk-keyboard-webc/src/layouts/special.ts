import type { LayoutDefinition } from "../types.js";
import { punctuationRow, symbolBottomRow } from "./symbol-common.js";

/**
 * Special characters and symbols layout.
 *
 * @public
 * @since 0.1.0
 */
const special: LayoutDefinition = [
  // Row 1
  [
    { value: "[" },
    { value: "]" },
    { value: "{" },
    { value: "}" },
    { value: "#" },
    { value: "%" },
    { value: "^" },
    { value: "*" },
    { value: "+" },
    { value: "=" },
  ],
  // Row 2
  [
    { value: "_" },
    { value: "\\" },
    { value: "|" },
    { value: "~" },
    { value: "<" },
    { value: ">" },
    { value: "\u20AC" },
    { value: "\u00A3" },
    { value: "\u00A5" },
    { value: "\u2022" },
  ],
  // Row 3
  punctuationRow("{layout:numeric}", "123"),
  // Row 4: bottom
  symbolBottomRow,
];

export default special;
