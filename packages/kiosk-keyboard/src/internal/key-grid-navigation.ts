import EventProvider from "sap/ui/base/EventProvider";
import { keyPositionOf, type KeyPosition } from "./dom";
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
 * (Ctrl+Home / Ctrl+End) jump across the whole grid. Horizontal movement is
 * mirrored when the focused key renders right-to-left, so ArrowRight always
 * moves focus visually right.
 *
 * The host control must call {@link setRootRef} after each re-render.
 */
export default class KeyGridNavigation extends EventProvider {
  private _rootRef: HTMLElement | null = null;
  private _dom: KioskKeyboardDomContract;
  private _isEnabled: () => boolean;
  private _lastFocusedKey: KeyPosition | null = null;

  /**
   * @param isEnabled Read at event time, not at wiring time: the control's own
   *   guards keep a keycap from holding focus while disabled, so this is
   *   defence in depth for a key focused directly by a consumer.
   */
  constructor(dom: KioskKeyboardDomContract, isEnabled: () => boolean) {
    super();
    this._dom = dom;
    this._isEnabled = isEnabled;
  }

  setRootRef(root: HTMLElement | null): void {
    this._rootRef = root;
  }

  getLastFocusedKey(): KeyPosition | null {
    return this._lastFocusedKey;
  }

  setLastFocusedKey(pos: KeyPosition | null): void {
    this._lastFocusedKey = pos;
  }

  getFocusableDomRef(): HTMLElement | null {
    return (
      this._keyAt(this._lastFocusedKey) ?? this._rootRef?.querySelector<HTMLElement>(this._dom.selectors.key) ?? null
    );
  }

  /** The rendered key at a grid position, inside this control's own DOM. */
  private _keyAt(pos: KeyPosition | null): HTMLElement | null {
    if (!pos) return null;
    return this._rootRef?.querySelector<HTMLElement>(this._dom.selectors.keyByPosition(pos.row, pos.col)) ?? null;
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
    const target = this._keyTargetOf(event);
    if (!target) return;
    event.preventDefault();

    const row = target.closest(this._dom.selectors.row);
    const first = row?.querySelector<HTMLElement>(this._dom.selectors.key);
    if (first && first !== target) this._transferFocus(target, first);
  }

  onsapend(event: Event): void {
    const target = this._keyTargetOf(event);
    if (!target) return;
    event.preventDefault();

    const row = target.closest(this._dom.selectors.row);
    const keys = row?.querySelectorAll<HTMLElement>(this._dom.selectors.key);
    const last = keys?.[keys.length - 1];
    if (last && last !== target) this._transferFocus(target, last);
  }

  onsaptop(event: Event): void {
    const target = this._keyTargetOf(event);
    if (!target) return;
    event.preventDefault();

    const firstRow = this._rootRef?.querySelector<HTMLElement>(this._dom.selectors.row);
    const first = firstRow?.querySelector<HTMLElement>(this._dom.selectors.key);
    if (first && first !== target) this._transferFocus(target, first);
  }

  onsapbottom(event: Event): void {
    const target = this._keyTargetOf(event);
    if (!target) return;
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
    const target = this._keyTargetOf(event);
    if (!target) return false;
    this._move(target, dRow, dCol !== 0 && this._isRtl(target) ? -dCol : dCol);
    return true;
  }

  /**
   * The keycap a pseudo-event was dispatched on, or null when it landed
   * elsewhere or the keyboard is disabled. Every handler above funnels through
   * here, so the disabled check covers the whole delegate.
   */
  private _keyTargetOf(event: Event): HTMLElement | null {
    if (!this._isEnabled()) return null;
    // SAFETY: UI5 forwards these pseudo-events from the browser keyboard event on the
    // focused node, and this control renders keys as HTML elements only, so the target
    // is one; _isKey then decides whether it is a keycap of this grid.
    const target = event.target as HTMLElement;
    return this._isKey(target) ? target : null;
  }

  private _isKey(el: HTMLElement): boolean {
    return el.classList.contains(this._dom.classes.key);
  }

  private _isRtl(el: HTMLElement): boolean {
    return getComputedStyle(el).direction === "rtl";
  }

  private _move(current: HTMLElement, dRow: number, dCol: number): void {
    const from = keyPositionOf(current);
    if (!from) return;

    const row = from.row + dRow;
    const col = from.col + dCol;

    let next: HTMLElement | null = this._keyAt({ row, col });

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
    this._lastFocusedKey = keyPositionOf(next);
  }

  override destroy(): void {
    this._rootRef = null;
    this._lastFocusedKey = null;
    super.destroy();
  }
}
