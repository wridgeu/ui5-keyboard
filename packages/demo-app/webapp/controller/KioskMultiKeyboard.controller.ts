import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Two independent KioskKeyboard instances on one page — demonstrates
 * instance isolation via `inputIds`.
 *
 * @name demo.hotkeys.controller.KioskMultiKeyboard
 */
export default class KioskMultiKeyboard extends BaseController {
  onInit(): void {
    const stateModel = this.getStateModel();
    stateModel.setProperty("/multiSearchLastKey", "None");
    stateModel.setProperty("/multiQuantityLastKey", "None");
    stateModel.setProperty("/multiDockedOpen", false);
  }

  onSearchKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    const key = event.getParameter("key") ?? "";
    const shift = event.getParameter("shiftKey") ?? false;
    const display = shift ? `${key} (Shift)` : key;
    this.getStateModel().setProperty("/multiSearchLastKey", display);
  }

  onQuantityKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    const key = event.getParameter("key") ?? "";
    const shift = event.getParameter("shiftKey") ?? false;
    const display = shift ? `${key} (Shift)` : key;
    this.getStateModel().setProperty("/multiQuantityLastKey", display);
  }

  onSearchAfterOpen(): void {
    this.getStateModel().setProperty("/multiDockedOpen", true);
  }

  onSearchAfterClose(): void {
    this.getStateModel().setProperty("/multiDockedOpen", false);
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }
}
