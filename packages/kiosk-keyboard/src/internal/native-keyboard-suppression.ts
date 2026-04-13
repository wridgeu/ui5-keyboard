import BaseObject from "sap/ui/base/Object";
import Element from "sap/ui/core/Element";
import Device from "sap/ui/Device";
import { resolveWithCustomResolver, type TargetResolverFn } from "./dom";
import { MobileKeyboard, type MobileKeyboardValue } from "../library";

type InputModeSuppressionState = {
  originalInputMode: string | null;
  refCount: number;
};

interface NativeKeyboardSuppressionHost {
  getMobileKeyboard(): MobileKeyboardValue;
  _getActiveTargetId(): string;
  _getEffectiveResolver(): TargetResolverFn | null;
}

export default class NativeKeyboardSuppression extends BaseObject {
  private _host: NativeKeyboardSuppressionHost;
  private _suppressedInputId: string | null = null;
  private static readonly _suppressions = new Map<string, InputModeSuppressionState>();

  constructor(host: NativeKeyboardSuppressionHost) {
    super();
    this._host = host;
  }

  shouldDeferToNative(): boolean {
    const mode = this._host.getMobileKeyboard();
    if (mode === MobileKeyboard.Custom) return false;
    if (mode === MobileKeyboard.Native) return true;
    return Device.system.phone || (Device.system.tablet && !Device.system.desktop);
  }

  suppress(): void {
    if (this.shouldDeferToNative()) return;

    const inputId = this._host._getActiveTargetId();
    if (!inputId) return;

    if (this._suppressedInputId === inputId) {
      this._resolveInputDom(inputId)?.setAttribute("inputmode", "none");
      return;
    }

    this.restore();

    const dom = this._resolveInputDom(inputId);
    if (!dom) return;

    const state = NativeKeyboardSuppression._suppressions.get(inputId);
    if (state) {
      state.refCount += 1;
    } else {
      NativeKeyboardSuppression._suppressions.set(inputId, {
        originalInputMode: dom.getAttribute("inputmode"),
        refCount: 1,
      });
    }

    dom.setAttribute("inputmode", "none");
    this._suppressedInputId = inputId;
  }

  restore(): void {
    const inputId = this._suppressedInputId;
    if (!inputId) return;

    const state = NativeKeyboardSuppression._suppressions.get(inputId);
    if (!state) {
      this._suppressedInputId = null;
      return;
    }

    state.refCount -= 1;

    const dom = this._resolveInputDom(inputId);

    if (state.refCount > 0) {
      dom?.setAttribute("inputmode", "none");
      this._suppressedInputId = null;
      return;
    }

    if (dom) {
      if (state.originalInputMode !== null) {
        dom.setAttribute("inputmode", state.originalInputMode);
      } else {
        dom.removeAttribute("inputmode");
      }
    }

    NativeKeyboardSuppression._suppressions.delete(inputId);
    this._suppressedInputId = null;
  }

  private _resolveInputDom(inputId: string): HTMLInputElement | HTMLTextAreaElement | null {
    const target = Element.getElementById(inputId);
    if (!target) return null;
    return resolveWithCustomResolver(target.getFocusDomRef(), this._host._getEffectiveResolver());
  }

  destroy(): void {
    this.restore();
    super.destroy();
  }
}
