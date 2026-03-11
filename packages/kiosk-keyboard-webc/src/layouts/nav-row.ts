import type { KeyRow } from "../types.js";

/**
 * Shared navigation key row used by built-in `*-nav` variant layouts.
 * Import this to compose custom variant layouts.
 */
const navRow: KeyRow = [
  { value: "{fkey:Home}", label: "Home" },
  { value: "{fkey:ArrowUp}", label: "Up" },
  { value: "{fkey:End}", label: "End" },
  { value: "{fkey:PageUp}", label: "PgUp" },
  { value: "{fkey:PageDown}", label: "PgDn" },
  { value: "{fkey:ArrowLeft}", label: "Left" },
  { value: "{fkey:ArrowDown}", label: "Down" },
  { value: "{fkey:ArrowRight}", label: "Right" },
];

export default navRow;
