import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import type { LayoutDefinition } from "ui5/kiosk/types";
import MessageToast from "sap/m/MessageToast";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Full programmatic API showcase — demonstrates show/close, keyboard type
 * switching, custom layout registration, and status tracking.
 *
 * @name demo.hotkeys.controller.KioskProgrammatic
 */
export default class KioskProgrammatic extends BaseController {
  onInit(): void {
    const stateModel = this.getStateModel();
    stateModel.setProperty("/kioskIsOpen", false);
    stateModel.setProperty("/kioskKeyboardType", "Full");
    stateModel.setProperty("/kioskLastKey", "None");
    stateModel.setProperty("/kioskEnabled", true);
  }

  onShow(): void {
    const kb = this._getKeyboard();
    kb.show();
  }

  onClose(): void {
    const kb = this._getKeyboard();
    kb.close();
  }

  onSetFull(): void {
    const kb = this._getKeyboard();
    kb.setKeyboardType("Full");
    kb.setLayout(KioskKeyboard.getLocaleLayout());
    this._updateStatus();
  }

  onSetNumpad(): void {
    const kb = this._getKeyboard();
    kb.setKeyboardType("Numpad");
    this._updateStatus();
  }

  onSetNumeric(): void {
    const kb = this._getKeyboard();
    kb.setKeyboardType("Numeric");
    this._updateStatus();
  }

  onResetType(): void {
    const kb = this._getKeyboard();
    kb.resetKeyboardType();
    kb.setLayout(KioskKeyboard.getLocaleLayout());
    this._updateStatus();
  }

  onRegisterPinpad(): void {
    const pinpad: LayoutDefinition = [
      [{ value: "1" }, { value: "2" }, { value: "3" }],
      [{ value: "4" }, { value: "5" }, { value: "6" }],
      [{ value: "7" }, { value: "8" }, { value: "9" }],
      [
        { value: "{backspace}", label: "", icon: "sap-icon://arrow-left", type: "action" },
        { value: "0" },
        { value: "{enter}", label: "", type: "action" },
      ],
    ];
    KioskKeyboard.registerLayout("pinpad", pinpad);
    MessageToast.show("Pinpad layout registered");
  }

  onUsePinpad(): void {
    const kb = this._getKeyboard();
    kb.resetKeyboardType();
    kb.setLayout("pinpad");
    this._updateStatus();
  }

  onEnabledChange(): void {
    // Two-way binding handles the update
  }

  onKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    const key = event.getParameter("key") ?? "";
    const shift = event.getParameter("shiftKey") ?? false;
    const display = shift ? `${key} (Shift)` : key;
    this.getStateModel().setProperty("/kioskLastKey", display);
  }

  onAfterOpen(): void {
    this._updateStatus();
  }

  onAfterClose(): void {
    this._updateStatus();
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  private _getKeyboard(): KioskKeyboard {
    return this.byId("progKeyboard") as KioskKeyboard;
  }

  private _updateStatus(): void {
    const kb = this._getKeyboard();
    const stateModel = this.getStateModel();
    stateModel.setProperty("/kioskIsOpen", kb.isOpen());
    stateModel.setProperty("/kioskKeyboardType", kb.getKeyboardType());
  }
}
