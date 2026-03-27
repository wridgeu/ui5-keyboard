import type { LayoutDefinition } from "../types";
import { punctuationRow, symbolBottomRow } from "./symbol-common";

const numeric: LayoutDefinition = [
  // Row 1
  [
    { value: "1" },
    { value: "2" },
    { value: "3" },
    { value: "4" },
    { value: "5" },
    { value: "6" },
    { value: "7" },
    { value: "8" },
    { value: "9" },
    { value: "0" },
  ],
  // Row 2: common symbols
  [
    { value: "-" },
    { value: "/" },
    { value: ":" },
    { value: ";" },
    { value: "(" },
    { value: ")" },
    { value: "$" },
    { value: "&" },
    { value: "@" },
    { value: '"' },
  ],
  // Row 3
  punctuationRow("{layout:special}", "#+="),
  // Row 4: bottom
  symbolBottomRow,
];

export default numeric;
