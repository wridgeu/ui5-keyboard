import Item from "sap/ui/core/Item";
import JSONModel from "sap/ui/model/json/JSONModel";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent, KioskKeyboard$LayoutChangeEvent } from "ui5/kiosk/KioskKeyboard";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import type Select from "sap/m/Select";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Docked keyboard demo with a controls panel for enabled, mobileKeyboard, and
 * layout switching.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskDocked extends BaseController {
  private static readonly _MODEL_NAME = "docked";

  onInit(): void {
    this.getView()!.setModel(
      new JSONModel({
        kioskEnabled: true,
        kioskMobileKeyboard: "Custom",
        kioskFKeyMode: "Virtual",
        kioskLastKey: "None",
        kioskLayout: "qwerty",
      }),
      KioskDocked._MODEL_NAME,
    );

    // Populate layout select with all registered layout names
    const select = this.byId("layoutSelect") as Select;
    for (const name of KioskKeyboard.getRegisteredLayoutNames()) {
      select.addItem(new Item({ key: name, text: name }));
    }
    select.setSelectedKey("qwerty");

    this.getRouter().attachRouteMatched(this._onRouteMatched, this);
  }

  onExit(): void {
    this.getRouter().detachRouteMatched(this._onRouteMatched, this);

    this._setKeyboardRouteActive(false);
  }

  onKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this._getViewModel().setProperty("/kioskLastKey", this.formatKeyPress(event));
  }

  onDockedLayoutChange(event: KioskKeyboard$LayoutChangeEvent): void {
    const layout = event.getParameter("layout") ?? "";
    this._getViewModel().setProperty("/kioskLayout", layout);
  }

  onLayoutChange(): void {
    const select = this.byId("layoutSelect") as Select;
    const layout = select.getSelectedKey();
    const kb = this.byId("dockedKeyboard") as KioskKeyboard;
    kb.setLayout(layout);
  }

  onNavBack(): void {
    this._setKeyboardRouteActive(false);
    this.getRouter().navTo(Scope.KioskHub);
  }

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    const routeName = event.getParameter("name");
    this._setKeyboardRouteActive(routeName === Scope.KioskDocked);
  }

  private _setKeyboardRouteActive(active: boolean): void {
    const keyboard = this.byId("dockedKeyboard") as KioskKeyboard | undefined;
    if (!keyboard) return;

    if (active) {
      keyboard.setAutoShow(true);
      return;
    }

    keyboard.close();
    keyboard.setAutoShow(false);
    keyboard.setLayout("qwerty");

    const viewModel = this._getViewModel();
    viewModel.setProperty("/kioskEnabled", true);
    viewModel.setProperty("/kioskMobileKeyboard", "Custom");
    viewModel.setProperty("/kioskFKeyMode", "Virtual");
    viewModel.setProperty("/kioskLastKey", "None");
    viewModel.setProperty("/kioskLayout", "qwerty");
  }

  private _getViewModel(): JSONModel {
    return this.getView()!.getModel(KioskDocked._MODEL_NAME) as JSONModel;
  }
}
