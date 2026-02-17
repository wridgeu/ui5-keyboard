import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import { Scope } from "../constants";
import BaseController from "./BaseController";

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

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  private _updateTargetStatus(): void {
    const kb = this.byId("inputIdsKeyboard") as KioskKeyboard;
    const targetId = kb.getTargetInput();
    this.getStateModel().setProperty("/kioskCurrentTarget", targetId || "None");
  }
}
