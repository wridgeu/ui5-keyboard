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
  /** Whether the host is disabled, asked per event: the flag flips under focus. */
  isDisabled(): boolean;
  /** The keycap held down by a keyboard activation, or `null` between activations. */
  setPressedKey(pos: KeyPosition | null): void;
}

/** The horizontal arrows swap roles when the row is rendered right-to-left. */
const MIRRORED_ARROWS: Readonly<Record<string, string>> = { ArrowLeft: "ArrowRight", ArrowRight: "ArrowLeft" };

/** Index of the last key in `row`. */
function lastCol(layout: LayoutDefinition, row: number): number {
  return (layout[row]?.length ?? 1) - 1;
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
 * activates on press and Space on release, matching native `<button>`, and Shift
 * held on either types the key's shifted glyph. Focus never wraps around grid
 * edges. Handled navigation keys are always prevented (so holding an arrow at an
 * edge does not scroll the page), even when focus does not move.
 *
 * The activated key carries `keyPressed` for as long as the activating key is
 * held, so a keyboard activation gives the feedback a pointer press gets from
 * `:active`, which never matches on a `<div role="button">`.
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
  /** The keycap holding a Space press, and the Shift that press carried. */
  private _spaceKeyDown: { el: HTMLElement; shift: boolean } | null = null;

  constructor(private readonly _host: KeyGridNavigationHost) {}

  getLastFocusedKey(): KeyPosition | null {
    return this._lastFocusedKey;
  }

  setLastFocusedKey(pos: KeyPosition | null): void {
    this._lastFocusedKey = pos;
  }

  onKeyDown(e: KeyboardEvent): void {
    // A disabled keyboard handles no key: no move, no rewrite of the
    // `tabindex="-1"` the template renders while disabled, no press feedback.
    if (this._host.isDisabled()) return;
    // SAFETY: the template binds this to `keydown` on the keyboard root inside the
    // shadow root, so the target is one of the HTML elements rendered there; `closest`
    // then yields a keycap or null, and null returns early.
    const keyEl = (e.target as HTMLElement).closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook);
    if (!keyEl) return;

    const layout = this._host.getResolvedLayout();
    const from = keyPositionOf(keyEl);
    if (!from) return;

    if (e.key === "Enter" || e.key === " ") {
      this._onActivationKey(e, keyEl);
      return;
    }

    const to = this._navigationTarget(e, from, layout);
    if (!to) return;
    // A handled navigation key: always prevent the default (e.g. page scroll),
    // even at an edge where focus does not move.
    e.preventDefault();
    if (to.row === from.row && to.col === from.col) return;

    const nextEl =
      this._host
        .getShadowRoot()
        ?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyByPosition(to.row, to.col)) ?? null;
    if (nextEl) {
      keyEl.setAttribute("tabindex", "-1");
      nextEl.setAttribute("tabindex", "0");
      nextEl.focus();
      this._lastFocusedKey = to;
    }
  }

  /**
   * The grid position a navigation key moves focus to: `from` itself at a grid
   * edge, or `null` for a key that is not navigation.
   */
  private _navigationTarget(e: KeyboardEvent, from: KeyPosition, layout: LayoutDefinition): KeyPosition | null {
    let { row, col } = from;
    // In RTL the row is mirrored (.kiosk-row is display:flex), so the arrow
    // that moves focus visually forward is ArrowLeft. Mirrors the variant popup.
    const key = this._host.isRtl() ? (MIRRORED_ARROWS[e.key] ?? e.key) : e.key;

    switch (key) {
      case "ArrowRight":
        if (col < lastCol(layout, row)) {
          col += 1;
        } else if (row + 1 < layout.length) {
          // End of the row: continue onto the first key of the next row.
          row += 1;
          col = 0;
        }
        // Last key of the grid: stay put.
        break;
      case "ArrowLeft":
        if (col > 0) {
          col -= 1;
        } else if (row > 0) {
          // Start of the row: continue onto the last key of the previous row.
          row -= 1;
          col = lastCol(layout, row);
        }
        // First key of the grid: stay put.
        break;
      case "ArrowDown":
        // Clamp the column onto a narrower row; stop at the bottom edge.
        if (row + 1 < layout.length) {
          row += 1;
          col = Math.min(col, lastCol(layout, row));
        }
        break;
      case "ArrowUp":
        // Clamp the column onto a narrower row; stop at the top edge.
        if (row > 0) {
          row -= 1;
          col = Math.min(col, lastCol(layout, row));
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
        col = lastCol(layout, row);
        break;
      default:
        return null;
    }
    return { row, col };
  }

  /**
   * Enter activates on press and Space on release, matching native `<button>`.
   * Only without Ctrl/Alt/Meta: those combinations are browser/OS shortcuts,
   * not key activations. Shift is the exception - it means "type the shifted
   * glyph" (see `_activate`).
   */
  private _onActivationKey(e: KeyboardEvent, keyEl: HTMLElement): void {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    e.preventDefault();
    if (e.key === "Enter") {
      // One activation per press: drop the OS auto-repeat keydowns.
      // `{backspace}` is the only key that repeats, from pointer input on
      // `BackspaceRepeatController`'s tuned curve.
      if (e.repeat) return;
      this._press(keyEl);
      this._activate(keyEl, e.shiftKey);
      return;
    }
    // Space does not repeat while held. Suppress the page scroll here and
    // remember the pressed key; onKeyUp performs the activation. The Shift
    // comes from the press, not the release: nothing makes the user lift two
    // keys under different hands in a fixed order.
    this._spaceKeyDown = { el: keyEl, shift: e.shiftKey };
    this._press(keyEl);
  }

  /**
   * Completes a Space activation on release, mirroring native `<button>`:
   * only the key that received the Space keydown activates, so a Space press
   * begun outside the grid never types a character on release.
   */
  onKeyUp(e: KeyboardEvent): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    this._release();
    if (e.key !== " ") return;

    const pressed = this._spaceKeyDown;
    this._spaceKeyDown = null;
    // `_release()` above runs either way: a keyboard disabled between the press
    // and the release must still drop the press feedback it left painted.
    if (!pressed || this._host.isDisabled()) return;
    // SAFETY: the template binds this to `keyup` on the keyboard root inside the shadow
    // root, so the target is one of the HTML elements rendered there; `closest` then
    // yields a keycap or null, and only an exact match with the pressed key activates.
    const keyEl = (e.target as HTMLElement).closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook);
    if (keyEl !== pressed.el) return;
    e.preventDefault();
    this._activate(keyEl, pressed.shift);
  }

  /**
   * Alt-Tab and similar take focus away without ever delivering the keyup, so
   * the pressed state would otherwise stick on the abandoned keycap. Also drops
   * the pending Space target: its release can no longer land on this key.
   */
  onFocusOut(): void {
    this._spaceKeyDown = null;
    this._release();
  }

  /**
   * Activates `keyEl` through the same click path a pointer press takes, so
   * there is one activation pipeline rather than two.
   *
   * `HTMLElement.click()` cannot carry a modifier, so the event is built by
   * hand: Shift on the activating keystroke means "type the shifted glyph",
   * which the click handler reads off `shiftKey` exactly as it would from a
   * real Shift+click.
   */
  private _activate(keyEl: HTMLElement, shiftKey: boolean): void {
    keyEl.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey }));
  }

  private _press(keyEl: HTMLElement): void {
    this._host.setPressedKey(keyPositionOf(keyEl));
    keyEl.classList.add(KIOSK_KEYBOARD_DOM.classes.keyPressed);
  }

  private _release(): void {
    this._host.setPressedKey(null);
    this._host
      .getShadowRoot()
      ?.querySelectorAll<HTMLElement>(`.${KIOSK_KEYBOARD_DOM.classes.keyPressed}`)
      .forEach((el) => el.classList.remove(KIOSK_KEYBOARD_DOM.classes.keyPressed));
  }
}
