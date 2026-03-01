import type { ListBase$ItemPressEvent } from "sap/m/ListBase";
import BaseController from "./BaseController";

/**
 * Welcome page controller for demo navigation.
 *
 * @name demo.hotkeys.controller.Main
 */
export default class Main extends BaseController {
  onMainEntryPress(event: ListBase$ItemPressEvent): void {
    const item = event.getParameter("listItem");
    const route = item?.getBindingContext("state")?.getProperty("route") as string | undefined;
    if (!route) return;
    this.getTypedComponent().getRouter().navTo(route);
  }
}
