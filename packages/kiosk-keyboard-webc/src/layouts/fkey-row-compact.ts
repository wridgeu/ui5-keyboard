import type { LayoutDefinition } from "../types.js";
import fkeyRow from "./fkey-row.js";

/**
 * Two-row (2x6) form of the shared function-key row, for keyboards too narrow
 * to seat all twelve keys on one line (below roughly 35rem).
 *
 * Row 1 holds F1-F6, row 2 F7-F12, so F7 sits directly below F1. Both rows are
 * sliced from `fkeyRow`, so the two forms carry identical key definitions; the
 * standalone `fkeys` layout is built from this arrangement.
 *
 * Because the arrangement is layout data rather than a CSS reflow of `fkeyRow`,
 * DOM order matches visual order: arrow-key grid navigation, which follows the
 * resolved layout, moves between the keys a user sees adjacent. A single
 * twelve-key row wrapped in CSS stays one logical row, so Down from F1 would
 * leave the function keys entirely instead of reaching F7.
 *
 * @example <caption>Compact function keys above the built-in QWERTY layout</caption>
 * ```ts
 * import fkeyRowCompact from "kiosk-keyboard-webc/layouts/fkey-row-compact";
 *
 * kb.instanceLayouts = { "fk-qwerty": [...fkeyRowCompact, ...qwerty] };
 * ```
 *
 * @public
 * @since 0.1.0
 */
const fkeyRowCompact: LayoutDefinition = [
  // Row 1: F1-F6
  fkeyRow.slice(0, 6),
  // Row 2: F7-F12
  fkeyRow.slice(6),
];

export default fkeyRowCompact;
