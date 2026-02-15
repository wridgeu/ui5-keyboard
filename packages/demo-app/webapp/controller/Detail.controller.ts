import MessageToast from "sap/m/MessageToast";
import { Scope } from "../constants";
import BaseController from "./BaseController";
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
export default class Detail extends BaseController {
  private _manager!: HotkeyManager;
  private _handles!: HotkeyRegistrationHandle[];

  onInit(): void {
    this._handles = [];

    this._manager = this.getTypedComponent().getHotkeyManager();
    const stateModel = this.getStateModel();

    // Scope "detail" matches the route name — auto-activated by router integration
    this._handles.push(
      this._manager.register(
        "F5",
        () => {
          stateModel.setProperty("/lastAction", "Refresh (Detail View)");
          MessageToast.show("F5: Refresh from Detail View");
        },
        {
          scope: Scope.Detail,
          description: "Refresh (Detail View)",
        },
      ),
    );

    this._handles.push(
      this._manager.register(
        "Mod+B",
        () => {
          this._navBack();
        },
        {
          scope: Scope.Detail,
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
    this.getTypedComponent().getRouter().navTo(Scope.Main);
  }
}
