import type { KeyRow } from "../types";

/**
 * Shared navigation key row used by built-in `*-nav` variant layouts.
 *
 * Each key has a Unicode arrow/navigation icon alongside the text label.
 * At normal widths both render together (e.g. "⇱ Home"). At narrow widths
 * the dual key responsive pattern sr-only hides the label, leaving the
 * icon visible and distinct. Keys render as modifier keys (subdued background).
 *
 * Import this to compose custom variant layouts.
 *
 * @public
 */
const navRow: KeyRow = [
  { value: "{fkey:Home}", icon: "\u21F1", label: "Home", type: "modifier" },
  { value: "{fkey:ArrowUp}", icon: "\u2191", label: "Up", type: "modifier" },
  { value: "{fkey:End}", icon: "\u21F2", label: "End", type: "modifier" },
  { value: "{fkey:PageUp}", icon: "\u21DE", label: "PgUp", type: "modifier" },
  { value: "{fkey:PageDown}", icon: "\u21DF", label: "PgDn", type: "modifier" },
  { value: "{fkey:ArrowLeft}", icon: "\u2190", label: "Left", type: "modifier" },
  { value: "{fkey:ArrowDown}", icon: "\u2193", label: "Down", type: "modifier" },
  { value: "{fkey:ArrowRight}", icon: "\u2192", label: "Right", type: "modifier" },
];

export default navRow;
