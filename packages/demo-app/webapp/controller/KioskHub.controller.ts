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

  onNavToDocked(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskDocked);
  }

  onNavToPopover(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskPopover);
  }

  onNavToInputIds(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskInputIds);
  }

  onNavToProgrammatic(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskProgrammatic);
  }

  onNavToComponent(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskComponent);
  }
}
