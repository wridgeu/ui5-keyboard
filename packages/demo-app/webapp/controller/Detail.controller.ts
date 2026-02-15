import Controller from "sap/ui/core/mvc/Controller";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import type Component from "../Component";
import type HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type { HotkeyRegistrationHandle } from "ui5/hotkeys/types";

/**
 * Detail view controller — demonstrates same-key-different-scope pattern.
 * F5 fires a different handler here vs Main, resolved by the scope system.
 *
 * No scope management code needed — `enableRouterIntegration()` in
 * the Component handles it.
 *
 * @name demo.hotkeys.controller.Detail
 */
export default class Detail extends Controller {
  private _manager!: HotkeyManager;
  private _handles!: HotkeyRegistrationHandle[];

  onInit(): void {
    this._handles = [];

    const component = this.getOwnerComponent() as Component;
    this._manager = component.getHotkeyManager();
    const stateModel = component.getModel("state") as JSONModel;

    // Scope "detail" matches the route name — auto-activated by router integration
    this._handles.push(
      this._manager.register(
        "F5",
        (_event) => {
          stateModel.setProperty("/lastAction", "Refresh (Detail View)");
          MessageToast.show("F5: Refresh from Detail View");
        },
        {
          scope: "detail",
          description: "Refresh (Detail View)",
        },
      ),
    );

    this._handles.push(
      this._manager.register(
        "Mod+B",
        (_event) => {
          this._navBack();
        },
        {
          scope: "detail",
          description: "Navigate Back",
        },
      ),
    );
  }

  onNavBack(): void {
    this._navBack();
  }

  onExit(): void {
    this._handles.forEach((h) => h.unregister());
    this._handles = [];
  }

  private _navBack(): void {
    (this.getOwnerComponent() as Component).getRouter().navTo("main");
  }
}
