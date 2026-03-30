import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Script input demo for Japanese kana, Korean Hangul, Arabic, and Indic scripts.
 * Each keyboard section uses composition middleware automatically.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskScriptInput extends BaseController {
  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }
}
