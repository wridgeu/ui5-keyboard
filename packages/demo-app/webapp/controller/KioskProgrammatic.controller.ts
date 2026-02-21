import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent, KioskKeyboard$LayoutChangeEvent } from "ui5/kiosk/KioskKeyboard";
import type { LayoutDefinition } from "ui5/kiosk/types";
import MessageToast from "sap/m/MessageToast";
import type { Select$ChangeEvent } from "sap/m/Select";
import Select from "sap/m/Select";
import Item from "sap/ui/core/Item";
import fkeyRow from "ui5/kiosk/layouts/fkey-row";
import navRow from "ui5/kiosk/layouts/nav-row";
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
    stateModel.setProperty("/kioskLayout", "qwerty");
    stateModel.setProperty("/kioskLastKey", "None");
    stateModel.setProperty("/kioskEnabled", true);

    const select = this.byId("layoutSelect") as Select;
    for (const name of KioskKeyboard.getRegisteredLayoutNames()) {
      select.addItem(new Item({ key: name, text: name }));
    }
    select.setSelectedKey("qwerty");
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

  onLayoutChange(event: Select$ChangeEvent): void {
    const name = event.getParameter("selectedItem")?.getKey();
    if (!name) return;

    const kb = this._getKeyboard();
    kb.resetKeyboardType();
    kb.setLayout(name);
    this._updateStatus();
  }

  onUseFKeys(): void {
    const kb = this._getKeyboard();
    kb.resetKeyboardType();
    kb.setLayout("fkeys");
    this._updateStatus();
  }

  onUseNav(): void {
    const kb = this._getKeyboard();
    kb.resetKeyboardType();
    kb.setLayout("nav");
    this._updateStatus();
  }

  onUseQwertyNav(): void {
    const kb = this._getKeyboard();
    kb.resetKeyboardType();
    kb.setLayout("qwerty-nav");
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

  onRegisterQwertyFkNav(): void {
    const base = KioskKeyboard.getRegisteredLayout("qwerty");
    if (!base) {
      MessageToast.show("Base layout qwerty is unavailable");
      return;
    }

    const qwertyFkNav: LayoutDefinition = [fkeyRow, navRow, ...base];
    KioskKeyboard.registerLayout("qwerty-fk-nav-demo", qwertyFkNav);

    const select = this.byId("layoutSelect") as Select;
    if (!select.getItemByKey("qwerty-fk-nav-demo")) {
      select.addItem(new Item({ key: "qwerty-fk-nav-demo", text: "qwerty-fk-nav-demo" }));
    }

    MessageToast.show("qwerty-fk-nav-demo layout registered");
  }

  onUseQwertyFkNav(): void {
    const kb = this._getKeyboard();
    kb.resetKeyboardType();
    kb.setLayout("qwerty-fk-nav-demo");
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

  onLayoutEvent(_event: KioskKeyboard$LayoutChangeEvent): void {
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
    stateModel.setProperty("/kioskLayout", kb.getLayout());

    const select = this.byId("layoutSelect") as Select;
    if (select.getSelectedKey() !== kb.getLayout()) {
      select.setSelectedKey(kb.getLayout());
    }
  }
}
