import type { LayoutDefinition } from "../types.js";
import fkeyRow from "./fkey-row.js";

/**
 * Two-row (2x6) form of the shared function-key row, for keyboards too narrow
 * to seat all twelve keys on one line (below roughly 35rem).
 *
 * Row 1 holds F1-F6, row 2 F7-F12, so F7 sits directly below F1. Both rows are
 * sliced from `fkeyRow`, so the two forms carry identical key definitions; the
 * standalone `fkeys` layout is built from this arrangement.
 * Arrow-key grid navigation follows the resolved layout, so focus moves between
 * the keys a user sees adjacent.
 *
 * @example <caption>Compact function keys above the built-in QWERTY layout</caption>
 * ```ts
 * import fkeyRowCompact from "kiosk-keyboard-webc/layouts/fkey-row-compact";
 *
 * const cl = document.createElement("kiosk-keyboard-custom-layout");
 * cl.slot = "customLayouts";
 * cl.name = "fk-qwerty";
 * cl.rows = [...fkeyRowCompact, ...qwerty];
 * kb.appendChild(cl);
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
