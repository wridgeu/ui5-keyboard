import type Popover from "@ui5/webcomponents/dist/Popover.js";
import { AutoRepeater, type AutoRepeatTiming } from "./auto-repeat.js";
import { KIOSK_KEYBOARD_DOM } from "./dom-contract.js";

/**
 * Press-and-hold threshold that opens the accent-variant popup (ms). Kept
 * independent of the equal backspace-hold 450 so the two do not silently track
 * each other.
 */
export const VARIANT_HOLD_MS = 450;

// A single-shot hold timer: the AutoRepeater fires once after the initial delay
// and its callback returns `false`, so no repeat cadence follows. The other
// fields never come into play (they only drive repeat ticks), but a full timing
// object is required by the shared curve type.
const VARIANT_HOLD_TIMING: AutoRepeatTiming = {
  initialDelayMs: VARIANT_HOLD_MS,
  startIntervalMs: VARIANT_HOLD_MS,
  minIntervalMs: VARIANT_HOLD_MS,
  accelerationFactor: 1,
};

/** Reactive accent-variant popup state the host template renders from. */
export interface VariantPopupState {
  anchorKeyId: string;
  anchorKeyWidth: number;
  base: string;
  glyphs: string[];
  activeIndex: number;
  label: string;
}

/** The slice of the host element the controller reads/drives at event time. */
export interface VariantPopupControllerHost {
  /** Live shadow root accessor (read at event time, never snapshotted). */
  getShadowRoot(): ShadowRoot | null;
  isDisabled(): boolean;
  /** Whether the keyboard's effective layout direction is right-to-left. */
  isRtl(): boolean;
  /**
   * Resolves the open state for `keyEl` (Shift/Caps-mapped variants and the
   * announcement label), or `null` when disabled or the key has no effective
   * variants.
   */
  resolveOpenState(keyEl: HTMLElement): VariantPopupState | null;
  /** The open popup state, or `null` when closed. */
  getPopupState(): VariantPopupState | null;
  /** Writes the reactive popup state; the host template re-renders from it. */
  setPopupState(state: VariantPopupState | null): void;
  /**
   * Inserts the chosen glyph through the same cursor-aware path a normal
   * character key uses (cancelable key-press, composition middleware /
   * literal insert, Shift auto-release).
   */
  insertVariant(glyph: string): void;
  /** Announces text through the live region. */
  announce(text: string): void;
  /** Announces popup dismissal through the live region. */
  announceDismiss(): void;
  /** Restores focus to the key with this id once the popup has closed. */
  focusKey(keyId: string): void;
  /** Signal that a touch drag-release just committed, so the host swallows the trailing synthesized touchend. */
  notifyTouchCommit(): void;
}

/**
 * Owns the accent-variant popup for the web component: the
 * press-and-hold / right-click gesture that opens it, the single-shot hold
 * timer, the roving-tabindex keyboard navigation and option-click commit, the
 * touch drag-release commit, and the popover DOM wiring (opener, one-shot
 * close teardown, focus restore).
 *
 * The popup DOM lives in the host's shadow root (a `ui5-popover` templated by
 * the host); this controller queries it live through `host.getShadowRoot()`
 * rather than caching a reference, and drives the reactive popup state
 * through `host.getPopupState()` / `setPopupState()` so the host template
 * re-renders from it.
 *
 * The hold threshold is shared with the sibling `kiosk-keyboard` package by
 * hand (see the CLAUDE.md no-shared-core convention); only the wiring differs.
 */
export class VariantPopupController {
  private readonly _hold: AutoRepeater;
  /**
   * Set once the hold (or right-click) opened a popup; swallows the single
   * trailing `click` the opening gesture produces on release so lifting off
   * does not also insert the base character. Gated by `_originValue` and reset
   * on the next press, on the consuming click, and when the popup closes, so
   * a later activation of another key is never wrongly swallowed.
   */
  private _suppressNextClick = false;
  /** `data-key` value of the key the current suppression is bound to. */
  private _originValue: string | null = null;
  /** The variant key the current hold is armed on (for leave detection). */
  private _keyEl: HTMLElement | null = null;
  /** Pointer id of the active hold, so an unrelated release does not end it. */
  private _pointerId: number | null = null;
  /** Whether the current gesture has already opened the popup. */
  private _opened = false;

  private readonly _onPointerDown = (e: Event): void => {
    if (e instanceof PointerEvent) this._start(e);
  };
  private readonly _onPointerUp = (e: Event): void => {
    if (e instanceof PointerEvent) this._end(e);
  };
  private readonly _onPointerLeave = (): void => {
    // Sliding off the key before the hold fires cancels it; after the popup is
    // open the leave listener is already removed so a drag onto the popup keeps
    // the gesture alive for touch drag-release.
    this._cancelHold();
  };
  private readonly _onContextMenu = (e: Event): void => this._openFromContextMenu(e);
  /** One-shot teardown bound to the popover's `close` event on each open. */
  private readonly _onPopoverClose = (): void => this._teardown();

  constructor(private readonly _host: VariantPopupControllerHost) {
    this._hold = new AutoRepeater(() => {
      this._openFromHold();
      return false; // single-shot: open once, never repeat
    }, VARIANT_HOLD_TIMING);
  }

  /**
   * Wire the gesture listeners: pointerdown / contextmenu on the shadow root, a
   * release anywhere on the document (so a pointerup off the key still ends the
   * gesture). Call from the host's connected callback with its teardown signal.
   */
  attach(signal: AbortSignal): void {
    const root = this._host.getShadowRoot()!;
    root.addEventListener("pointerdown", this._onPointerDown, { signal });
    root.addEventListener("contextmenu", this._onContextMenu, { signal });
    document.addEventListener("pointerup", this._onPointerUp, { signal });
    document.addEventListener("pointercancel", this._onPointerUp, { signal });
  }

  /** Cancel any in-flight hold and unbind the per-key leave listener. */
  stop(): void {
    this._cancelHold();
    this._opened = false;
  }

  /**
   * Consume the trailing release click after the gesture opened a popup.
   * Returns `true` when `value` is the origin key of the suppressed release and
   * the caller should ignore the click.
   */
  consumeClick(value: string): boolean {
    if (this._suppressNextClick && value === this._originValue) {
      this._suppressNextClick = false;
      return true;
    }
    return false;
  }

  // ── Opening ──

  /**
   * Opens the popup immediately for `keyEl` (the right-click / context-menu
   * path, and the target of a completed hold). Returns whether it opened
   * (`false` when the key has no effective variants or the host is disabled).
   */
  openFor(keyEl: HTMLElement): boolean {
    const state = this._host.resolveOpenState(keyEl);
    if (!state) return false;
    this._host.setPopupState(state);
    this._host.announce(state.label);
    return true;
  }

  /**
   * Opens the popover once it and its anchor key exist in the rendered shadow
   * DOM: sets the live opener element (a DOM ref across the shadow boundary),
   * wires the one-shot `close` teardown, and moves focus to the active option
   * so roving navigation starts inside the popup.
   */
  openPopoverAfterRender(): void {
    const state = this._host.getPopupState();
    if (!state) return;
    const popover = this._popoverEl();
    if (!popover || popover.open) return;
    const anchor = this._host.getShadowRoot()?.getElementById(state.anchorKeyId) ?? null;
    if (!anchor) return;

    popover.opener = anchor;
    popover.addEventListener("close", this._onPopoverClose, { once: true });
    popover.open = true;

    this._popupEl()
      ?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.variantOptionByIndex(state.activeIndex))
      ?.focus();
  }

  /** Closes the popover; its `close` event runs the shared teardown. */
  close(): void {
    const popover = this._popoverEl();
    if (popover?.open) {
      popover.open = false;
    } else {
      this._teardown();
    }
  }

  /** Option click: commits the clicked glyph. */
  onOptionClick(e: Event): void {
    const option = (e.target as HTMLElement).closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.variantOption);
    if (!option) return;
    const state = this._host.getPopupState();
    const glyph = state?.glyphs[Number(option.dataset.index)];
    if (glyph !== undefined) this._commit(glyph);
  }

  /**
   * Roving-tabindex keyboard navigation for the open popup (mirrors the key
   * grid): arrows move the active option, Enter/Space commit, Escape dismisses.
   */
  onOptionKeydown(e: KeyboardEvent): void {
    const state = this._host.getPopupState();
    if (!state) return;
    const last = state.glyphs.length - 1;
    let next = state.activeIndex;
    // In RTL the options render right-to-left, so ArrowRight moves to the
    // lower (visually next) index and ArrowLeft to the higher; Up/Down stay
    // absolute. Mirrors the sibling kiosk-keyboard popup.
    const rtl = this._host.isRtl();
    const clamp = (i: number): number => Math.max(0, Math.min(i, last));

    switch (e.key) {
      case "ArrowRight":
        next = clamp(state.activeIndex + (rtl ? -1 : 1));
        break;
      case "ArrowLeft":
        next = clamp(state.activeIndex + (rtl ? 1 : -1));
        break;
      case "ArrowDown":
        next = Math.min(state.activeIndex + 1, last);
        break;
      case "ArrowUp":
        next = Math.max(state.activeIndex - 1, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        this._commit(state.glyphs[state.activeIndex]!);
        return;
      case "Escape":
        // Dismiss only the popup; stop propagation so a docked keyboard's own
        // Escape handler does not also close the keyboard.
        e.preventDefault();
        e.stopPropagation();
        this.close();
        return;
      default:
        return;
    }

    e.preventDefault();
    if (next === state.activeIndex) return;

    const popup = this._popupEl();
    if (!popup) return;
    const oldOption = popup.querySelector(KIOSK_KEYBOARD_DOM.selectors.variantOptionByIndex(state.activeIndex));
    const newOption = popup.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.variantOptionByIndex(next));
    // Roving move without a re-render: the active option carries the Emphasized
    // ui5-button design and the tab stop; the design change re-renders that
    // button, which re-reads the freshly written host tabindex.
    oldOption?.setAttribute("tabindex", "-1");
    oldOption?.setAttribute("design", "Default");
    if (newOption) {
      newOption.setAttribute("tabindex", "0");
      newOption.setAttribute("design", "Emphasized");
      newOption.focus();
    }
    state.activeIndex = next; // in place: keeps state without a re-render
  }

  // ── DOM queries (live; never snapshotted) ──

  private _popupEl(): HTMLElement | null {
    return this._host.getShadowRoot()?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.variantPopup) ?? null;
  }

  private _popoverEl(): Popover | null {
    return this._host.getShadowRoot()?.querySelector<Popover>(KIOSK_KEYBOARD_DOM.selectors.variantPopover) ?? null;
  }

  // ── Commit / close teardown ──

  private _commit(glyph: string): void {
    this._host.insertVariant(glyph);
    this.close();
  }

  /**
   * Commits the popup option under the given viewport coordinates (touch
   * drag-release). Returns whether a variant was committed.
   */
  private _commitAt(clientX: number, clientY: number): boolean {
    const popup = this._popupEl();
    const state = this._host.getPopupState();
    if (!popup || !state) return false;
    const el = this._host.getShadowRoot()?.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const option = el?.closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.variantOption) ?? null;
    if (!option || !popup.contains(option)) return false;
    const glyph = state.glyphs[Number(option.dataset.index)];
    if (glyph === undefined) return false;
    this._commit(glyph);
    return true;
  }

  /**
   * Teardown shared by every dismissal path (commit, Escape, outside press):
   * clears the reactive state, clears the click suppression, announces
   * closure, and returns focus to the origin key. Bound to the popover's
   * `close` event, so a framework-driven dismissal runs it too.
   */
  private _teardown(): void {
    const state = this._host.getPopupState();
    if (!state) return;
    this._host.setPopupState(null);
    this._suppressNextClick = false;
    this._originValue = null;
    this._host.announceDismiss();
    this._host.focusKey(state.anchorKeyId);
  }

  // ── Gesture detection ──

  private _variantKey(target: EventTarget | null): HTMLElement | null {
    const keyEl = (target as HTMLElement | null)?.closest?.<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook) ?? null;
    if (!keyEl || !keyEl.hasAttribute(KIOSK_KEYBOARD_DOM.attributes.hasVariants)) return null;
    return keyEl;
  }

  private _start(e: PointerEvent): void {
    if (this._host.isDisabled()) return;
    if (e.button > 0) return; // primary press only (0 for touch/pen/left mouse)
    const keyEl = this._variantKey(e.target);
    if (!keyEl) return;
    this._cancelHold();
    this._suppressNextClick = false;
    this._keyEl = keyEl;
    this._pointerId = e.pointerId;
    keyEl.addEventListener("pointerleave", this._onPointerLeave);
    this._hold.start();
  }

  private _openFromHold(): void {
    const keyEl = this._keyEl;
    if (!keyEl) return;
    keyEl.removeEventListener("pointerleave", this._onPointerLeave);
    if (this.openFor(keyEl)) {
      this._opened = true;
      this._suppressNextClick = true;
      this._originValue = keyEl.dataset.key ?? null;
    }
  }

  private _openFromContextMenu(e: Event): void {
    if (this._host.isDisabled()) return;
    const keyEl = this._variantKey(e.target);
    if (!keyEl) return;
    e.preventDefault();
    this._cancelHold();
    this.openFor(keyEl);
  }

  private _end(e: PointerEvent): void {
    if (this._pointerId !== null && e.pointerId !== this._pointerId) return;
    if (this._opened) {
      // Touch drag-release: releasing over an option commits it. Releasing
      // elsewhere leaves the popup open (sticky) and keeps the suppression so
      // the trailing origin-key click does not insert the base glyph.
      if (this._commitAt(e.clientX, e.clientY)) {
        this._suppressNextClick = false;
        // A touch commit is trailed by a synthesized touchend on the host; a
        // mouse/pen release is not, so only touch needs the swallow signal.
        if (e.pointerType === "touch") this._host.notifyTouchCommit();
      }
    }
    this.stop();
  }

  private _cancelHold(): void {
    this._hold.stop();
    if (this._keyEl) this._keyEl.removeEventListener("pointerleave", this._onPointerLeave);
    this._keyEl = null;
    this._pointerId = null;
  }
}
