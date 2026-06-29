import EventProvider from "sap/ui/base/EventProvider";
import { KEY_ID_SUFFIX_RE, keyElementId } from "./dom";
import type { KioskKeyboardDomContract } from "./dom-contract";

/**
 * Keyboard grid navigation delegate.
 *
 * Follows the same pattern as sap.ui.core.delegate.ItemNavigation
 * (added via addDelegate, receives UI5 pseudo-events), but supports
 * variable-width rows with column clamping on vertical movement and
 * horizontal wrapping across row boundaries.
 *
 * Uses direction-specific pseudo-events (onsapdown, onsapright, etc.)
 * rather than onsapnext/onsapprevious, because the keyboard grid
 * needs different behavior for horizontal vs vertical navigation.
 * onsaphome/onsapend jump within the current row; onsaptop/onsapbottom
 * (Ctrl+Home / Ctrl+End) jump across the whole grid.
 *
 * The host control must call {@link setRootRef} after each re-render.
 */
export default class KeyGridNavigation extends EventProvider {
  private _rootRef: HTMLElement | null = null;
  private _dom: KioskKeyboardDomContract;
  private _lastFocusedKeyId: string | null = null;
  private _controlId: string;

  constructor(controlId: string, dom: KioskKeyboardDomContract) {
    super();
    this._controlId = controlId;
    this._dom = dom;
  }

  setRootRef(root: HTMLElement | null): void {
    this._rootRef = root;
  }

  getLastFocusedKeyId(): string | null {
    return this._lastFocusedKeyId;
  }

  setLastFocusedKeyId(id: string | null): void {
    this._lastFocusedKeyId = id;
  }

  getFocusableDomRef(): HTMLElement | null {
    return (
      (this._lastFocusedKeyId && document.getElementById(this._lastFocusedKeyId)) ||
      this._rootRef?.querySelector<HTMLElement>(this._dom.selectors.key) ||
      null
    );
  }

  // ── UI5 pseudo-event handlers (dispatched via addDelegate) ──

  onsapright(event: Event): void {
    if (this._handleNav(event, 0, 1)) event.preventDefault();
  }

  onsapleft(event: Event): void {
    if (this._handleNav(event, 0, -1)) event.preventDefault();
  }

  onsapdown(event: Event): void {
    if (this._handleNav(event, 1, 0)) event.preventDefault();
  }

  onsapup(event: Event): void {
    if (this._handleNav(event, -1, 0)) event.preventDefault();
  }

  onsaphome(event: Event): void {
    const target = event.target as HTMLElement;
    if (!this._isKey(target)) return;
    event.preventDefault();

    const row = target.closest(this._dom.selectors.row);
    const first = row?.querySelector<HTMLElement>(this._dom.selectors.key);
    if (first && first !== target) this._transferFocus(target, first);
  }

  onsapend(event: Event): void {
    const target = event.target as HTMLElement;
    if (!this._isKey(target)) return;
    event.preventDefault();

    const row = target.closest(this._dom.selectors.row);
    const keys = row?.querySelectorAll<HTMLElement>(this._dom.selectors.key);
    const last = keys?.[keys.length - 1];
    if (last && last !== target) this._transferFocus(target, last);
  }

  onsaptop(event: Event): void {
    const target = event.target as HTMLElement;
    if (!this._isKey(target)) return;
    event.preventDefault();

    const firstRow = this._rootRef?.querySelector<HTMLElement>(this._dom.selectors.row);
    const first = firstRow?.querySelector<HTMLElement>(this._dom.selectors.key);
    if (first && first !== target) this._transferFocus(target, first);
  }

  onsapbottom(event: Event): void {
    const target = event.target as HTMLElement;
    if (!this._isKey(target)) return;
    event.preventDefault();

    const rows = this._rootRef?.querySelectorAll<HTMLElement>(this._dom.selectors.row);
    if (!rows || rows.length === 0) return;
    const lastRow = rows[rows.length - 1]!;
    const keys = lastRow.querySelectorAll<HTMLElement>(this._dom.selectors.key);
    const last = keys.length > 0 ? keys[keys.length - 1] : undefined;
    if (last && last !== target) this._transferFocus(target, last);
  }

  // ── Internal navigation logic ──

  private _handleNav(event: Event, dRow: number, dCol: number): boolean {
    const target = event.target as HTMLElement;
    if (!this._isKey(target)) return false;
    this._move(target, dRow, dCol);
    return true;
  }

  private _isKey(el: HTMLElement): boolean {
    return el.classList.contains(this._dom.classes.key);
  }

  private _move(current: HTMLElement, dRow: number, dCol: number): void {
    const match = current.id.match(KEY_ID_SUFFIX_RE);
    if (!match) return;

    const row = Number.parseInt(match[1]!, 10) + dRow;
    const col = Number.parseInt(match[2]!, 10) + dCol;

    let next: HTMLElement | null = document.getElementById(keyElementId(this._controlId, row, col));

    if (!next) {
      if (dCol !== 0 && dRow === 0) {
        const currentRow = current.closest(this._dom.selectors.row);
        const adjacentRow = dCol > 0 ? currentRow?.nextElementSibling : currentRow?.previousElementSibling;
        if (adjacentRow) {
          const keys = adjacentRow.querySelectorAll<HTMLElement>(this._dom.selectors.key);
          if (keys.length > 0) {
            next = (dCol > 0 ? keys[0] : keys[keys.length - 1]) ?? null;
          }
        }
      } else if (dRow !== 0) {
        const targetRow = this._rootRef?.querySelectorAll(this._dom.selectors.row)[row];
        if (targetRow) {
          const keys = targetRow.querySelectorAll<HTMLElement>(this._dom.selectors.key);
          if (keys.length > 0) {
            next = keys[Math.min(col, keys.length - 1)] ?? null;
          }
        }
      }
    }

    if (next) {
      this._transferFocus(current, next);
    }
  }

  private _transferFocus(current: HTMLElement, next: HTMLElement): void {
    current.setAttribute("tabindex", "-1");
    next.setAttribute("tabindex", "0");
    next.focus();
    this._lastFocusedKeyId = next.id;
  }

  override destroy(): void {
    this._rootRef = null;
    this._lastFocusedKeyId = null;
    super.destroy();
  }
}
