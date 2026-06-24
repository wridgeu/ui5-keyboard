import JSONModel from "sap/ui/model/json/JSONModel";
import type Event from "sap/ui/base/Event";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Controller for the tooling-native web component demo page.
 *
 * No manual bridge, no side-effect import. The `kiosk-keyboard-webc`
 * XML namespace is resolved entirely by ui5-tooling-modules at dev/build
 * time, which auto-generates the WebComponent wrapper on the fly.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskWebComponentTooling extends BaseController {
  private static readonly _MODEL_NAME = "webc";

  onInit(): void {
    this.getView()!.setModel(
      new JSONModel({
        lastKey: "None",
        layout: "qwerty",
        registeredTag: "(loading...)",
      }),
      KioskWebComponentTooling._MODEL_NAME,
    );

    this.getRouter().attachRouteMatched(this._onRouteMatched, this);
  }

  /**
   * Show the registered custom-element tag from the rendered DOM in the status
   * panel. Reading the tag needs the element in the document, so it happens here
   * rather than on routeMatched (which fires before the first render).
   */
  onAfterRendering(): void {
    const domRef = this.byId("toolingKeyboard")?.getDomRef();
    if (domRef) {
      this._getViewModel().setProperty("/registeredTag", `<${domRef.tagName.toLowerCase()}>`);
    }
  }

  onExit(): void {
    this.getRouter().detachRouteMatched(this._onRouteMatched, this);
  }

  onNavBack(): void {
    this._setKeyboardRouteActive(false);
    this.getRouter().navTo(Scope.KioskHub);
  }

  onKeyPress(event: Event<{ key: string; shiftKey: boolean; char?: string }>): void {
    const key = event.getParameter("key") ?? "";
    const shift = event.getParameter("shiftKey") ?? false;
    this._getViewModel().setProperty("/lastKey", shift ? `${key} (Shift)` : key);
  }

  onLayoutChange(event: Event<{ layout: string }>): void {
    const layout = event.getParameter("layout") ?? "";
    this._getViewModel().setProperty("/layout", layout);
  }

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    const routeName = event.getParameter("name");
    this._setKeyboardRouteActive(routeName === Scope.KioskWebComponentTooling);
  }

  private _setKeyboardRouteActive(active: boolean): void {
    const control = this.byId("toolingKeyboard");
    if (!control) return;

    if (active) {
      control.setProperty("autoShow", true);
      return;
    }

    if ("close" in control) {
      (control.close as () => void)();
    }
    control.setProperty("autoShow", false);

    const viewModel = this._getViewModel();
    viewModel.setProperty("/lastKey", "None");
    viewModel.setProperty("/layout", "qwerty");
  }

  private _getViewModel(): JSONModel {
    return this.getView()!.getModel(KioskWebComponentTooling._MODEL_NAME) as JSONModel;
  }
}
