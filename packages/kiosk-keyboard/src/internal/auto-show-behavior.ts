import BaseObject from "sap/ui/base/Object";
import Control from "sap/ui/core/Control";
import { detectKeyboardType as detectKbType } from "./detect-keyboard-type";
import type { TargetResolverFn } from "./dom";
import type { KeyboardType } from "../library";

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
  fireKeyboardTypeChange(parameters: {
    keyboardType: KeyboardType;
    previousKeyboardType: KeyboardType;
    autoDetected: boolean;
  }): void;
  getDocked(): boolean;
  getEnabled(): boolean;
  getAutoShow(): boolean;
  getAutoType(): boolean;
  getKeyboardType(): KeyboardType;
  getControls(): string[];
  show(): unknown;
  close(): unknown;
  isOpen(): boolean;

  _getActiveTargetId(): string;
  _getEffectiveResolver(): TargetResolverFn | null;
  _setActiveTarget(target?: string | Control): unknown;
  _setupControls(): void;
  _resolveClaimableControl(target: EventTarget | null): Control | null;
  _wouldClaimInput(target: EventTarget | null): boolean;
  _getKeyboardTypeSource(): KeyboardTypeSource;
  _setKeyboardTypeSource(source: KeyboardTypeSource): void;
}

export default class AutoShowBehavior extends BaseObject {
  private _host: AutoShowBehaviorHost;
  private _active = false;
  private _deferredCloseId: number | null = null;
  private _boundFocusIn: (e: FocusEvent) => void;
  private _boundFocusOut: (e: FocusEvent) => void;

  constructor(host: AutoShowBehaviorHost) {
    super();
    this._host = host;
    this._boundFocusIn = this._onDocumentFocusIn.bind(this);
    this._boundFocusOut = this._onDocumentFocusOut.bind(this);
  }

  enable(): void {
    if (this._active) return;
    this._active = true;
    document.addEventListener("focusin", this._boundFocusIn, true);
    document.addEventListener("focusout", this._boundFocusOut, true);
  }

  disable(): void {
    if (!this._active) return;
    this._active = false;
    this.cancelPendingClose();
    document.removeEventListener("focusin", this._boundFocusIn, true);
    document.removeEventListener("focusout", this._boundFocusOut, true);
  }

  isActive(): boolean {
    return this._active;
  }

  cancelPendingClose(): void {
    if (this._deferredCloseId !== null) {
      cancelAnimationFrame(this._deferredCloseId);
      this._deferredCloseId = null;
    }
  }

  onAfterRendering(): void {
    if (this._host.getDocked() && this._host.getAutoShow() && !this._active) {
      this.enable();
    }
  }

  /** Whether the host is visible, enabled, attached, and has layout size. */
  private _isHostParticipating(): boolean {
    if (!this._host.getVisible() || !this._host.getEnabled()) return false;
    const dom = this._host.getDomRef();
    if (!(dom instanceof HTMLElement)) return false;
    if (!document.contains(dom)) return false;
    return dom.getClientRects().length > 0;
  }

  private _onDocumentFocusIn(event: FocusEvent): void {
    if (!this._host.getDocked() || !this._isHostParticipating()) return;

    if (this._host.getControls().length > 0) {
      this._host._setupControls();
    }

    const target = event.target as HTMLElement;

    // Ignore focus on the keyboard itself; the rAF callback's own
    // dom.contains(active) guard will keep the keyboard open.
    const myDom = this._host.getDomRef();
    if (myDom && myDom.contains(target)) return;

    // Only claim textual inputs not deferred to native or owned by another instance
    const ui5Control = this._host._resolveClaimableControl(target);
    if (!ui5Control) return;

    // Focus landed on a claimable input -- cancel any pending close
    this.cancelPendingClose();

    this._host._setActiveTarget(ui5Control);

    // Auto-detect keyboard type from input metadata.
    // Skip if re-entrancy (from deferred change handler) superseded this target.
    if (
      this._host.getAutoType() &&
      this._host._getKeyboardTypeSource() !== "explicit" &&
      this._host._getActiveTargetId() === ui5Control.getId()
    ) {
      const detected = detectKbType(ui5Control, this._host._getEffectiveResolver());
      const previous = this._host.getKeyboardType();
      this._host._setKeyboardTypeSource(`auto:${detected}`);
      this._host.setProperty("keyboardType", detected);
      if (detected !== previous) {
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

    const related = event.relatedTarget as HTMLElement | null;

    // Fast path: focus staying on the keyboard itself
    const myDom = this._host.getDomRef();
    if (myDom && related && myDom.contains(related)) return;

    // Fast path: focus moving to an input this keyboard would claim
    if (this._host._wouldClaimInput(related)) return;

    // Defer to next frame so activeElement has settled, then re-check.
    // relatedTarget can be null in some browser/shadow-DOM transitions,
    // and rAF lets us inspect the true destination in all cases.
    this.cancelPendingClose();
    this._deferredCloseId = requestAnimationFrame(() => {
      this._deferredCloseId = null;
      if (!this._host.getDocked() || !this._host.isOpen()) return;
      const active = document.activeElement as HTMLElement | null;
      const dom = this._host.getDomRef();
      if (dom && active && dom.contains(active)) return;
      if (this._host._wouldClaimInput(active)) return;
      this._host.close();
    });
  }

  destroy(): void {
    this.cancelPendingClose();
    this.disable();
    super.destroy();
  }
}
