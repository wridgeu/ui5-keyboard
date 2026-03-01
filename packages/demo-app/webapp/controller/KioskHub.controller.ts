import type { ListBase$ItemPressEvent } from "sap/m/ListBase";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Hub landing page for kiosk keyboard demos.
 *
 * @name demo.hotkeys.controller.KioskHub
 */
export default class KioskHub extends BaseController {
  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.Main);
  }

  onScenarioPress(event: ListBase$ItemPressEvent): void {
    const item = event.getParameter("listItem");
    const route = item?.getBindingContext("state")?.getProperty("route") as string | undefined;
    if (!route) return;
    this.getTypedComponent().getRouter().navTo(route);
  }
}
