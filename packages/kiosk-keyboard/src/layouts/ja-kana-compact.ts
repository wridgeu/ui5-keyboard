import type { KeyRow, LayoutDefinition } from "../types";
import jaKana from "./ja-kana";

// `jaKana`'s five rows: digits, upper letters, home, lower letters, bottom. Every
// key below is sliced out of them, so the two forms carry identical key
// definitions, shift layers and types included. Only the spacebar's span differs,
// and it is rewritten at its own position.
const [digitRow, upperRow, homeRow, lowerRow, bottomRow] = jaKana as [KeyRow, KeyRow, KeyRow, KeyRow, KeyRow];

/**
 * Japanese kana direct-input layout for narrow keyboards, holding every row to
 * twelve key widths.
 *
 * The wide `ja-kana` seats Backspace on the digit row and Shift and Enter on the
 * lower kana row, which at 1.5x each push those rows to 12.5 and 13 widths. In a
 * keyboard narrower than about 20rem the inline target-size floor is lifted so a
 * row fits at all, and at that density the keys fall below the 24 CSS px spacing
 * [WCAG 2.2 SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
 * accepts in place of a 24px target: in a 320px keyboard the lower row measures
 * 23.4px between key centres. Collecting the three action keys into a row of their
 * own leaves the kana rows at twelve widths, which measures 24.7px there. The
 * arrangement holds the criterion down to a keyboard of about 312px; below that no
 * kana layout does, since the JIS upper and home rows are twelve keys on their own.
 *
 * Restoring ー and ろ to their JIS positions (the `¥` and `\` keys, at the ends of
 * the digit and lower rows) is what frees the room. The wide form's standalone 。
 * is dropped, duplicating as it does the shift layer of る, which this form keeps.
 * The spacebar takes 2.75 widths rather than the usual 6, the action row it now
 * shares being otherwise full.
 *
 * Arrow-key grid navigation follows the resolved layout, so focus moves between
 * the keys a user sees adjacent.
 *
 * `ja-kana` declares this as its compact counterpart, so a keyboard does not have to
 * pick between the two itself: `autoCompact` hands over to this form while the
 * keyboard is too narrow to seat the wide rows and takes `ja-kana` back when the room
 * returns, measuring the keyboard's own box rather than the viewport. Naming this
 * layout outright pins it at every width.
 *
 * @example <caption>Letting the width pick the form</caption>
 * ```ts
 * new KioskKeyboard({ layout: "ja-kana", autoCompact: true, controls: ["myInput"] });
 * ```
 *
 * @see {@link https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/fe_kbds/jpn/106/kbd106.c | Microsoft kbd106.c}
 * @public
 * @since 0.1.0
 */
const jaKanaCompact: LayoutDefinition = [
  // Row 1: number row, ー back on the JIS ¥ key in the space Backspace leaves
  [...digitRow.slice(0, -1), ...bottomRow.slice(3, 4)],
  // Row 2: upper letter row + dakuten/handakuten, as in the wide form
  upperRow,
  // Row 3: home row, as in the wide form
  homeRow,
  // Row 4: lower letter row, ろ back on the JIS \ key in the space Shift and Enter leave
  [...lowerRow.slice(1, -1), ...bottomRow.slice(4, 5)],
  // Row 5: the action and layout-switch keys the kana rows no longer carry
  [
    ...lowerRow.slice(0, 1), // {shift}
    ...bottomRow.slice(0, 2), // {layout:numeric}, {layout:ja-romaji}
    ...bottomRow.slice(2, 3).map((key): KeyRow[number] => ({ ...key, width: "2.75" })), // space
    ...bottomRow.slice(-1), // {layout:fkeys}
    ...digitRow.slice(-1), // {backspace}
    ...lowerRow.slice(-1), // {enter}
  ],
];

export default jaKanaCompact;
