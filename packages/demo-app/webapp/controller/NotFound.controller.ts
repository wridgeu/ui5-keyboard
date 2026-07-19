import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Displayed by the router's `bypassed` target when the URL hash matches no route.
 *
 * @namespace demo.hotkeys.controller
 */
export default class NotFound extends BaseController {
  onNavBack(): void {
    this.getRouter().navTo(Scope.Main);
  }
}
