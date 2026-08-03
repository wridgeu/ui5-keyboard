import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import CustomLayout from "ui5/kiosk/CustomLayout";
import type { KioskKeyboard$KeyPressEvent, KioskKeyboard$LayoutChangeEvent } from "ui5/kiosk/KioskKeyboard";
import type { LayoutDefinition } from "ui5/kiosk/types";
import { KeyboardType } from "ui5/kiosk/library";
import MessageToast from "sap/m/MessageToast";
import type { Select$ChangeEvent } from "sap/m/Select";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import JSONModel from "sap/ui/model/json/JSONModel";
import fkeyRow from "ui5/kiosk/layouts/fkey-row";
import navRow from "ui5/kiosk/layouts/nav-row";
import navRowCompact from "ui5/kiosk/layouts/nav-row-compact";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Full programmatic API showcase - demonstrates show/close, keyboard type
 * switching, custom layout registration, and status tracking.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskProgrammatic extends BaseController {
  private static readonly _MODEL_NAME = "programmatic";

  override onInit(): void {
    this.getView()!.setModel(
      new JSONModel({
        kioskIsOpen: false,
        kioskKeyboardType: "Full",
        kioskLayout: "qwerty",
        kioskLastKey: "None",
        kioskEnabled: true,
        layouts: KioskKeyboard.getRegisteredLayoutNames().map((name) => ({ key: name, text: name })),
      }),
      KioskProgrammatic._MODEL_NAME,
    );

    this.getRouter().attachRouteMatched(this._onRouteMatched, this);
  }

  override onExit(): void {
    this.getRouter().detachRouteMatched(this._onRouteMatched, this);
    this._setRouteActive(false);
  }

  onShow(): void {
    const kb = this._getKeyboard();
    kb.show();
  }

  onClose(): void {
    const kb = this._getKeyboard();
    kb.close();
  }

  onSetFull(): void {
    const kb = this._getKeyboard();
    kb.setKeyboardType(KeyboardType.Full);
    kb.setLayout(KioskKeyboard.getLocaleLayout());
    this._updateStatus();
  }

  onSetNumpad(): void {
    const kb = this._getKeyboard();
    kb.setKeyboardType(KeyboardType.Numpad);
    this._updateStatus();
  }

  onSetNumeric(): void {
    const kb = this._getKeyboard();
    kb.setKeyboardType(KeyboardType.Numeric);
    this._updateStatus();
  }

  onResetType(): void {
    const kb = this._getKeyboard();
    kb.resetKeyboardType();
    kb.setLayout(KioskKeyboard.getLocaleLayout());
    this._updateStatus();
  }

  onLayoutChange(event: Select$ChangeEvent): void {
    const name = event.getParameter("selectedItem")?.getKey();
    if (!name) return;

    const kb = this._getKeyboard();
    kb.resetKeyboardType();
    kb.setLayout(name);
    this._updateStatus();
  }

  onUseFKeys(): void {
    const kb = this._getKeyboard();
    kb.resetKeyboardType();
    kb.setLayout("fkeys");
    this._updateStatus();
  }

  onUseNav(): void {
    const kb = this._getKeyboard();
    kb.resetKeyboardType();
    kb.setLayout("nav");
    this._updateStatus();
  }

  onUseQwertyNav(): void {
    const kb = this._getKeyboard();
    if (!this._hasInstanceLayout(kb, "qwerty-nav")) {
      this._addInstanceLayout(kb, "qwerty-nav", KioskKeyboard.composeLayout([navRow], "qwerty"));
      this._addLayoutOption("qwerty-nav");
    }

    kb.resetKeyboardType();
    kb.setLayout("qwerty-nav");
    this._updateStatus();
  }

  onUseQwertyNavCompact(): void {
    const kb = this._getKeyboard();
    if (!this._hasInstanceLayout(kb, "qwerty-nav-compact")) {
      this._addInstanceLayout(kb, "qwerty-nav-compact", KioskKeyboard.composeLayout(navRowCompact, "qwerty"));
      this._addLayoutOption("qwerty-nav-compact");
    }

    kb.resetKeyboardType();
    kb.setLayout("qwerty-nav-compact");
    this._updateStatus();
  }

  onRegisterPinpad(): void {
    const pinpad: LayoutDefinition = [
      [{ value: "1" }, { value: "2" }, { value: "3" }],
      [{ value: "4" }, { value: "5" }, { value: "6" }],
      [{ value: "7" }, { value: "8" }, { value: "9" }],
      [
        { value: "{backspace}", label: "", icon: "sap-icon://arrow-left", type: "action" },
        { value: "0" },
        { value: "{enter}", label: "", type: "action" },
      ],
    ];
    this._addInstanceLayout(this._getKeyboard(), "pinpad", pinpad);
    MessageToast.show("Pinpad layout registered");
  }

  onUsePinpad(): void {
    const kb = this._getKeyboard();
    kb.resetKeyboardType();
    kb.setLayout("pinpad");
    this._updateStatus();
  }

  onRegisterQwertyFkNav(): void {
    const qwertyFkNav = KioskKeyboard.composeLayout([fkeyRow, navRow], "qwerty");
    this._addInstanceLayout(this._getKeyboard(), "qwerty-fk-nav-demo", qwertyFkNav);
    this._addLayoutOption("qwerty-fk-nav-demo");

    MessageToast.show("qwerty-fk-nav-demo layout registered");
  }

  onUseQwertyFkNav(): void {
    const kb = this._getKeyboard();
    kb.resetKeyboardType();
    kb.setLayout("qwerty-fk-nav-demo");
    this._updateStatus();
  }

  onKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this._getViewModel().setProperty("/kioskLastKey", this.formatKeyPress(event));
  }

  onAfterOpen(): void {
    this._updateStatus();
  }

  onAfterClose(): void {
    this._updateStatus();
  }

  onLayoutEvent(_event: KioskKeyboard$LayoutChangeEvent): void {
    this._updateStatus();
  }

  onNavBack(): void {
    this._setRouteActive(false);
    this.getRouter().navTo(Scope.KioskHub);
  }

  private _hasInstanceLayout(kb: KioskKeyboard, name: string): boolean {
    return kb.getCustomLayouts().some((layout) => layout.getName() === name);
  }

  private _addInstanceLayout(kb: KioskKeyboard, name: string, rows: LayoutDefinition): void {
    // The aggregation appends, so registering one more layout no longer means
    // reading the whole record back and writing a rebuilt copy of it.
    kb.addCustomLayout(new CustomLayout({ name, rows }));
  }

  private _addLayoutOption(name: string): void {
    const viewModel = this._getViewModel();
    const layouts = viewModel.getProperty("/layouts") as { key: string; text: string }[];
    if (layouts.some((entry) => entry.key === name)) return;
    viewModel.setProperty("/layouts", [...layouts, { key: name, text: name }]);
  }

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    this._setRouteActive(event.getParameter("name") === Scope.KioskProgrammatic);
  }

  private _setRouteActive(active: boolean): void {
    const kb = this.byId("progKeyboard") as KioskKeyboard | undefined;
    if (!kb) return;

    if (active) {
      this._updateStatus();
      return;
    }

    kb.resetKeyboardType();
    kb.setLayout("qwerty");
    kb.close();
    const viewModel = this._getViewModel();
    viewModel.setProperty("/kioskIsOpen", false);
    viewModel.setProperty("/kioskLastKey", "None");
    viewModel.setProperty("/kioskKeyboardType", "Full");
    viewModel.setProperty("/kioskLayout", "qwerty");
    viewModel.setProperty("/kioskEnabled", true);
  }

  private _getKeyboard(): KioskKeyboard {
    return this.byId("progKeyboard") as KioskKeyboard;
  }

  private _updateStatus(): void {
    const kb = this._getKeyboard();
    const viewModel = this._getViewModel();
    viewModel.setProperty("/kioskIsOpen", kb.isOpen());
    viewModel.setProperty("/kioskKeyboardType", kb.getKeyboardType());
    viewModel.setProperty("/kioskLayout", kb.getLayout());
  }

  private _getViewModel(): JSONModel {
    return this.getView()!.getModel(KioskProgrammatic._MODEL_NAME) as JSONModel;
  }
}
