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

  onNavToFormWorkflow(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskFormWorkflow);
  }

  onNavToMultiKeyboard(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskMultiKeyboard);
  }

  onNavToPopover(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskPopover);
  }

  onNavToDialog(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskDialog);
  }

  onNavToInputIds(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskInputIds);
  }

  onOpenStandaloneWebComponents(): void {
    const current = window.location.href;
    const base = current.includes("#") ? current.split("#")[0] : current;
    const standaloneUrl = new URL("standalone-webc/index.html", base);
    window.open(standaloneUrl.toString(), "_blank", "noopener,noreferrer");
  }

  onNavToProgrammatic(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskProgrammatic);
  }

  onNavToCustomLayouts(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskCustomLayouts);
  }

  onNavToComponent(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskComponent);
  }
}
