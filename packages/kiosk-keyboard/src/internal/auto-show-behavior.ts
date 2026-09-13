import BaseObject from "sap/ui/base/Object";
import Control from "sap/ui/core/Control";
import { detectKeyboardType as detectKbType } from "./detect-keyboard-type";
import { isParticipating } from "./dom";
import type { TargetResolver } from "../types";
import type { KeyboardType } from "../library";
import type { KioskKeyboard$KeyboardTypeChangeEventParameters } from "../KioskKeyboard";

/**
 * Tracks who last set the keyboard type, so auto-detect knows whether it
 * is allowed to override the current value.
 *
 * - `"unset"`: not yet set
 * - `"explicit"`: app-level setKeyboardType() / property binding
 * - `` `auto:${KeyboardType}` ``: previously auto-detected for the named type
 */
export type KeyboardTypeSource = "unset" | "explicit" | `auto:${KeyboardType}`;

interface AutoShowBehaviorHost extends Pick<Control, "getDomRef" | "getVisible" | "setProperty"> {
  // Auto-detect always supplies all three fields, so tighten the generated
  // (all-optional) shape with Required<> here.
  fireKeyboardTypeChange(parameters: Required<KioskKeyboard$KeyboardTypeChangeEventParameters>): void;
  getDocked(): boolean;
  getEnabled(): boolean;
  getAutoShow(): boolean;
  getAutoType(): boolean;
  getKeyboardType(): KeyboardType;
  getControls(): string[];
  show(): void;
  close(): void;
  isOpen(): boolean;

  _getActiveTargetId(): string;
  _getEffectiveResolver(): TargetResolver | null;
  _setActiveTarget(target?: string | Control): void;
  _syncControls(): void;
  _resolveClaimableControl(target: EventTarget | null): Control | null;
  _wouldClaimInput(target: EventTarget | null): boolean;
  _isNodeInVariantPopover(node: Node | null): boolean;
  _getKeyboardTypeSource(): KeyboardTypeSource;
  _setKeyboardTypeSource(source: KeyboardTypeSource): void;
}

export default class AutoShowBehavior extends BaseObject {
  private _host: AutoShowBehaviorHost;
  /** Detaches the document focus listeners of the armed period, or `null` while disarmed. */
  private _abort: AbortController | null = null;
  private _deferredCloseId: number | null = null;

  constructor(host: AutoShowBehaviorHost) {
    super();
    this._host = host;
  }

  enable(): void {
    if (this._abort) return;
    this._abort = new AbortController();
    const { signal } = this._abort;
    document.addEventListener("focusin", (e) => this._onDocumentFocusIn(e), { capture: true, signal });
    document.addEventListener("focusout", (e) => this._onDocumentFocusOut(e), { capture: true, signal });
  }

  disable(): void {
    if (!this._abort) return;
    this.cancelPendingClose();
    this._abort.abort();
    this._abort = null;
  }

  isActive(): boolean {
    return this._abort !== null;
  }

  cancelPendingClose(): void {
    if (this._deferredCloseId !== null) {
      cancelAnimationFrame(this._deferredCloseId);
      this._deferredCloseId = null;
    }
  }

  onAfterRendering(): void {
    if (this._host.getDocked() && this._host.getAutoShow() && !this.isActive()) {
      this.enable();
    }
  }

  private _onDocumentFocusIn(event: FocusEvent): void {
    if (!this._host.getDocked() || !isParticipating(this._host)) return;

    if (this._host.getControls().length > 0) {
      this._host._syncControls();
    }

    const target = event.target instanceof Node ? event.target : null;

    // Ignore focus on the keyboard itself; the rAF callback's own
    // dom.contains(active) guard will keep the keyboard open.
    const myDom = this._host.getDomRef();
    if (myDom && myDom.contains(target)) return;

    // Only claim textual inputs not deferred to native or owned by another instance
    const ui5Control = this._host._resolveClaimableControl(target);
    if (!ui5Control) return;

    // Focus landed on a claimable input, so cancel any pending close
    this.cancelPendingClose();

    // Detection reads the target's authored metadata, so it runs before
    // _setActiveTarget: while the keyboard is open that call writes
    // inputmode="none" on the new target, masking an authored numeric/decimal/tel
    // value. The already-active target carries that mask from its previous focus,
    // so a refocus is not detectable and keeps the type it has. While the keyboard
    // is closed nothing carries the mask, so a target claimed ahead of its first
    // focus - a single `controls` entry - is still read from its authored markup.
    const detectable = this._host._getActiveTargetId() !== ui5Control.getId() || !this._host.isOpen();
    const detected = detectable ? detectKbType(ui5Control, this._host._getEffectiveResolver()) : null;

    this._host._setActiveTarget(ui5Control);

    // Apply the detected keyboard type.
    // Skip if re-entrancy (from deferred change handler) superseded this target.
    if (
      detected !== null &&
      this._host.getAutoType() &&
      this._host._getKeyboardTypeSource() !== "explicit" &&
      this._host._getActiveTargetId() === ui5Control.getId()
    ) {
      const previous = this._host.getKeyboardType();
      // Only (re)apply detection when the type actually changes. Re-running on
      // every focusin (e.g. moving between two plain text inputs) would call
      // _setKeyboardTypeSource, which resets the user-driven {layout:*} override
      // (LayoutState source -> "external") and reverts a layout the user
      // explicitly chose. Mirrors the webc focusin guard
      // (`if (detected !== this.keyboardType)`).
      if (detected !== previous) {
        this._host._setKeyboardTypeSource(`auto:${detected}`);
        this._host.setProperty("keyboardType", detected);
        this._host.fireKeyboardTypeChange({
          keyboardType: detected,
          previousKeyboardType: previous,
          autoDetected: true,
        });
      }
    }

    this._host.show();
  }

  private _onDocumentFocusOut(event: FocusEvent): void {
    if (!this._host.getDocked() || !this._host.isOpen()) return;

    const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;

    // Fast path: focus staying on the keyboard itself
    const myDom = this._host.getDomRef();
    if (myDom && related && myDom.contains(related)) return;

    // Fast path: focus moving to an input this keyboard would claim
    if (this._host._wouldClaimInput(related)) return;

    // Fast path: focus moving into the keyboard's own accent-variant popover,
    // whose options render into the static area outside the keyboard DOM.
    if (this._host._isNodeInVariantPopover(related)) return;

    // Defer to next frame so activeElement has settled, then re-check.
    // relatedTarget can be null in some browser/shadow-DOM transitions,
    // and rAF lets us inspect the true destination in all cases.
    this.cancelPendingClose();
    this._deferredCloseId = requestAnimationFrame(() => {
      this._deferredCloseId = null;
      if (!this._host.getDocked() || !this._host.isOpen()) return;
      const active = document.activeElement;
      const dom = this._host.getDomRef();
      if (dom && active && dom.contains(active)) return;
      if (this._host._wouldClaimInput(active)) return;
      if (this._host._isNodeInVariantPopover(active)) return;
      this._host.close();
    });
  }

  override destroy(): void {
    this.cancelPendingClose();
    this.disable();
    super.destroy();
  }
}
