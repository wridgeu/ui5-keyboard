import type Popover from "@ui5/webcomponents/dist/Popover.js";
import { KIOSK_KEYBOARD_DOM } from "./dom-contract.js";
import { keyPositionOf, type KeyPosition } from "./dom-utils.js";

/**
 * Press-and-hold threshold that opens the accent-variant popup (ms). Kept
 * independent of the equal backspace-hold 450 so the two do not silently track
 * each other.
 */
export const VARIANT_HOLD_MS = 450;

/** Reactive accent-variant popup state the host template renders from. */
export interface VariantPopupState {
  anchorKey: KeyPosition;
  anchorKeyWidth: number;
  base: string;
  glyphs: string[];
  activeIndex: number;
  label: string;
  /**
   * BCP-47 language of the option glyphs, or `undefined` when the layout writes
   * its keycaps in the UI language. The popup is a sibling of the keyboard root
   * rather than a descendant, so it inherits no `lang` and declares its own.
   */
  lang?: string;
}

/** The slice of the host element the controller reads/drives at event time. */
interface VariantPopupControllerHost {
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
  /** Restores focus to the key at this grid position once the popup has closed. */
  focusKey(pos: KeyPosition): void;
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
  /** The pending single-shot hold timer that opens the popup, or `null` when unarmed. */
  private _holdTimer: ReturnType<typeof setTimeout> | null = null;
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
  /**
   * Set while a commit is closing the popup, so the shared teardown announces a
   * dismissal only for a genuine cancel (Escape, outside press, key press).
   * Scoped to one popup session: every open clears it, so no close path can
   * leave it stuck and silence later dismissals. Mirrors the sibling
   * kiosk-keyboard package's `_dismiss(announce)` discriminator.
   */
  private _committing = false;
  /**
   * Set when the popup state changed in a way that must re-seat the roving DOM
   * focus once the render lands (an open, or an arrow move). Consumed by
   * `openPopoverAfterRender`, so an unrelated host re-render never steals focus.
   */
  private _focusPending = false;
  /**
   * The key waiting to claim the popup while the previous session closes. The
   * popover only takes a new opener on the render after it is un-rendered, so a
   * re-anchor parks the new key here and opens it from the teardown.
   */
  private _pendingKeyEl: HTMLElement | null = null;

  private readonly _onPointerDown = (e: Event): void => {
    if (e instanceof PointerEvent) this._start(e);
  };
  private readonly _onPointerUp = (e: Event): void => {
    if (e instanceof PointerEvent) this._end(e);
  };
  private readonly _onPointerCancel = (e: Event): void => {
    if (e instanceof PointerEvent) this._abort(e);
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

  constructor(private readonly _host: VariantPopupControllerHost) {}

  /** Arm the single-shot hold: (re)schedule the open, cancelling any pending hold first. */
  private _arm(): void {
    this._clearHold();
    this._holdTimer = setTimeout(() => {
      this._holdTimer = null;
      this._openFromHold();
    }, VARIANT_HOLD_MS);
  }

  /** Cancel a pending hold timer. Safe when none is armed. */
  private _clearHold(): void {
    if (this._holdTimer !== null) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
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
    document.addEventListener("pointercancel", this._onPointerCancel, { signal });
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
    this._committing = false;
    this._host.setPopupState(state);
    this._focusPending = true;
    this._host.announce(state.label);
    return true;
  }

  /** Whether `keyEl` is the key the open popup is anchored to. */
  private _isAnchoredTo(state: VariantPopupState, keyEl: HTMLElement): boolean {
    const pos = keyPositionOf(keyEl);
    return pos !== null && pos.row === state.anchorKey.row && pos.col === state.anchorKey.col;
  }

  /**
   * Opens `keyEl` once any live popup has closed, since overwriting the state
   * while it is open would swap the glyphs under the previous anchor. Returns
   * whether the key will open.
   */
  private _requestOpen(keyEl: HTMLElement): boolean {
    const state = this._host.getPopupState();
    if (!state) return this.openFor(keyEl);
    if (this._isAnchoredTo(state, keyEl)) return false;
    if (!this._host.resolveOpenState(keyEl)) return false;
    this.close();
    // Parked after `close()`, which abandons any earlier re-anchor. A close that
    // tore down synchronously leaves no state, so the key can take it now.
    if (this._host.getPopupState()) this._pendingKeyEl = keyEl;
    else this.openFor(keyEl);
    return true;
  }

  /**
   * Syncs the rendered popup to the reactive state, from the host's
   * after-render hook: opens the popover once it and its anchor key exist in
   * the shadow DOM (setting the live opener element, a DOM ref across the
   * shadow boundary, and wiring the one-shot `close` teardown), then seats the
   * roving DOM focus on the active option so keyboard navigation starts and
   * stays inside the popup.
   *
   * Focus is the one thing the template cannot express, so it is applied here
   * rather than at the keystroke: the option's Emphasized design and tab stop
   * are template-bound to `activeIndex`, and only exist once the render lands.
   */
  openPopoverAfterRender(): void {
    const state = this._host.getPopupState();
    if (!state) return;
    const popover = this._popoverEl();
    if (!popover) return;

    if (!popover.open) {
      const anchor =
        this._host
          .getShadowRoot()
          ?.querySelector<HTMLElement>(
            KIOSK_KEYBOARD_DOM.selectors.keyByPosition(state.anchorKey.row, state.anchorKey.col),
          ) ?? null;
      if (!anchor) return;
      popover.opener = anchor;
      popover.addEventListener("close", this._onPopoverClose, { once: true });
      popover.open = true;
    }

    if (!this._focusPending) return;
    this._focusPending = false;
    this._popupEl()
      ?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.variantOptionByIndex(state.activeIndex))
      ?.focus();
  }

  /**
   * Closes the popover; its `close` event runs the shared teardown. An explicit
   * close abandons a parked re-anchor, so dismissing (Escape, a key press) never
   * surfaces the popup the user just dismissed.
   */
  close(): void {
    this._pendingKeyEl = null;
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

    // Move through the reactive state: the template binds each option's
    // Emphasized design and tab stop to `activeIndex`, and `_focusPending` has
    // the after-render hook follow up with the DOM focus.
    this._host.setPopupState({ ...state, activeIndex: next });
    this._focusPending = true;
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
    this._committing = true;
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
   * clears the reactive state, clears the click suppression, announces a
   * cancel, and returns focus to the origin key. Bound to the popover's
   * `close` event, so a framework-driven dismissal runs it too.
   */
  private _teardown(): void {
    const state = this._host.getPopupState();
    if (!state) return;
    const committed = this._committing;
    this._committing = false;
    // Read before the state write below un-renders the popup.
    const hadFocus = this._popupEl()?.contains(this._host.getShadowRoot()?.activeElement ?? null) ?? false;
    this._host.setPopupState(null);
    this._focusPending = false;
    // Only drop the click suppression once the press that armed it has ended.
    // A commit or dismissal while that press is still down (a second finger
    // picking an option) leaves it armed, so the opening gesture's own trailing
    // click still does not type the base glyph; `consumeClick` spends it.
    if (this._pointerId === null) this._clearSuppression();
    // A commit already spoke through the inserted glyph; only a cancel is a
    // dismissal worth announcing.
    if (!committed) this._host.announceDismiss();
    // Restore focus to the origin key only when focus was still inside the popup
    // (Escape, keyboard commit, option click). An outside press that moved focus
    // elsewhere keeps it there.
    if (hadFocus) this._host.focusKey(state.anchorKey);

    // Hand the popup to a key that asked for it while this one was closing. The
    // state write above un-rendered the popover, so the next render takes the
    // new anchor as opener.
    const pending = this._pendingKeyEl;
    this._pendingKeyEl = null;
    if (pending?.isConnected) this.openFor(pending);
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
    // A press on a different key arms a re-anchor. Two cases must not: the key
    // that already owns the popup keeps it rather than restarting the session
    // under the user's focus, and a second finger landing while the opening
    // press is still down is multi-touch, which would disarm finger one's
    // pending release-swallow. Both still reach `_onKeyClick`, which dismisses
    // and types; only the suppression needs settling.
    const openState = this._host.getPopupState();
    if (openState !== null && (this._isAnchoredTo(openState, keyEl) || this._pointerId !== null)) {
      if (this._pointerId === null) this._clearSuppression();
      return;
    }
    this._cancelHold();
    this._clearSuppression();
    this._keyEl = keyEl;
    this._pointerId = e.pointerId;
    keyEl.addEventListener("pointerleave", this._onPointerLeave);
    this._arm();
  }

  private _openFromHold(): void {
    const keyEl = this._keyEl;
    if (!keyEl) return;
    keyEl.removeEventListener("pointerleave", this._onPointerLeave);
    if (this._requestOpen(keyEl)) {
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
    // A ui5-popover exempts its own opener from the outside-press dismissal, so
    // a repeated right-click on the origin key arrives with the popup live;
    // `_requestOpen` keeps it, rather than resetting the roving selection under
    // the user's focus. On another key it re-anchors.
    this._cancelHold();
    this._requestOpen(keyEl);
  }

  /**
   * The browser took the gesture away (palm rejection, a system edge-swipe, a
   * scroll takeover). It ends the hold without committing: the user never chose
   * the option that happens to sit under the cancel coordinates.
   */
  private _abort(e: PointerEvent): void {
    if (this._pointerId !== null && e.pointerId !== this._pointerId) return;
    this.stop();
  }

  private _end(e: PointerEvent): void {
    if (this._pointerId !== null && e.pointerId !== this._pointerId) return;
    if (this._opened) {
      // Touch drag-release: releasing over an option commits it. Releasing
      // elsewhere leaves the popup open (sticky) and keeps the suppression so
      // the trailing origin-key click does not insert the base glyph.
      if (this._commitAt(e.clientX, e.clientY)) {
        this._clearSuppression();
        // A touch commit is trailed by a synthesized touchend on the host; a
        // mouse/pen release is not, so only touch needs the swallow signal.
        if (e.pointerType === "touch") this._host.notifyTouchCommit();
      }
    }
    this.stop();
  }

  /** Drop the pending release-swallow together with the key it is bound to. */
  private _clearSuppression(): void {
    this._suppressNextClick = false;
    this._originValue = null;
  }

  private _cancelHold(): void {
    this._clearHold();
    if (this._keyEl) this._keyEl.removeEventListener("pointerleave", this._onPointerLeave);
    this._keyEl = null;
    this._pointerId = null;
  }
}
