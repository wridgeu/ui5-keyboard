import Item from "sap/ui/core/Item";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent, KioskKeyboard$LayoutChangeEvent } from "ui5/kiosk/KioskKeyboard";
import type Select from "sap/m/Select";
import type { SegmentedButton$SelectionChangeEvent } from "sap/m/SegmentedButton";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Enhanced docked keyboard demo — ports the original Kiosk view and adds
 * a controls panel for enabled, mobileKeyboard, and layout switching.
 *
 * @name demo.hotkeys.controller.KioskDocked
 */
export default class KioskDocked extends BaseController {
  onInit(): void {
    const stateModel = this.getStateModel();
    stateModel.setProperty("/kioskLastKey", "None");
    stateModel.setProperty("/kioskLayout", "qwerty");
    stateModel.setProperty("/kioskEnabled", true);
    stateModel.setProperty("/kioskMobileKeyboard", "Custom");
    stateModel.setProperty("/kioskFKeyMode", "Virtual");

    // Populate layout select with all registered layout names
    const select = this.byId("layoutSelect") as Select;
    for (const name of KioskKeyboard.getRegisteredLayoutNames()) {
      select.addItem(new Item({ key: name, text: name }));
    }
    select.setSelectedKey("qwerty");
  }

  onKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this.getStateModel().setProperty("/kioskLastKey", this.formatKeyPress(event));
  }

  onDockedLayoutChange(event: KioskKeyboard$LayoutChangeEvent): void {
    const layout = event.getParameter("layout") ?? "";
    this.getStateModel().setProperty("/kioskLayout", layout);
  }

  onMobileKeyboardChange(event: SegmentedButton$SelectionChangeEvent): void {
    const key = event.getParameter("item")!.getKey();
    const kb = this.byId("dockedKeyboard") as KioskKeyboard;
    kb.setMobileKeyboard(key as "Custom" | "Native" | "Auto");
  }

  onLayoutChange(): void {
    const select = this.byId("layoutSelect") as Select;
    const layout = select.getSelectedKey();
    const kb = this.byId("dockedKeyboard") as KioskKeyboard;
    kb.setLayout(layout);
  }

  onFKeyModeChange(event: SegmentedButton$SelectionChangeEvent): void {
    const key = event.getParameter("item")!.getKey();
    const kb = this.byId("dockedKeyboard") as KioskKeyboard;
    kb.setFKeyMode(key as "Virtual" | "Native");
    this.getStateModel().setProperty("/kioskFKeyMode", key);
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }
}
