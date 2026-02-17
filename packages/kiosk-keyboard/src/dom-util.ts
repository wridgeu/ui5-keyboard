/**
 * Regex to extract row and column indices from a key element ID.
 *
 * Key elements use the pattern `{controlId}-key-{row}-{col}`.
 * This regex is shared between the renderer (which constructs IDs)
 * and the control (which parses them for focus navigation).
 */
export const KEY_ID_SUFFIX_RE = /-key-(\d+)-(\d+)$/;

/**
 * Constructs the DOM element ID for a key at a given grid position.
 *
 * @param controlId - The owning control's ID (`oControl.getId()`)
 * @param row - Zero-based row index
 * @param col - Zero-based column index
 */
export function keyElementId(controlId: string, row: number, col: number): string {
  return `${controlId}-key-${row}-${col}`;
}
