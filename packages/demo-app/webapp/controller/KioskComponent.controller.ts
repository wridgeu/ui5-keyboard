import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Component-level keyboard demo - the keyboard is created once, placed
 * in the `sap-ui-static` UIArea, and reused while this controller instance lives.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskComponent extends BaseController {
  private _keyboard: KioskKeyboard | null = null;
  private _returnNavTimer: ReturnType<typeof setTimeout> | null = null;
  /** Route the app is on, so the round-trip timer can tell the hub from a later choice. */
  private _lastRouteName: string | null = null;

  override onInit(): void {
    const stateModel = this.getStateModel();

    this._keyboard = new KioskKeyboard({
      docked: true,
      ariaLabel: "Component Keyboard",
      keyPress: (event: KioskKeyboard$KeyPressEvent) => {
        const key = event.getParameter("key") ?? "";
        stateModel.setProperty("/kioskLastKey", key);
      },
      afterOpen: () => stateModel.setProperty("/kioskIsOpen", true),
      afterClose: () => stateModel.setProperty("/kioskIsOpen", false),
    });
    this._keyboard.placeAt("sap-ui-static");

    this.getRouter().attachRouteMatched(this._onRouteMatched, this);
  }

  override onExit(): void {
    this.getRouter().detachRouteMatched(this._onRouteMatched, this);

    if (this._returnNavTimer) {
      clearTimeout(this._returnNavTimer);
      this._returnNavTimer = null;
    }

    if (this._keyboard) {
      this._keyboard.destroy();
      this._keyboard = null;
    }
  }

  onShowKeyboard(): void {
    const kb = this._keyboard;
    if (kb) {
      const input = this.byId("compInput")!;
      kb.setControls([input.getId()]);
      kb.show();
      this.getStateModel().setProperty("/kioskIsOpen", kb.isOpen());
    }
  }

  onCloseKeyboard(): void {
    const kb = this._keyboard;
    if (kb) {
      kb.close();
      this.getStateModel().setProperty("/kioskIsOpen", kb.isOpen());
    }
  }

  onNavigateAway(): void {
    const router = this.getRouter();
    router.navTo(Scope.KioskHub);
    if (this._returnNavTimer) {
      clearTimeout(this._returnNavTimer);
    }
    this._returnNavTimer = setTimeout(() => {
      this._returnNavTimer = null;
      // Only finish the round trip from the hub it navigated to. Router targets
      // keep this view alive, so onExit never runs on a navigation; without this
      // the timer would yank the user back out of whatever they opened instead.
      if (this._lastRouteName !== Scope.KioskHub) return;
      router.navTo(Scope.KioskComponent);
    }, 2000);
  }

  onNavBack(): void {
    if (this._returnNavTimer) {
      clearTimeout(this._returnNavTimer);
      this._returnNavTimer = null;
    }

    this._keyboard?.close();
    this.getRouter().navTo(Scope.KioskHub);
  }

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    this._lastRouteName = event.getParameter("name") ?? null;
    if (this._lastRouteName !== Scope.KioskComponent) return;

    // Re-wire the keyboard to this view's input whenever we navigate back
    const kb = this._keyboard;
    if (kb) {
      const input = this.byId("compInput");
      if (input) {
        kb.setControls([input.getId()]);
      }
      this.getStateModel().setProperty("/kioskIsOpen", kb.isOpen());
    }
  }
}
