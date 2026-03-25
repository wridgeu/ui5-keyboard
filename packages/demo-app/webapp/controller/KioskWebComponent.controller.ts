import JSONModel from "sap/ui/model/json/JSONModel";
import type Event from "sap/ui/base/Event";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import { Scope } from "../constants";
import BaseController from "./BaseController";

// Register the <kiosk-keyboard> custom element (resolved by ui5-tooling-modules)
import "kiosk-keyboard-webc/bundle";

/**
 * Controller for the native `<kiosk-keyboard>` web component demo page.
 *
 * Events are bound declaratively in the XML view via the bridge control's
 * event metadata (e.g. `keyPress=".onKeyPress"`). The bridge automatically
 * converts the web component's `CustomEvent.detail` into UI5 event
 * parameters accessible via `oEvent.getParameter()`.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskWebComponent extends BaseController {
  private static readonly _MODEL_NAME = "webc";

  onInit(): void {
    this.getView()!.setModel(
      new JSONModel({
        lastKey: "None",
        layout: "qwerty",
      }),
      KioskWebComponent._MODEL_NAME,
    );

    this.getTypedComponent().getRouter().attachRouteMatched(this._onRouteMatched, this);
  }

  onExit(): void {
    this.getTypedComponent().getRouter().detachRouteMatched(this._onRouteMatched, this);
  }

  onNavBack(): void {
    this._setKeyboardRouteActive(false);
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  // ── Bridge event handlers (bound in XML view) ──

  onKeyPress(event: Event<{ key: string; shiftKey: boolean; char?: string }>): void {
    const key = event.getParameter("key") ?? "";
    const shift = event.getParameter("shiftKey") ?? false;
    this._getViewModel().setProperty("/lastKey", shift ? `${key} (Shift)` : key);
  }

  onLayoutChange(event: Event<{ layout: string }>): void {
    const layout = event.getParameter("layout") ?? "";
    this._getViewModel().setProperty("/layout", layout);
  }

  // ── Route lifecycle ──

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    const routeName = event.getParameter("name");
    this._setKeyboardRouteActive(routeName === Scope.KioskWebComponent);
  }

  private _setKeyboardRouteActive(active: boolean): void {
    const control = this.byId("webcKeyboard");
    if (!control) return;

    if (active) {
      control.setProperty("autoShow", true);
      return;
    }

    // Deactivate: close keyboard and disable auto-show
    if ("close" in control) {
      (control.close as () => void)();
    }
    control.setProperty("autoShow", false);

    const viewModel = this._getViewModel();
    viewModel.setProperty("/lastKey", "None");
    viewModel.setProperty("/layout", "qwerty");
  }

  private _getViewModel(): JSONModel {
    return this.getView()!.getModel(KioskWebComponent._MODEL_NAME) as JSONModel;
  }
}
