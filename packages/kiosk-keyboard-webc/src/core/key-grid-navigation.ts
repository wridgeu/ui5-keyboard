import { KEY_ID_SUFFIX_RE, keyElementId } from "./dom-utils.js";
import { KIOSK_KEYBOARD_DOM } from "./dom-contract.js";
import type { LayoutDefinition } from "../types.js";

/**
 * Bridge to the host keyboard's rendered grid: the resolved layout (to compute
 * row/column bounds and wrapping), its shadow root (where keys live), and its
 * component id (to build key element ids).
 */
export interface KeyGridNavigationHost {
  getResolvedLayout(): LayoutDefinition;
  getShadowRoot(): ShadowRoot | null;
  getComponentId(): string;
}

/**
 * Keyboard grid navigation for the web component (mirrors the UI5 control's
 * `KeyGridNavigation`, which attaches via `addDelegate`). Handles arrow-key
 * movement with column clamping on vertical moves and within-row wrapping on
 * horizontal moves, plus Home/End (Ctrl+Home/End jump across the whole grid)
 * and Enter/Space activation.
 *
 * A hand-rolled roving tabindex rather than `@ui5/webcomponents-base`'s
 * `ItemNavigation`: that delegate models a uniform matrix sized by a single
 * `rowSize`, so it cannot express this keyboard's variable-width rows. The UI5
 * twin follows the `ItemNavigation` pattern by hand for the same reason.
 *
 * Tracks the last focused key id so the roving tabindex can be restored after a
 * re-render; the host reads it through {@link getLastFocusedKeyId} and clears it
 * on disconnect via {@link setLastFocusedKeyId}.
 */
export class KeyGridNavigation {
  private _lastFocusedKeyId: string | null = null;

  constructor(private readonly _host: KeyGridNavigationHost) {}

  getLastFocusedKeyId(): string | null {
    return this._lastFocusedKeyId;
  }

  setLastFocusedKeyId(id: string | null): void {
    this._lastFocusedKeyId = id;
  }

  onKeyDown(e: KeyboardEvent): void {
    const keyEl = (e.target as HTMLElement).closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook);
    if (!keyEl) return;

    const layout = this._host.getResolvedLayout();
    const match = keyEl.id.match(KEY_ID_SUFFIX_RE);
    if (!match) return;

    let row = Number.parseInt(match[1]!, 10);
    let col = Number.parseInt(match[2]!, 10);
    let moved = false;

    switch (e.key) {
      case "ArrowRight":
        col = col + 1 < (layout[row]?.length ?? 0) ? col + 1 : 0;
        moved = true;
        break;
      case "ArrowLeft":
        col = col - 1 >= 0 ? col - 1 : (layout[row]?.length ?? 1) - 1;
        moved = true;
        break;
      case "ArrowDown":
        row = row + 1 < layout.length ? row + 1 : 0;
        col = Math.min(col, (layout[row]?.length ?? 1) - 1);
        moved = true;
        break;
      case "ArrowUp":
        row = row - 1 >= 0 ? row - 1 : layout.length - 1;
        col = Math.min(col, (layout[row]?.length ?? 1) - 1);
        moved = true;
        break;
      case "Home":
        // Ctrl+Home jumps to the first key of the whole grid; plain Home
        // stays within the current row.
        if (e.ctrlKey) row = 0;
        col = 0;
        moved = true;
        break;
      case "End":
        // Ctrl+End jumps to the last key of the whole grid; plain End
        // stays within the current row.
        if (e.ctrlKey) row = layout.length - 1;
        col = (layout[row]?.length ?? 1) - 1;
        moved = true;
        break;
      case "Enter":
      case " ":
        // Activate only without modifiers: Ctrl+Enter, Alt+Space and similar
        // combinations are browser/OS shortcuts, not key activations.
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        keyEl.click();
        e.preventDefault();
        return;
    }

    if (moved) {
      e.preventDefault();
      const id = keyElementId(this._host.getComponentId(), row, col);
      const nextEl = this._host.getShadowRoot()!.getElementById(id);
      if (nextEl) {
        keyEl.setAttribute("tabindex", "-1");
        nextEl.setAttribute("tabindex", "0");
        nextEl.focus();
        this._lastFocusedKeyId = id;
      }
    }
  }
}
