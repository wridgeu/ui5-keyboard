import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Kiosk keyboard demo controller — demonstrates the ui5.kiosk library.
 *
 * Showcases:
 * - Docked keyboard that auto-shows when an input is focused
 * - Inline numpad for numeric-only fields
 * - keyPress and layoutChange event handling
 *
 * @name demo.hotkeys.controller.Kiosk
 */
export default class Kiosk extends BaseController {
  onInit(): void {
    const stateModel = this.getStateModel();
    stateModel.setProperty("/kioskLastKey", "None");
    stateModel.setProperty("/kioskLayout", "qwerty");
  }

  onKeyPress(event: { getParameter(name: string): unknown }): void {
    const key = event.getParameter("key") as string;
    const shift = event.getParameter("shiftKey") as boolean;
    const display = shift ? `${key} (Shift)` : key;

    this.getStateModel().setProperty("/kioskLastKey", display);
  }

  onLayoutChange(event: { getParameter(name: string): unknown }): void {
    const layout = event.getParameter("layout") as string;
    this.getStateModel().setProperty("/kioskLayout", layout);
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.Main);
  }
}
