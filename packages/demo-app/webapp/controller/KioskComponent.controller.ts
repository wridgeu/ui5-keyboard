import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import type Input from "sap/m/Input";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Component-level keyboard demo — the keyboard is created once, placed
 * in the `sap-ui-static` UIArea, and survives navigation.
 *
 * @name demo.hotkeys.controller.KioskComponent
 */
export default class KioskComponent extends BaseController {
  /** Shared across controller re-instantiations. */
  private static _keyboard: KioskKeyboard | null = null;

  onInit(): void {
    const stateModel = this.getStateModel();
    stateModel.setProperty("/kioskIsOpen", false);
    stateModel.setProperty("/kioskLastKey", "None");

    // Lazily create the keyboard once — it lives in sap-ui-static
    if (!KioskComponent._keyboard) {
      KioskComponent._keyboard = new KioskKeyboard({
        docked: true,
        ariaLabel: "Component Keyboard",
        keyPress: (event: KioskKeyboard$KeyPressEvent) => {
          const key = event.getParameter("key") ?? "";
          stateModel.setProperty("/kioskLastKey", key);
        },
        afterOpen: () => stateModel.setProperty("/kioskIsOpen", true),
        afterClose: () => stateModel.setProperty("/kioskIsOpen", false),
      });
      KioskComponent._keyboard.placeAt("sap-ui-static");
    }

    // Point the keyboard at this view's input after the view renders
    this.getTypedComponent()
      .getRouter()
      .getRoute(Scope.KioskComponent)!
      .attachPatternMatched(this._onRouteMatched, this);
  }

  onShowKeyboard(): void {
    const kb = KioskComponent._keyboard;
    if (kb) {
      const input = this.byId("compInput") as Input;
      kb.setTargetInput(input);
      kb.show();
      this.getStateModel().setProperty("/kioskIsOpen", kb.isOpen());
    }
  }

  onCloseKeyboard(): void {
    const kb = KioskComponent._keyboard;
    if (kb) {
      kb.close();
      this.getStateModel().setProperty("/kioskIsOpen", kb.isOpen());
    }
  }

  onNavigateAway(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  onNavBack(): void {
    // Close keyboard when leaving this demo
    KioskComponent._keyboard?.close();
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  private _onRouteMatched(): void {
    // Re-wire the keyboard to this view's input whenever we navigate back
    const kb = KioskComponent._keyboard;
    if (kb) {
      const input = this.byId("compInput") as Input;
      if (input) {
        kb.setTargetInput(input);
      }
      this.getStateModel().setProperty("/kioskIsOpen", kb.isOpen());
    }
  }
}
