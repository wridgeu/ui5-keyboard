import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import Input from "sap/m/Input";
import VBox from "sap/m/VBox";
import Label from "sap/m/Label";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Keyboard behavior with sap.m.Dialog - two approaches:
 * A) Dialog without keyboard (docked auto-closes), and
 * B) Dialog with embedded inline keyboard.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskDialog extends BaseController {
  private _dialogA: Dialog | null = null;
  private _dialogB: Dialog | null = null;

  onInit(): void {
    const stateModel = this.getStateModel();
    stateModel.setProperty("/dialogDockedOpen", false);
    stateModel.setProperty("/dialogLastKey", "None");
  }

  onKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this.getStateModel().setProperty("/dialogLastKey", this.formatKeyPress(event));
  }

  onDockedAfterOpen(): void {
    this.getStateModel().setProperty("/dialogDockedOpen", true);
  }

  onDockedAfterClose(): void {
    this.getStateModel().setProperty("/dialogDockedOpen", false);
  }

  onOpenDialogA(): void {
    if (this._dialogA?.isOpen()) return;

    if (this._dialogA) {
      this._dialogA.destroy();
      this._dialogA = null;
    }

    const dialogInput = new Input({
      placeholder: "Type in dialog...",
      width: "100%",
    });

    const dialog = new Dialog({
      title: "Approach A: No Keyboard",
      content: [
        new VBox({
          items: [new Label({ text: "Dialog Input" }), dialogInput],
        }).addStyleClass("sapUiSmallMargin"),
      ],
      beginButton: new Button({
        text: "Close",
        press: () => {
          dialog.close();
        },
      }),
      afterClose: () => {
        const isCurrentDialog = this._dialogA === dialog;
        dialog.destroy();
        if (isCurrentDialog) {
          this._dialogA = null;
        }
        // Re-focus page input so docked keyboard resumes
        const pageInput = this.byId("pageInput") as Input | undefined;
        pageInput?.focus();
      },
    });

    this._dialogA = dialog;
    this.getView()!.addDependent(dialog);
    dialog.open();
  }

  onOpenDialogB(): void {
    if (this._dialogB?.isOpen()) return;

    if (this._dialogB) {
      this._dialogB.destroy();
      this._dialogB = null;
    }

    const dialogInputId = this.getView()!.createId("dialogBInput");
    const dialogInput = new Input(dialogInputId, {
      placeholder: "Type in dialog...",
      width: "100%",
    });

    const dialogKeyboard = new KioskKeyboard({
      controls: [dialogInputId],
      ariaLabel: "Dialog Keyboard",
    });

    const dialog = new Dialog({
      title: "Approach B: Embedded Keyboard",
      contentWidth: "30rem",
      content: [
        new VBox({
          items: [new Label({ text: "Dialog Input" }), dialogInput, dialogKeyboard],
        }).addStyleClass("sapUiSmallMargin"),
      ],
      beginButton: new Button({
        text: "Close",
        press: () => {
          dialog.close();
        },
      }),
      afterClose: () => {
        const isCurrentDialog = this._dialogB === dialog;
        dialog.destroy();
        if (isCurrentDialog) {
          this._dialogB = null;
        }
        const pageInput = this.byId("pageInput") as Input | undefined;
        pageInput?.focus();
      },
    });

    this._dialogB = dialog;
    this.getView()!.addDependent(dialog);
    dialog.open();
  }

  onNavBack(): void {
    this._closeDialogs();
    this.getRouter().navTo(Scope.KioskHub);
  }

  onExit(): void {
    this._closeDialogs();
  }

  private _closeDialogs(): void {
    if (this._dialogA) {
      const dialog = this._dialogA;
      this._dialogA = null;
      if (dialog.isOpen()) {
        dialog.close(); // inline afterClose handler will destroy
      } else {
        dialog.destroy();
      }
    }
    if (this._dialogB) {
      const dialog = this._dialogB;
      this._dialogB = null;
      if (dialog.isOpen()) {
        dialog.close(); // inline afterClose handler will destroy
      } else {
        dialog.destroy();
      }
    }
  }
}
