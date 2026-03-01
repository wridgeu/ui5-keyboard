import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import { Scope } from "../constants";
import BaseController from "./BaseController";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";

/**
 * Combined integration demo for ui5.hotkeys and ui5.kiosk.
 *
 * @name demo.hotkeys.controller.Integration
 */
export default class Integration extends BaseController {
  private static readonly COMBO_HOTKEY = "Ctrl+Shift+M";

  private _hotkeys!: RegistrationGroup;

  onInit(): void {
    this.getView()!.setModel(new JSONModel({ lastKioskKey: "None" }), "integration");

    const manager = this.getTypedComponent().getHotkeyManager();
    this._hotkeys = manager.createGroup();

    const stateModel = this.getStateModel();
    stateModel.setProperty("/comboStatus", `Try ${Integration.COMBO_HOTKEY} or type with the virtual keyboard.`);
    stateModel.setProperty("/comboText", "");

    this._hotkeys.register(
      Integration.COMBO_HOTKEY,
      () => {
        const previous = (stateModel.getProperty("/comboText") as string) || "";
        const next = `${previous}${previous ? " " : ""}[hotkey:${Integration.COMBO_HOTKEY}]`;
        stateModel.setProperty("/comboText", next);
        stateModel.setProperty("/comboStatus", `${Integration.COMBO_HOTKEY} fired via HotkeyManager.`);
        stateModel.setProperty("/lastAction", "Integration hotkey fired");
        MessageToast.show(`${Integration.COMBO_HOTKEY}: Integration hotkey fired`);
      },
      {
        scope: Scope.Integration,
        description: "Integration hotkey",
      },
    );
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.Main);
  }

  onKioskKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    const key = event.getParameter("key") ?? "";
    const shift = event.getParameter("shiftKey") ?? false;
    const display = shift ? `${key} (Shift)` : key;
    const stateModel = this.getStateModel();
    const viewModel = this.getView()!.getModel("integration") as JSONModel;

    viewModel.setProperty("/lastKioskKey", display || "None");
    stateModel.setProperty("/lastAction", "Kiosk keyPress event");
  }

  onExit(): void {
    this._hotkeys.destroyAll();
  }
}
