import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import MessageToast from "sap/m/MessageToast";
import { Scope } from "../constants";
import BaseController from "./BaseController";

type DemoKioskInputHost = HTMLElement & {
  value?: string;
  focusInner?: () => void;
};

/**
 * Demonstrates the `inputIds` property — the keyboard only responds to
 * focus events from the listed input controls.
 *
 * @name demo.hotkeys.controller.KioskInputIds
 */
export default class KioskInputIds extends BaseController {
  private _wcFocusInHandler: ((event: FocusEvent) => void) | null = null;
  private _wcInputHandler: ((event: Event) => void) | null = null;
  private _nativeAlertHandler: ((event: Event) => void) | null = null;

  onInit(): void {
    this.getStateModel().setProperty("/kioskCurrentTarget", "None");

    // Track target changes via afterOpen/key events
    const kb = this.byId("inputIdsKeyboard") as KioskKeyboard;
    kb.attachEvent("afterOpen", () => {
      this._updateTargetStatus();
    });

    const bridge = this.byId("wcBridgeInput") as Input;
    bridge.attachLiveChange(() => {
      const host = this._getWebComponentHost();
      if (host) {
        this._writeHostValue(host, bridge.getValue());
      }
    });
  }

  onAfterRendering(): void {
    this._detachWebComponentBridge();
    this._detachNativeCustomElementListener();

    const view = this.getView();
    if (!view) return;
    const viewDom = view.getDomRef();
    if (viewDom instanceof HTMLElement) {
      this._nativeAlertHandler = (event: Event) => {
        const custom = event as CustomEvent<{ message?: string }>;
        const message = custom.detail?.message ?? "Custom element event";
        MessageToast.show(message);
      };
      viewDom.addEventListener("demo-alert", this._nativeAlertHandler as EventListener);
    }

    this._attachWebComponentBridge();
  }

  onExit(): void {
    this._detachWebComponentBridge();
    this._detachNativeCustomElementListener();
  }

  onKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this._updateTargetStatus();
    const key = event.getParameter("key") ?? "";
    const shift = event.getParameter("shiftKey") ?? false;
    const display = shift ? `${key} (Shift)` : key;
    this.getStateModel().setProperty("/kioskLastKey", display);
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  private _updateTargetStatus(): void {
    const kb = this.byId("inputIdsKeyboard") as KioskKeyboard;
    const targetId = kb.getTargetInput();
    this.getStateModel().setProperty("/kioskCurrentTarget", targetId || "None");
  }

  private _getWebComponentHost(): DemoKioskInputHost | null {
    const wcControl = this.byId("wcInputTarget");
    const dom = wcControl?.getDomRef?.();
    if (!(dom instanceof HTMLElement)) return null;

    if (customElements.get("demo-kiosk-input")) {
      customElements.upgrade(dom);
    }

    return dom as DemoKioskInputHost;
  }

  private _attachWebComponentBridge(): void {
    const host = this._getWebComponentHost();
    if (!host) {
      return;
    }

    const bridge = this.byId("wcBridgeInput") as Input;
    const kb = this.byId("inputIdsKeyboard") as KioskKeyboard;

    this._wcFocusInHandler = () => {
      bridge.setValue(this._readHostValue(host));
      kb.setTargetInput(bridge);
      kb.show();
      this._updateTargetStatus();
    };

    this._wcInputHandler = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement) {
        bridge.setValue(target.value);
        return;
      }
      bridge.setValue(this._readHostValue(host));
    };

    host.addEventListener("focusin", this._wcFocusInHandler);
    host.addEventListener("input", this._wcInputHandler, true);
  }

  private _readHostValue(host: DemoKioskInputHost): string {
    if (typeof host.value === "string") {
      return host.value;
    }
    const input = host.querySelector("input");
    return input instanceof HTMLInputElement ? input.value : "";
  }

  private _writeHostValue(host: DemoKioskInputHost, next: string): void {
    if ("value" in host) {
      host.value = next;
      return;
    }
    const input = host.querySelector("input");
    if (input instanceof HTMLInputElement) {
      input.value = next;
    }
  }

  private _detachWebComponentBridge(): void {
    const host = this._getWebComponentHost();
    if (host && this._wcFocusInHandler) {
      host.removeEventListener("focusin", this._wcFocusInHandler);
    }
    if (host && this._wcInputHandler) {
      host.removeEventListener("input", this._wcInputHandler, true);
    }
    this._wcFocusInHandler = null;
    this._wcInputHandler = null;
  }

  private _detachNativeCustomElementListener(): void {
    const view = this.getView();
    if (!view) {
      this._nativeAlertHandler = null;
      return;
    }
    const viewDom = view.getDomRef();
    if (viewDom instanceof HTMLElement && this._nativeAlertHandler) {
      viewDom.removeEventListener("demo-alert", this._nativeAlertHandler as EventListener);
    }
    this._nativeAlertHandler = null;
  }
}
