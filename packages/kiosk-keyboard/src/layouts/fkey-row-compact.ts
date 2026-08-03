import type { LayoutDefinition } from "../types";
import fkeyRow from "./fkey-row";

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
 * import fkeyRowCompact from "ui5/kiosk/layouts/fkey-row-compact";
 *
 * new KioskKeyboard({
 *   layout: "fk-qwerty",
 *   customLayouts: [
 *     new CustomLayout({ name: "fk-qwerty", rows: KioskKeyboard.composeLayout(fkeyRowCompact, "qwerty") }),
 *   ],
 * });
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
