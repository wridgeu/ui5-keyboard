import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import type Component from "../Component";

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
export default class Kiosk extends Controller {
  onInit(): void {
    const stateModel = (this.getOwnerComponent() as Component).getModel("state") as JSONModel;
    stateModel.setProperty("/kioskLastKey", "None");
    stateModel.setProperty("/kioskLayout", "qwerty");
  }

  onKeyPress(event: { getParameter(name: string): unknown }): void {
    const key = event.getParameter("key") as string;
    const shift = event.getParameter("shiftKey") as boolean;
    const display = shift ? `${key} (Shift)` : key;

    const stateModel = (this.getOwnerComponent() as Component).getModel("state") as JSONModel;
    stateModel.setProperty("/kioskLastKey", display);
  }

  onLayoutChange(event: { getParameter(name: string): unknown }): void {
    const layout = event.getParameter("layout") as string;

    const stateModel = (this.getOwnerComponent() as Component).getModel("state") as JSONModel;
    stateModel.setProperty("/kioskLayout", layout);
  }

  onNavBack(): void {
    (this.getOwnerComponent() as Component).getRouter().navTo("main");
  }
}
