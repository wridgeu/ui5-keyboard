import type Popover from "sap/m/Popover";
import FlexBox from "sap/m/FlexBox";
import Button from "sap/m/Button";
import InvisibleText from "sap/ui/core/InvisibleText";
import { FlexWrap, FlexRendertype, ButtonType } from "sap/m/library";
import { KIOSK_KEYBOARD_DOM } from "./dom-contract";
import { getText } from "./i18n-registry";

/**
 * Owns the press-and-hold / right-click accent-variant popup for the UI5
 * control: the single-shot hold timer that opens it, the option grid hosted in a
 * themed `sap/m/Popover`, the roving-tabindex keyboard navigation, and the touch
 * drag-release tracking.
 *
 * The Popover is a themed framework overlay: it renders into the static
 * area (unclipped, stacked above the docked keyboard), docks above the pressed
 * key with collision flipping, draws its own arrow, and dismisses itself on an
 * outside press (autoClose) or Escape. Its options are one `sap/m/Button` per
 * glyph laid out in a wrapping `sap/m/FlexBox`, so the framework supplies every
 * bit of background / border / hover / focus / active styling. The roving-active
 * option is the `Emphasized` button and the sole tab stop; the arrow-key handler
 * moves the type, the DOM focus, and the tab chain between the buttons.
 *
 * Mirrors the sibling backspace-hold delegate: `onPress` arms the gesture,
 * `stop` cancels a pending (not-yet-fired) hold, and `shouldSuppressRelease`
 * tells the release path to swallow the lift-off tap so it does not also insert
 * the base glyph once the popup has opened. The actual insertion is the host's
 * `commitVariant`, so the cursor-aware insert / cancelable key-press / Shift
 * auto-release all stay on the control, exactly like a normal character key.
 *
 * The hold threshold is duplicated by hand in the sibling `kiosk-keyboard-webc`
 * package (see `variant-popup-controller.ts`); only the wiring differs between the two.
 */

/**
 * Press-and-hold threshold that opens the accent-variant popup (ms). Kept
 * independent of the equal backspace-hold 450 so the two do not silently track
 * each other.
 */
export const VARIANT_HOLD_MS = 450;

/**
 * Derives a content-density class from the anchor key's height, for the case
 * the keyboard's context carries no density class to inherit: its own
 * responsive scaling shrinks keys via container-query sizing, which sets no
 * `sapUiSize*` class. Returns `""` at the default cozy key size. Applied only
 * as a fallback after the framework density inheritance (see `adoptPopover`),
 * and never overrides the button size directly.
 */
function variantDensityClass(keyHeightPx: number): string {
  const rootFontPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const keyRem = keyHeightPx / rootFontPx;
  // A cozy button is ~2.5rem tall; once the keys shrink below the cozy touch
  // target the popover switches to compact so it stays proportional to them.
  return keyRem < 2.75 ? "sapUiSizeCompact" : "";
}

/** The effective variants surfaced for a key, already Shift/Caps-mapped. */
export interface VariantResolution {
  /** The tap-default glyph, shown only in the open announcement. */
  base: string;
  /** Ordered alternate glyphs presented as options. */
  glyphs: string[];
}

/** Callbacks the popup behavior needs from the owning control. */
export interface VariantPopupHost {
  /**
   * Effective variants for the pressed key, or `null` when it has none (the
   * gesture gate). Both `base` and `glyphs` are already Shift/Caps-mapped.
   */
  resolveVariants(keyEl: HTMLElement): VariantResolution | null;
  /**
   * Insert the chosen glyph through the same cursor-aware path a character key
   * uses (fires the cancelable key-press event first, then auto-releases Shift).
   */
  commitVariant(glyph: string): void;
  /**
   * Announce popup open through the live region. Receives the pre-formatted
   * "N variants for {base}" group name, built once and shared with the
   * aria-labelledby InvisibleText.
   */
  announceOpen(label: string): void;
  /** Announce popup dismissal through the live region. */
  announceDismiss(): void;
  /**
   * The control-owned accent-variant Popover, held in the control's hidden
   * `_variantPopover` aggregation (lazily created on first call, reused across
   * opens, auto-destroyed with the control). Returns it with the control's
   * ambient content density synced on. The behavior rebuilds its content each
   * open.
   */
  getVariantPopover(): Popover;
}

export default class VariantPopupBehavior {
  private readonly _host: VariantPopupHost;
  /** The pending single-shot hold timer that opens the popup, or `null` when unarmed. */
  private _holdTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly _onKeydown: (event: KeyboardEvent) => void;
  private readonly _onDocTouchMove: (event: TouchEvent) => void;
  private readonly _onDocTouchEnd: (event: TouchEvent) => void;
  private readonly _onAfterClose: () => void;

  /** The key whose hold is armed but has not yet opened the popup. */
  private _armedKeyEl: HTMLElement | null = null;
  /** The control-owned overlay while a popup session is open; `null` when closed. */
  private _popover: Popover | null = null;
  /** The Popover instance with `afterClose` wired on (attach-once guard). */
  private _wiredPopover: Popover | null = null;
  /** The accessible-name source referenced by the Popover's `aria-labelledby`. */
  private _label: InvisibleText | null = null;
  /** One themed button per glyph, in glyph order. */
  private _buttons: Button[] = [];
  /** The option grid's root element, host of the keyboard-navigation listener. */
  private _gridDom: HTMLElement | null = null;
  private _activeIndex = 0;
  /** Whether the open popup lays out right-to-left; drives both the option order and the arrow polarity. */
  private _rtl = false;
  /** The key the open popup belongs to; focus returns here on dismiss. */
  private _anchorKeyEl: HTMLElement | null = null;
  /**
   * Set while a press-opened popup owes its origin key a swallowed lift-off, so
   * that tap does not also insert the base glyph. Gated by `_originKeyValue`,
   * and spent by `shouldSuppressRelease`, so an unrelated key's release is never
   * swallowed.
   */
  private _consumeRelease = false;
  /** `data-key` of the key the open popup belongs to; gates release suppression. */
  private _originKeyValue: string | null = null;
  /**
   * Whether the press that armed the gesture is still down. The right-click path
   * opens with no press at all, and so owes no release.
   */
  private _pressLive = false;
  /**
   * The key waiting to claim the popup while the previous session closes. The
   * reused Popover hosts one session at a time, so a re-anchor parks the new key
   * here and opens it from `afterClose`; opening synchronously would empty the
   * still-visible overlay, whose content `_open` destroys and rebuilds.
   */
  private _pendingAnchorKeyEl: HTMLElement | null = null;

  constructor(host: VariantPopupHost) {
    this._host = host;
    this._onKeydown = (event) => this._handleKeydown(event);
    this._onDocTouchMove = (event) => this._handleDocTouchMove(event);
    this._onDocTouchEnd = (event) => this._handleDocTouchEnd(event);
    // The framework closed the overlay (outside press / Escape): tear down and
    // announce, then hand the Popover to a key that asked for it meanwhile.
    this._onAfterClose = () => {
      this._dismiss(true);
      this._drainPending();
    };
  }

  /**
   * Arm the hold when an enabled keyboard presses a key that declares variants.
   * A no-op for any other key, while disabled, and for the key that already owns
   * the popup, so callers can forward every press. A hold on a different variant
   * key re-anchors when it elapses.
   */
  onPress(keyEl: HTMLElement, enabled: boolean): void {
    if (!enabled) return;
    if (!keyEl.hasAttribute(KIOSK_KEYBOARD_DOM.attributes.hasVariants)) return;
    if (this.isOpenFor(keyEl)) return;
    this._pressLive = true;
    this._armedKeyEl = keyEl;
    this._arm();
  }

  /** Whether the open popup belongs to `keyEl`. */
  isOpenFor(keyEl: HTMLElement): boolean {
    return this._popover !== null && this._anchorKeyEl === keyEl;
  }

  /**
   * Opens the popup immediately for a key that declares variants (the
   * right-click / context-menu path). A no-op for keys without variants and for
   * the key that already owns the popup, so a repeat gesture does not restart
   * the session. On another key the popup re-anchors: the current session closes
   * and the new key opens once the framework has fired `afterClose`.
   */
  openFor(keyEl: HTMLElement): void {
    if (!keyEl.hasAttribute(KIOSK_KEYBOARD_DOM.attributes.hasVariants)) return;
    this._clearHold();
    this._armedKeyEl = keyEl;
    this._openArmed();
  }

  /** Open the key parked by a re-anchor, now that the previous session has closed. */
  private _drainPending(): void {
    const pending = this._pendingAnchorKeyEl;
    this._pendingAnchorKeyEl = null;
    if (!pending || !document.contains(pending)) return;
    this._armedKeyEl = pending;
    this._openArmed();
  }

  /** Cancel a pending hold. Safe when idle. Does not close an already-open popup. */
  stop(): void {
    this._clearHold();
    this._armedKeyEl = null;
    this._pressLive = false;
  }

  /**
   * Whether the release for `keyValue` must skip its default tap action because
   * the hold already opened the popup on that same key. Reads and clears the
   * one-shot flag, mirroring the backspace behavior's suppress-on-repeat.
   */
  shouldSuppressRelease(keyValue: string): boolean {
    if (!this._consumeRelease || keyValue !== this._originKeyValue) return false;
    this._consumeRelease = false;
    return true;
  }

  /** Stays true across a re-anchor, while the popup is between two keys. */
  isOpen(): boolean {
    return this._popover !== null || this._pendingAnchorKeyEl !== null;
  }

  /**
   * Closes an open popup without committing (inserting nothing), used when a
   * fresh keyboard key press should dismiss it. Returns whether a popup was
   * open. A no-op when closed.
   */
  dismissOpen(): boolean {
    this._pendingAnchorKeyEl = null;
    if (!this._popover) return false;
    this._dismiss(true);
    return true;
  }

  destroy(): void {
    this.stop();
    this._pendingAnchorKeyEl = null;
    // Release interaction state without closing (async) or destroying the
    // Popover: the control auto-destroys the reused instance via its hidden
    // `_variantPopover` aggregation on `exit`.
    if (this._popover) {
      this._teardownOpenState();
      this._anchorKeyEl = null;
      this._popover = null;
    }
    // The label is rendered into the static area (not a child), so release it.
    this._label?.destroy();
    this._label = null;
  }

  // ── Opening ──

  /** Arm the single-shot hold: (re)schedule the open, cancelling any pending hold first. */
  private _arm(): void {
    this._clearHold();
    // A fresh hold supersedes a re-anchor parked by an earlier one.
    this._pendingAnchorKeyEl = null;
    this._holdTimer = setTimeout(() => {
      this._holdTimer = null;
      this._openArmed();
    }, VARIANT_HOLD_MS);
  }

  /** Cancel a pending hold timer. Safe when none is armed. */
  private _clearHold(): void {
    if (this._holdTimer !== null) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  private _openArmed(): void {
    const keyEl = this._armedKeyEl;
    this._armedKeyEl = null;
    if (!keyEl) return;
    // A live popup on another key re-anchors instead of opening a second one.
    // The reused Popover hosts one session at a time and `_open` destroys its
    // content, so the new key waits for the framework to report the close;
    // opening synchronously would empty the still-visible overlay.
    if (this._popover) {
      if (keyEl === this._anchorKeyEl) return;
      this._clearHold();
      // The deferred open still owes this press its swallowed lift-off, which
      // may arrive before the close does.
      this._consumeRelease = this._pressLive;
      this._originKeyValue = keyEl.dataset.key ?? null;
      this._pendingAnchorKeyEl = keyEl;
      this._dismiss(true);
      return;
    }
    const resolution = this._host.resolveVariants(keyEl);
    if (!resolution || resolution.glyphs.length === 0) return;
    this._open(keyEl, resolution);
  }

  private _open(anchorKeyEl: HTMLElement, { base, glyphs }: VariantResolution): void {
    this._anchorKeyEl = anchorKeyEl;
    // Only a press owes a lift-off; the right-click path has none to swallow.
    this._consumeRelease = this._pressLive;
    this._originKeyValue = anchorKeyEl.dataset.key ?? null;
    this._rtl = getComputedStyle(anchorKeyEl).direction === "rtl";
    this._activeIndex = 0;

    // Resting footprint of the anchor key. offsetWidth/offsetHeight give the
    // layout border-box, unaffected by the pressed scale() transform on the held
    // key. Keys are flex:1 1 0, so width has no size token to reuse.
    const keyWidth = anchorKeyEl.offsetWidth;
    const keyHeight = anchorKeyEl.offsetHeight;

    // The control owns the Popover in its hidden `_variantPopover` aggregation;
    // reuse that single instance and rebuild its content each open. Wire the
    // afterClose teardown once, on the persistent instance.
    const popover = this._host.getVariantPopover();
    if (this._wiredPopover !== popover) {
      popover.attachAfterClose(this._onAfterClose);
      this._wiredPopover = popover;
    }
    // Clear the previous session's content and label before rebuilding.
    popover.destroyContent();
    popover.removeAllAriaLabelledBy();
    this._label?.destroy();
    this._label = null;

    this._buttons = glyphs.map((glyph, index) => {
      const button = new Button({
        text: glyph,
        type: index === 0 ? ButtonType.Emphasized : ButtonType.Default,
        press: () => this._commitIndex(index),
      });
      button.addStyleClass(KIOSK_KEYBOARD_DOM.classes.variantOption);
      // Roving tab chain: only the active option is a tab stop (framework-honored
      // flag the button renderer reads to emit tabindex="-1").
      button._bExcludeFromTabChain = index !== 0;
      return button;
    });

    const grid = new FlexBox({
      wrap: FlexWrap.Wrap,
      renderType: FlexRendertype.Bare,
      items: this._buttons,
    });
    grid.addStyleClass(KIOSK_KEYBOARD_DOM.classes.variantPopup);

    // Publish the option footprint from the grid's own onAfterRendering, which
    // Popup.open fires inline while rendering the content and before it positions
    // the overlay. Sizing after openBy would leave the framework to dock, flip and
    // point the arrow against theme-default button sizes, and re-dock only when
    // the poll-based ResizeHandler catches up.
    const keyboardRoot = anchorKeyEl.closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.root);
    const heightToken = keyboardRoot
      ? getComputedStyle(keyboardRoot).getPropertyValue("--ui5KioskKeyboard-keyHeight").trim()
      : "";
    grid.addEventDelegate(
      {
        onAfterRendering: () => {
          const dom = grid.getDomRef();
          if (!(dom instanceof HTMLElement)) return;
          // Size each option to the anchor key's footprint. The static-area
          // popover inherits none of the keyboard's key-size tokens, so both
          // dimensions are set on the option grid: width as the resting px,
          // height as the key-height token value read off the keyboard root.
          // Glyph size tracks the popover's inherited key density.
          dom.style.setProperty("--_ui5KioskKeyboard-variantOptionWidth", `${keyWidth}px`);
          dom.style.setProperty("--_ui5KioskKeyboard-variantOptionHeight", heightToken || `${keyHeight}px`);
          // Group the options for assistive technology, matching the sibling webc
          // twin. `sap/m/FlexBox` exposes no role, and its renderer emits no
          // accessibility state, so the role is set on the element here. The
          // Popover's `aria-labelledby` already names the group, so the toolbar
          // itself needs no name.
          dom.setAttribute("role", "toolbar");
          // Mirror the option order from the same direction the arrow polarity
          // reads, so ArrowLeft always moves focus visually leftward. The popover
          // renders in the static area and inherits no direction from the
          // keyboard, and UI5's own arrow remap keys on the page-global RTL
          // config, which cannot see a `dir` applied locally to the keyboard.
          dom.style.direction = this._rtl ? "rtl" : "ltr";
        },
      },
      this,
    );
    popover.addContent(grid);

    // The localized "N variants for {base}" group name, built once and shared by
    // the Popover's aria-labelledby (via this InvisibleText) and the live-region
    // open announcement, so the option grid announces as a named group.
    const labelText = getText("ARIA_VARIANTS_OPENED", "{0} variants for {1}")
      .replace("{0}", String(glyphs.length))
      .replace("{1}", base);
    const label = new InvisibleText({ text: labelText }).toStatic();
    this._label = label;
    popover.addAriaLabelledBy(label);
    const firstButton = this._buttons[0];
    if (firstButton) popover.setInitialFocus(firstButton);

    // The control-owned getter syncs the ambient content density. When none is
    // inherited, derive one from the current key size (the keyboard's own
    // container-query scaling sets no density class to inherit).
    if (!popover.hasStyleClass("sapUiSizeCompact") && !popover.hasStyleClass("sapUiSizeCondensed")) {
      const derived = variantDensityClass(keyHeight);
      if (derived) popover.addStyleClass(derived);
    }
    this._popover = popover;

    // Mark the anchor so its pressed scale() transform is neutralized while the
    // popup is open. openBy measures this key's rect as the Popover's follow-of
    // docking baseline; without this the rect shrinks under the pressed transform
    // and then grows back when the press releases, and the follow-of re-docks the
    // popup a few pixels sideways. The marker must be on before openBy so the
    // baseline is already the resting box.
    anchorKeyEl.classList.add(KIOSK_KEYBOARD_DOM.classes.keyVariantAnchor);
    popover.openBy(anchorKeyEl);

    // Keyboard navigation lives on the grid: it intercepts Arrow/Home/End/Enter/
    // Space/Escape before the button's own key handling so it can rove focus and
    // commit, and stops them from reaching the docked keyboard behind the popup.
    const gridDom = grid.getDomRef();
    if (gridDom instanceof HTMLElement) {
      this._gridDom = gridDom;
      gridDom.addEventListener("keydown", this._onKeydown);
    }

    // Seat the roving focus on the first option immediately (the Popover's own
    // initialFocus runs after its open animation; this keeps focus inside the
    // grid synchronously so arrow navigation works from the first keystroke).
    this._buttons[0]?.focus();

    // Touch drag-release: while the initiating finger is still down, track it so
    // dragging onto an option and lifting commits it (mouse never fires these).
    document.addEventListener("touchmove", this._onDocTouchMove, { passive: false });
    document.addEventListener("touchend", this._onDocTouchEnd);

    this._host.announceOpen(labelText);
  }

  // ── Keyboard navigation ──

  private _handleKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case "ArrowRight":
        this._setActive(this._activeIndex + (this._rtl ? -1 : 1));
        break;
      case "ArrowLeft":
        this._setActive(this._activeIndex + (this._rtl ? 1 : -1));
        break;
      case "ArrowDown":
        this._setActive(this._activeIndex + 1);
        break;
      case "ArrowUp":
        this._setActive(this._activeIndex - 1);
        break;
      case "Home":
        this._setActive(0);
        break;
      case "End":
        this._setActive(this._buttons.length - 1);
        break;
      case "Enter":
      case " ":
        this._commitIndex(this._activeIndex);
        break;
      case "Escape":
        this._dismiss(true);
        break;
      default:
        return;
    }
    // Owned here: keep the keystroke off the buttons' native activation and off
    // the docked keyboard's document-level handlers behind the popup.
    event.preventDefault();
    event.stopPropagation();
  }

  private _setActive(index: number): void {
    const count = this._buttons.length;
    if (count === 0) return;
    const clamped = Math.max(0, Math.min(count - 1, index));
    if (clamped === this._activeIndex) return;
    const previous = this._buttons[this._activeIndex];
    const next = this._buttons[clamped];
    if (previous) {
      previous.setType(ButtonType.Default);
      previous._bExcludeFromTabChain = true;
    }
    if (next) {
      next.setType(ButtonType.Emphasized);
      next._bExcludeFromTabChain = false;
      next.focus();
    }
    this._activeIndex = clamped;
  }

  // ── Touch drag-release ──

  private _handleDocTouchMove(event: TouchEvent): void {
    const index = this._optionIndexFromTouch(event);
    if (index < 0) return;
    event.preventDefault();
    this._setActive(index);
  }

  private _handleDocTouchEnd(event: TouchEvent): void {
    const index = this._optionIndexFromTouch(event);
    // A drag that ends over an option commits it; a hold released in place
    // (finger still on the origin key) leaves the popup open (sticky).
    if (index >= 0) this._commitIndex(index);
  }

  private _optionIndexFromTouch(event: TouchEvent): number {
    const touch = event.changedTouches[0] ?? event.touches[0];
    if (!touch) return -1;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const option = el?.closest(KIOSK_KEYBOARD_DOM.selectors.variantOption);
    if (!(option instanceof HTMLElement)) return -1;
    return this._buttons.findIndex((button) => button.getDomRef() === option);
  }

  // ── Commit / cancel / close ──

  private _commitIndex(index: number): void {
    const glyph = this._buttons[index]?.getText();
    this._dismiss(false);
    if (glyph !== undefined && glyph !== "") this._host.commitVariant(glyph);
  }

  /**
   * Closes the popup (the control-owned Popover is reused, not destroyed) and
   * restores focus. `announce` is false for a commit. Idempotent: clearing
   * `_popover` before `close()` makes the `afterClose` re-entry a no-op, and a
   * framework-initiated close (outside press / Escape) reaches here with
   * `_popover` still set and runs the full teardown once.
   */
  private _dismiss(announce: boolean): void {
    const popover = this._popover;
    if (!popover) return;
    const anchor = this._anchorKeyEl;
    const hadFocus = popover.getDomRef()?.contains(document.activeElement) ?? false;

    // Restore the anchor key's normal pressed transform: the popup no longer
    // docks to it, so its rect is free to change again.
    anchor?.classList.remove(KIOSK_KEYBOARD_DOM.classes.keyVariantAnchor);

    this._teardownOpenState();
    this._anchorKeyEl = null;
    this._popover = null;
    // The content (grid/buttons) and label stay on the closed Popover for the
    // close animation; they are torn down at the next `_open` (destroyContent /
    // removeAllAriaLabelledBy / label destroy) and with the control on `exit`.
    if (popover.isOpen()) popover.close();

    // Restore focus to the origin key when focus was inside the popup (Escape,
    // keyboard commit, click on an option). An outside press that moved focus
    // elsewhere keeps it there.
    if (hadFocus && anchor && document.contains(anchor)) {
      anchor.focus();
    }

    if (announce) this._host.announceDismiss();
  }

  private _teardownOpenState(): void {
    // Only drop the release suppression once the press that armed it has ended.
    // A commit or dismissal while that press is still down (a second finger
    // picking an option) leaves it armed, so the opening gesture's own lift-off
    // still does not insert the base glyph; `shouldSuppressRelease` spends it.
    if (!this._pressLive) {
      this._consumeRelease = false;
      this._originKeyValue = null;
    }
    document.removeEventListener("touchmove", this._onDocTouchMove);
    document.removeEventListener("touchend", this._onDocTouchEnd);
    this._gridDom?.removeEventListener("keydown", this._onKeydown);
    this._gridDom = null;
    this._buttons = [];
    this._activeIndex = 0;
  }
}
