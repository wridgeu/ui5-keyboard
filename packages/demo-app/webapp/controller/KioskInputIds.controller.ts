import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent, KioskKeyboard$KeyboardTypeChangeEvent } from "ui5/kiosk/KioskKeyboard";
import type UI5Event from "sap/ui/base/Event";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import { Scope } from "../constants";
import BaseController from "./BaseController";

type AlertButtonDemoAlertEventParameters = {
  message?: string;
  detail?: {
    message?: string;
  };
  originalEvent?: CustomEvent<{ message?: string }>;
};

type AlertButton$DemoAlertEvent = UI5Event<AlertButtonDemoAlertEventParameters>;

/**
 * Demonstrates the `controls` property - the keyboard only responds to
 * focus events from the listed input controls.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskInputIds extends BaseController {
  private static readonly _MODEL_NAME = "inputIds";

  override onInit(): void {
    this.getView()!.setModel(
      new JSONModel({
        kioskCurrentTarget: "None",
        kioskAutoType: false,
        kioskKeyboardType: "Full",
        kioskLastKey: "None",
      }),
      KioskInputIds._MODEL_NAME,
    );

    // Track target changes
    const kb = this.byId("inputIdsKeyboard") as KioskKeyboard;
    kb.attachEvent("afterOpen", () => {
      this._updateTargetStatus();
    });
    kb.attachEvent("activeControlChange", () => {
      this._updateTargetStatus();
    });

    this.getRouter().attachRouteMatched(this._onRouteMatched, this);
  }

  override onExit(): void {
    this.getRouter().detachRouteMatched(this._onRouteMatched, this);
    this._setRouteActive(false);
  }

  onKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this._updateTargetStatus();
    this._getViewModel().setProperty("/kioskLastKey", this.formatKeyPress(event));
  }

  onDemoAlert(event: AlertButton$DemoAlertEvent): void {
    const message =
      event.getParameter("message") ??
      event.getParameter("detail")?.message ??
      event.getParameter("originalEvent")?.detail?.message ??
      "Custom element event";
    MessageToast.show(message);
  }

  onKeyboardTypeChange(event: KioskKeyboard$KeyboardTypeChangeEvent): void {
    this._getViewModel().setProperty("/kioskKeyboardType", event.getParameter("keyboardType"));
  }

  onNavBack(): void {
    this._setRouteActive(false);
    this.getRouter().navTo(Scope.KioskHub);
  }

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    this._setRouteActive(event.getParameter("name") === Scope.KioskInputIds);
  }

  private _setRouteActive(active: boolean): void {
    const kb = this.byId("inputIdsKeyboard") as KioskKeyboard | undefined;
    if (!kb) return;

    if (active) {
      kb.setAutoShow(true);
      return;
    }

    kb.close();
    kb.setAutoShow(false);
    const viewModel = this._getViewModel();
    viewModel.setProperty("/kioskLastKey", "None");
    viewModel.setProperty("/kioskCurrentTarget", "None");
    viewModel.setProperty("/kioskKeyboardType", "Full");
    viewModel.setProperty("/kioskAutoType", false);
  }

  private _updateTargetStatus(): void {
    const kb = this.byId("inputIdsKeyboard") as KioskKeyboard;
    const targetId = kb.getActiveControl()?.getId();
    this._getViewModel().setProperty("/kioskCurrentTarget", targetId || "None");
  }

  private _getViewModel(): JSONModel {
    return this.getView()!.getModel(KioskInputIds._MODEL_NAME) as JSONModel;
  }
}
