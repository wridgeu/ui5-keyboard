import type { LayoutDefinition } from "../types";
import navRow from "./nav-row";

/**
 * Two-row (2x4) form of the shared navigation row, for keyboards too narrow to
 * seat all eight keys on one line (below roughly 20rem, where a single row
 * leaves each key around 30px wide).
 *
 * Row 1 holds the position cluster, row 2 the arrows with Page Down trailing,
 * so Up sits directly above Down with Left and Right flanking it. Both rows are
 * sliced from `navRow`, so the two forms carry identical key definitions.
 *
 * Because the arrangement is layout data rather than a CSS reflow of `navRow`,
 * DOM order matches visual order: arrow-key grid navigation, which follows the
 * resolved layout, moves between the keys a user sees adjacent.
 *
 * @example <caption>A compact navigation row above the built-in QWERTY layout</caption>
 * ```ts
 * import navRowCompact from "ui5/kiosk/layouts/nav-row-compact";
 *
 * new KioskKeyboard({
 *   layout: "nav-qwerty",
 *   instanceLayouts: { "nav-qwerty": KioskKeyboard.composeLayout(navRowCompact, "qwerty") },
 * });
 * ```
 *
 * @public
 * @since 0.1.0
 */
const navRowCompact: LayoutDefinition = [
  // Row 1: Home / Up / End / PgUp
  navRow.slice(0, 4),
  // Row 2: Left / Down / Right / PgDn
  [...navRow.slice(5, 8), ...navRow.slice(4, 5)],
];

export default navRowCompact;
