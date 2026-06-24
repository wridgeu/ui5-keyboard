import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Hub landing page for kiosk keyboard demos.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskHub extends BaseController {
  onNavBack(): void {
    this.getRouter().navTo(Scope.Main);
  }
}
