import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Hub landing page for hotkeys scenarios.
 *
 * @namespace demo.hotkeys.controller
 */
export default class HotkeysHub extends BaseController {
  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.Main);
  }
}
