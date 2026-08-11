import { keyPositionOf, type KeyPosition } from "./dom-utils.js";
import { KIOSK_KEYBOARD_DOM } from "./dom-contract.js";
import type { LayoutDefinition } from "../types.js";

/**
 * Bridge to the host keyboard's rendered grid: the resolved layout (to compute
 * row/column bounds and clamp targets) and its shadow root (where keys live).
 */
export interface KeyGridNavigationHost {
  getResolvedLayout(): LayoutDefinition;
  getShadowRoot(): ShadowRoot | null;
  /** Whether the host renders right-to-left, mirroring the horizontal arrows. */
  isRtl(): boolean;
}

/**
 * Keyboard grid navigation for the web component (mirrors the UI5 control's
 * `KeyGridNavigation`, which attaches via `addDelegate`). Follows the WAI-ARIA
 * APG layout-grid arrow model: Up/Down move within the column and clamp onto a
 * narrower row, stopping at the top/bottom edge; the visually-forward arrow -
 * ArrowRight in LTR, ArrowLeft in RTL - moves within the row and continues onto
 * the adjacent row at a row boundary, and the visually-backward arrow does the
 * reverse, both stopping at the first/last key of the whole grid. Home/End move
 * within the current row (Ctrl+Home/End jump across the whole grid); Enter
 * activates on press and Space on release, matching native `<button>`. Focus never wraps
 * around grid edges. Handled navigation keys are always prevented (so holding an
 * arrow at an edge does not scroll the page), even when focus does not move.
 *
 * A hand-rolled roving tabindex rather than `@ui5/webcomponents-base`'s
 * `ItemNavigation`: that delegate models a uniform matrix sized by a single
 * `rowSize`, so it cannot express this keyboard's variable-width rows. The UI5
 * twin follows the `ItemNavigation` pattern by hand for the same reason.
 *
 * Navigation is driven by the resolved layout (logical rows/columns), not the
 * rendered geometry, so responsive reflow of the key faces does not affect it.
 *
 * Tracks the last focused key's grid position so the roving tabindex can be
 * restored after a re-render; the host reads it through {@link getLastFocusedKey}
 * and clears it on disconnect via {@link setLastFocusedKey}.
 */
export class KeyGridNavigation {
  private _lastFocusedKey: KeyPosition | null = null;
  private _spaceKeyDownTarget: HTMLElement | null = null;

  constructor(private readonly _host: KeyGridNavigationHost) {}

  getLastFocusedKey(): KeyPosition | null {
    return this._lastFocusedKey;
  }

  setLastFocusedKey(pos: KeyPosition | null): void {
    this._lastFocusedKey = pos;
  }

  onKeyDown(e: KeyboardEvent): void {
    const keyEl = (e.target as HTMLElement).closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook);
    if (!keyEl) return;

    const layout = this._host.getResolvedLayout();
    const from = keyPositionOf(keyEl);
    if (!from) return;

    let row = from.row;
    let col = from.col;

    // In RTL the row is mirrored (.kiosk-row is display:flex), so the arrow
    // that moves focus visually forward is ArrowLeft. Mirrors the variant popup.
    const forwardKey = this._host.isRtl() ? "ArrowLeft" : "ArrowRight";
    const backwardKey = this._host.isRtl() ? "ArrowRight" : "ArrowLeft";

    if (e.key === forwardKey) {
      if (col + 1 < (layout[row]?.length ?? 0)) {
        col += 1;
      } else if (row + 1 < layout.length) {
        // End of the row: continue onto the first key of the next row.
        row += 1;
        col = 0;
      }
      // Last key of the grid: stay put.
    } else if (e.key === backwardKey) {
      if (col - 1 >= 0) {
        col -= 1;
      } else if (row - 1 >= 0) {
        // Start of the row: continue onto the last key of the previous row.
        row -= 1;
        col = (layout[row]?.length ?? 1) - 1;
      }
      // First key of the grid: stay put.
    } else {
      switch (e.key) {
        case "ArrowDown":
          // Clamp the column onto a narrower row; stop at the bottom edge.
          if (row + 1 < layout.length) {
            row += 1;
            col = Math.min(col, (layout[row]?.length ?? 1) - 1);
          }
          break;
        case "ArrowUp":
          // Clamp the column onto a narrower row; stop at the top edge.
          if (row - 1 >= 0) {
            row -= 1;
            col = Math.min(col, (layout[row]?.length ?? 1) - 1);
          }
          break;
        case "Home":
          // Ctrl+Home jumps to the first key of the whole grid; plain Home
          // stays within the current row.
          if (e.ctrlKey) row = 0;
          col = 0;
          break;
        case "End":
          // Ctrl+End jumps to the last key of the whole grid; plain End
          // stays within the current row.
          if (e.ctrlKey) row = layout.length - 1;
          col = (layout[row]?.length ?? 1) - 1;
          break;
        case "Enter":
          // Activate only without modifiers: Ctrl+Enter and similar
          // combinations are browser/OS shortcuts, not key activations.
          if (e.ctrlKey || e.altKey || e.metaKey) return;
          keyEl.click();
          e.preventDefault();
          return;
        case " ":
          // Native `<button>` semantics: Space activates on release, not on
          // press, and does not repeat while held. Suppress the page scroll
          // here and remember the pressed key; onKeyUp performs the activation.
          if (e.ctrlKey || e.altKey || e.metaKey) return;
          this._spaceKeyDownTarget = keyEl;
          e.preventDefault();
          return;
        default:
          return;
      }
    }

    // A handled navigation key: always prevent the default (e.g. page scroll),
    // even at an edge where focus does not move.
    e.preventDefault();
    if (row === from.row && col === from.col) return;

    const nextEl =
      this._host.getShadowRoot()?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyByPosition(row, col)) ??
      null;
    if (nextEl) {
      keyEl.setAttribute("tabindex", "-1");
      nextEl.setAttribute("tabindex", "0");
      nextEl.focus();
      this._lastFocusedKey = { row, col };
    }
  }

  /**
   * Completes a Space activation on release, mirroring native `<button>`:
   * only the key that received the Space keydown activates, so a Space press
   * begun outside the grid never types a character on release.
   */
  onKeyUp(e: KeyboardEvent): void {
    if (e.key !== " ") return;
    const pressed = this._spaceKeyDownTarget;
    this._spaceKeyDownTarget = null;
    if (!pressed) return;
    const keyEl = (e.target as HTMLElement).closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook);
    if (keyEl !== pressed) return;
    e.preventDefault();
    keyEl.click();
  }
}
