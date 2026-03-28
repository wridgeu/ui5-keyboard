import type { KeyRow } from "../types";

/**
 * Shared navigation key row used by built-in `*-nav` variant layouts.
 *
 * Each key has a Unicode arrow/navigation icon that remains legible at
 * narrow widths (where the text label gets sr-only hidden via the dual
 * key responsive pattern). Keys render as modifier keys (subdued background).
 *
 * Import this to compose custom variant layouts.
 *
 * @public
 */
const navRow: KeyRow = [
  { value: "{fkey:Home}", icon: "\u21E4", label: "Home", type: "modifier" },
  { value: "{fkey:ArrowUp}", icon: "\u2191", label: "Up", type: "modifier" },
  { value: "{fkey:End}", icon: "\u21E5", label: "End", type: "modifier" },
  { value: "{fkey:PageUp}", icon: "\u21DE", label: "PgUp", type: "modifier" },
  { value: "{fkey:PageDown}", icon: "\u21DF", label: "PgDn", type: "modifier" },
  { value: "{fkey:ArrowLeft}", icon: "\u2190", label: "Left", type: "modifier" },
  { value: "{fkey:ArrowDown}", icon: "\u2193", label: "Down", type: "modifier" },
  { value: "{fkey:ArrowRight}", icon: "\u2192", label: "Right", type: "modifier" },
];

export default navRow;
