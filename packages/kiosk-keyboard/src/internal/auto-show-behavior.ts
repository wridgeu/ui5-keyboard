import BaseObject from "sap/ui/base/Object";
import Control from "sap/ui/core/Control";
import { detectKeyboardType as detectKbType } from "./detect-keyboard-type";
import type { TargetResolverFn } from "./dom";

interface AutoShowBehaviorHost {
  getDocked(): boolean;
  getVisible(): boolean;
  getEnabled(): boolean;
  getAutoShow(): boolean;
  getAutoType(): boolean;
  getKeyboardType(): string;
  getControls(): string[];
  getDomRef(): Element | null;
  show(): unknown;
  close(): unknown;
  setProperty(name: string, value: unknown): unknown;
  fireEvent(name: string, parameters: Record<string, unknown>): boolean | unknown;

  _getActiveTargetId(): string;
  _getEffectiveResolver(): TargetResolverFn | null;
  _setActiveTarget(target?: string | Control): unknown;
  _setupControls(): void;
  _resolveClaimableControl(target: EventTarget | null): Control | null;
  _wouldClaimInput(target: EventTarget | null): boolean;
  _getKeyboardTypeSource(): string;
  _setKeyboardTypeSource(source: string): void;
  isOpen(): boolean;
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

  _isParticipationActive(): boolean {
    if (!this._host.getVisible() || !this._host.getEnabled()) return false;
    const dom = this._host.getDomRef();
    if (!(dom instanceof HTMLElement)) return false;
    if (!document.contains(dom)) return false;
    return dom.getClientRects().length > 0;
  }

  private _onDocumentFocusIn(event: FocusEvent): void {
    if (!this._host.getDocked() || !this._isParticipationActive()) return;

    if (this._host.getControls().length > 0) {
      this._host._setupControls();
    }

    const target = event.target as HTMLElement;

    const myDom = this._host.getDomRef();
    if (myDom && myDom.contains(target)) return;

    const ui5Control = this._host._resolveClaimableControl(target);
    if (!ui5Control) return;

    this.cancelPendingClose();

    this._host._setActiveTarget(ui5Control);

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
        this._host.fireEvent("keyboardTypeChange", {
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

    const myDom = this._host.getDomRef();
    if (myDom && related && myDom.contains(related)) return;

    if (this._host._wouldClaimInput(related)) return;

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
