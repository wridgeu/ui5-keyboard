import type Dialog from "sap/m/Dialog";
import type Input from "sap/m/Input";
import type { Button$PressEvent } from "sap/m/Button";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Keyboard behavior with sap.m.Dialog - two approaches:
 * A) Dialog without keyboard (docked auto-closes), and
 * B) Dialog with embedded inline keyboard.
 *
 * Both dialogs are XML fragments loaded once and reused across opens; cleanup
 * and re-focus hang off the dialog's afterClose so ESC and router-driven closes
 * behave identically.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskDialog extends BaseController {
  private _dialogA?: Promise<Dialog>;
  private _dialogB?: Promise<Dialog>;

  override onInit(): void {
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
    this._dialogA ??= this.loadFragment({
      name: "demo.hotkeys.view.fragments.DialogNoKeyboard",
    }) as Promise<Dialog>;
    void this._dialogA.then((dialog) => dialog.open());
  }

  onOpenDialogB(): void {
    this._dialogB ??= this.loadFragment({
      name: "demo.hotkeys.view.fragments.DialogEmbeddedKeyboard",
    }) as Promise<Dialog>;
    void this._dialogB.then((dialog) => dialog.open());
  }

  onCloseDialog(event: Button$PressEvent): void {
    (event.getSource().getParent() as Dialog).close();
  }

  onDialogAfterClose(): void {
    // Re-focus page input so the docked keyboard resumes.
    (this.byId("pageInput") as Input | undefined)?.focus();
  }

  onNavBack(): void {
    // Router navigation closes any open dialog automatically (closeOnNavigation).
    this.getRouter().navTo(Scope.KioskHub);
  }
}
