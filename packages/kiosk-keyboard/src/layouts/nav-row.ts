import type { KeyRow } from "../types";

/**
 * Shared navigation key row used by built-in `*-nav` variant layouts.
 * Import this to compose custom variant layouts.
 *
 * @public
 */
const navRow: KeyRow = [
  { value: "{fkey:Home}", label: "Home", type: "modifier" },
  { value: "{fkey:ArrowUp}", label: "Up", type: "modifier" },
  { value: "{fkey:End}", label: "End", type: "modifier" },
  { value: "{fkey:PageUp}", label: "PgUp", type: "modifier" },
  { value: "{fkey:PageDown}", label: "PgDn", type: "modifier" },
  { value: "{fkey:ArrowLeft}", label: "Left", type: "modifier" },
  { value: "{fkey:ArrowDown}", label: "Down", type: "modifier" },
  { value: "{fkey:ArrowRight}", label: "Right", type: "modifier" },
];

export default navRow;
