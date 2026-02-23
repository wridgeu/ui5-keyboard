import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent, KioskKeyboard$KeyboardTypeChangeEvent } from "ui5/kiosk/KioskKeyboard";
import { KeyName } from "ui5/kiosk/library";
import Input from "sap/m/Input";
import TextArea from "sap/m/TextArea";
import MessageToast from "sap/m/MessageToast";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Self-service check-in form with Enter-to-advance, progress tracking,
 * and auto-type switching between Full and Numpad.
 *
 * @name demo.hotkeys.controller.KioskFormWorkflow
 */
export default class KioskFormWorkflow extends BaseController {
  private static readonly _FIELD_IDS = ["nameInput", "emailInput", "phoneInput", "guestsInput", "notesInput"];

  onInit(): void {
    const stateModel = this.getStateModel();
    stateModel.setProperty("/formProgress", 0);
    stateModel.setProperty("/formProgressText", "0 / 5 fields");
    stateModel.setProperty("/formActiveField", "None");
    stateModel.setProperty("/formKeyboardType", "Full");
    stateModel.setProperty("/formLastKey", "None");
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
    const nameInput = this.byId("nameInput") as Input;
    const emailInput = this.byId("emailInput") as Input;

    if (!nameInput.getValue().trim() || !emailInput.getValue().trim()) {
      MessageToast.show("Please fill in Name and Email");
      return;
    }

    MessageToast.show("Check-in submitted!");
    this._resetForm();
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  private _advanceToNextField(): void {
    const kb = this.byId("formKeyboard") as KioskKeyboard;
    const currentTargetId = kb.getTargetControl<Input | TextArea>()?.getId();

    const currentIndex = KioskFormWorkflow._FIELD_IDS.findIndex(
      (id) => (this.byId(id) as Input | TextArea | undefined)?.getId() === currentTargetId,
    );

    if (currentIndex === -1) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex < KioskFormWorkflow._FIELD_IDS.length) {
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
    const kb = this.byId("formKeyboard") as KioskKeyboard;
    const targetId = kb.getTargetInput();
    if (targetId) {
      const shortId = targetId.split("--").pop() ?? targetId;
      this.getStateModel().setProperty("/formActiveField", shortId);
    } else {
      this.getStateModel().setProperty("/formActiveField", "None");
    }
  }

  private _resetForm(): void {
    for (const id of KioskFormWorkflow._FIELD_IDS) {
      const control = this.byId(id) as Input | TextArea;
      control.setValue("");
    }
    this._updateProgress();
  }
}
