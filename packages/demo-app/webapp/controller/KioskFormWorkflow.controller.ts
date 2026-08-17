import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent, KioskKeyboard$KeyboardTypeChangeEvent } from "ui5/kiosk/KioskKeyboard";
import { KeyName } from "ui5/kiosk/library";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import Input from "sap/m/Input";
import TextArea from "sap/m/TextArea";
import MessageToast from "sap/m/MessageToast";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Self-service check-in form with Enter-to-advance, progress tracking,
 * and auto-type switching between Full and Numpad.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskFormWorkflow extends BaseController {
  private static readonly _FIELD_IDS = ["nameInput", "emailInput", "phoneInput", "guestsInput", "notesInput"];

  override onInit(): void {
    const stateModel = this.getStateModel();
    stateModel.setProperty("/formProgress", 0);
    stateModel.setProperty("/formProgressText", "0 / 5 fields");
    stateModel.setProperty("/formActiveField", "None");
    stateModel.setProperty("/formKeyboardType", "Full");
    stateModel.setProperty("/formLastKey", "None");

    this.getRouter().attachRouteMatched(this._onRouteMatched, this);
  }

  override onExit(): void {
    this.getRouter().detachRouteMatched(this._onRouteMatched, this);

    this._setKeyboardRouteActive(false);
  }

  onKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this.getStateModel().setProperty("/formLastKey", this.formatKeyPress(event));

    const key = event.getParameter("key") ?? "";
    if (key === KeyName.Enter) {
      event.preventDefault();
      this._advanceToNextField();
    }

    this._updateActiveField();
  }

  onKeyboardTypeChange(event: KioskKeyboard$KeyboardTypeChangeEvent): void {
    const type = event.getParameter("keyboardType") ?? "Full";
    this.getStateModel().setProperty("/formKeyboardType", type);
  }

  onAfterOpen(): void {
    this._updateActiveField();
  }

  onFieldChange(): void {
    this._updateProgress();
  }

  onSubmit(): void {
    // SAFETY: KioskFormWorkflow.view.xml declares nameInput as a sap.m.Input, and this handler
    // runs from a press on the submit button of that rendered view.
    const nameInput = this.byId("nameInput") as Input;
    // SAFETY: the same view declares emailInput as a sap.m.Input.
    const emailInput = this.byId("emailInput") as Input;

    if (!nameInput.getValue().trim() || !emailInput.getValue().trim()) {
      MessageToast.show("Please fill in Name and Email");
      return;
    }

    MessageToast.show("Check-in submitted!");
    this._resetForm();
  }

  onNavBack(): void {
    this._setKeyboardRouteActive(false);
    this.getRouter().navTo(Scope.KioskHub);
  }

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    const routeName = event.getParameter("name");
    this._setKeyboardRouteActive(routeName === Scope.KioskFormWorkflow);
  }

  private _setKeyboardRouteActive(active: boolean): void {
    // SAFETY: KioskFormWorkflow.view.xml declares formKeyboard as a ui5.kiosk.KioskKeyboard; the
    // undefined arm covers the routeMatched that arrives after the view is destroyed.
    const keyboard = this.byId("formKeyboard") as KioskKeyboard | undefined;
    if (!keyboard) return;

    if (active) {
      keyboard.setAutoShow(true);
      return;
    }

    keyboard.close();
    keyboard.setAutoShow(false);
    this.getStateModel().setProperty("/formActiveField", "None");
  }

  private _advanceToNextField(): void {
    // SAFETY: this runs from the keyboard's own keyPress event, so formKeyboard is the
    // ui5.kiosk.KioskKeyboard the view declares and it is still alive.
    const kb = this.byId("formKeyboard") as KioskKeyboard;
    const currentTargetId = kb.getActiveControl<Input | TextArea>()?.getId();

    const currentIndex = KioskFormWorkflow._FIELD_IDS.findIndex(
      // SAFETY: _FIELD_IDS lists the four sap.m.Input ids and the one sap.m.TextArea id the view
      // declares; the undefined arm covers a field the view no longer holds.
      (id) => (this.byId(id) as Input | TextArea | undefined)?.getId() === currentTargetId,
    );

    if (currentIndex === -1) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex < KioskFormWorkflow._FIELD_IDS.length) {
      // SAFETY: nextIndex is in range of _FIELD_IDS, whose entries the view declares as sap.m.Input
      // except notesInput, a sap.m.TextArea.
      const nextControl = this.byId(KioskFormWorkflow._FIELD_IDS[nextIndex]!) as Input | TextArea;
      nextControl.focus();
    } else {
      this.onSubmit();
    }
  }

  private _updateProgress(): void {
    const total = KioskFormWorkflow._FIELD_IDS.length;
    let filled = 0;
    for (const id of KioskFormWorkflow._FIELD_IDS) {
      // SAFETY: the view declares every _FIELD_IDS entry as a sap.m.Input except notesInput, a
      // sap.m.TextArea, and this runs from a liveChange of one of those fields.
      const control = this.byId(id) as Input | TextArea;
      if (control.getValue().trim()) {
        filled++;
      }
    }
    const percent = (filled / total) * 100;
    const stateModel = this.getStateModel();
    stateModel.setProperty("/formProgress", percent);
    stateModel.setProperty("/formProgressText", `${filled} / ${total} fields`);
  }

  private _updateActiveField(): void {
    // SAFETY: this runs from the keyboard's keyPress and afterOpen events, so formKeyboard is the
    // ui5.kiosk.KioskKeyboard the view declares and it is still alive.
    const kb = this.byId("formKeyboard") as KioskKeyboard;
    const targetId = kb.getActiveControl()?.getId();
    if (targetId) {
      const shortId = targetId.split("--").pop() ?? targetId;
      this.getStateModel().setProperty("/formActiveField", shortId);
    } else {
      this.getStateModel().setProperty("/formActiveField", "None");
    }
  }

  private _resetForm(): void {
    for (const id of KioskFormWorkflow._FIELD_IDS) {
      // SAFETY: the view declares every _FIELD_IDS entry as a sap.m.Input except notesInput, a
      // sap.m.TextArea, and a reset only follows a submit from that rendered view.
      const control = this.byId(id) as Input | TextArea;
      control.setValue("");
    }
    this._updateProgress();
  }
}
