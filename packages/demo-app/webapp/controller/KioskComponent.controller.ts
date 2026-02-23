import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import type Input from "sap/m/Input";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Component-level keyboard demo — the keyboard is created once, placed
 * in the `sap-ui-static` UIArea, and reused while this controller instance lives.
 *
 * @name demo.hotkeys.controller.KioskComponent
 */
export default class KioskComponent extends BaseController {
  /** Shared within one controller lifetime (until `onExit`). */
  private static _keyboard: KioskKeyboard | null = null;
  private _returnNavTimer: ReturnType<typeof setTimeout> | null = null;

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

    this.getTypedComponent().getRouter().attachRouteMatched(this._onRouteMatched, this);
  }

  onExit(): void {
    this.getTypedComponent().getRouter().detachRouteMatched(this._onRouteMatched, this);

    if (this._returnNavTimer) {
      clearTimeout(this._returnNavTimer);
      this._returnNavTimer = null;
    }

    if (KioskComponent._keyboard) {
      KioskComponent._keyboard.destroy();
      KioskComponent._keyboard = null;
    }
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
    const router = this.getTypedComponent().getRouter();
    router.navTo(Scope.KioskHub);
    if (this._returnNavTimer) {
      clearTimeout(this._returnNavTimer);
    }
    this._returnNavTimer = setTimeout(() => {
      this._returnNavTimer = null;
      router.navTo(Scope.KioskComponent);
    }, 2000);
  }

  onNavBack(): void {
    if (this._returnNavTimer) {
      clearTimeout(this._returnNavTimer);
      this._returnNavTimer = null;
    }

    // Close keyboard when leaving this demo
    KioskComponent._keyboard?.close();
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    if (event.getParameter("name") !== Scope.KioskComponent) return;

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
