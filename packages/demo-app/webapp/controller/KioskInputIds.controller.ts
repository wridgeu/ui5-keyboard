import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import CustomAlertButton from "demo/hotkeys/webc/CustomAlertButton";
import Input from "sap/m/Input";
import MessageToast from "sap/m/MessageToast";
import HTML from "sap/ui/core/HTML";
import { Scope } from "../constants";
import BaseController from "./BaseController";

class DemoKioskInput extends HTMLElement {
  private _input: HTMLInputElement | null = null;

  connectedCallback(): void {
    if (this._input) return;
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Custom element input";
    input.style.width = "100%";
    input.style.padding = "0.625rem";
    input.style.border = "1px solid #c8d0d8";
    input.style.borderRadius = "0.5rem";
    input.style.boxSizing = "border-box";
    input.style.font = '400 1rem/1.4 "72", Arial, sans-serif';
    this.append(input);
    this._input = input;
  }

  get value(): string {
    return this._input?.value ?? "";
  }

  set value(next: string) {
    if (this._input) {
      this._input.value = next;
    }
  }

  focusInner(): void {
    this._input?.focus();
  }
}

if (!customElements.get("demo-kiosk-input")) {
  customElements.define("demo-kiosk-input", DemoKioskInput);
}

void CustomAlertButton;

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
        host.value = bridge.getValue();
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

    const host = this._getWebComponentHost();
    if (!host) return;

    const bridge = this.byId("wcBridgeInput") as Input;
    const kb = this.byId("inputIdsKeyboard") as KioskKeyboard;

    this._wcFocusInHandler = () => {
      bridge.setValue(host.value);
      kb.setTargetInput(bridge);
      kb.show();
      bridge.focus();
      this._updateTargetStatus();
    };

    this._wcInputHandler = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      bridge.setValue(target.value);
    };

    host.addEventListener("focusin", this._wcFocusInHandler);
    host.addEventListener("input", this._wcInputHandler, true);
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

  private _getWebComponentHost(): DemoKioskInput | null {
    const html = this.byId("wcHost") as HTML;
    const dom = html.getDomRef();
    if (!(dom instanceof HTMLElement)) return null;
    const host = dom.querySelector("#wcInputTarget");
    if (!(host instanceof DemoKioskInput)) return null;
    return host;
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
