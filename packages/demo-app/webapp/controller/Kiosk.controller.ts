import type UI5Event from "sap/ui/base/Event";
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

  onKeyPress(event: UI5Event<{ key: string; shiftKey: boolean }>): void {
    const key = event.getParameter("key");
    const shift = event.getParameter("shiftKey");
    const display = shift ? `${key} (Shift)` : key;

    this.getStateModel().setProperty("/kioskLastKey", display);
  }

  onLayoutChange(event: UI5Event<{ layout: string }>): void {
    const layout = event.getParameter("layout");
    this.getStateModel().setProperty("/kioskLayout", layout);
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.Main);
  }
}
