import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import type UI5Event from "sap/ui/base/Event";
import MessageToast from "sap/m/MessageToast";
import { Scope } from "../constants";
import BaseController from "./BaseController";

type AlertButtonDemoAlertEventParameters = {
  message?: string;
  detail?: {
    message?: string;
  };
  originalEvent?: CustomEvent<{ message?: string }>;
};

type AlertButton$DemoAlertEvent = UI5Event<AlertButtonDemoAlertEventParameters>;

/**
 * Demonstrates the `inputIds` property — the keyboard only responds to
 * focus events from the listed input controls.
 *
 * @name demo.hotkeys.controller.KioskInputIds
 */
export default class KioskInputIds extends BaseController {
  onInit(): void {
    this.getStateModel().setProperty("/kioskCurrentTarget", "None");

    // Track target changes via afterOpen/key events
    const kb = this.byId("inputIdsKeyboard") as KioskKeyboard;
    kb.attachEvent("afterOpen", () => {
      this._updateTargetStatus();
    });
  }

  onKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this._updateTargetStatus();
    const key = event.getParameter("key") ?? "";
    const shift = event.getParameter("shiftKey") ?? false;
    const display = shift ? `${key} (Shift)` : key;
    this.getStateModel().setProperty("/kioskLastKey", display);
  }

  onDemoAlert(event: AlertButton$DemoAlertEvent): void {
    const message =
      event.getParameter("message") ??
      event.getParameter("detail")?.message ??
      event.getParameter("originalEvent")?.detail?.message ??
      "Custom element event";
    MessageToast.show(message);
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  private _updateTargetStatus(): void {
    const kb = this.byId("inputIdsKeyboard") as KioskKeyboard;
    const targetId = kb.getTargetInput();
    this.getStateModel().setProperty("/kioskCurrentTarget", targetId || "None");
  }
}
