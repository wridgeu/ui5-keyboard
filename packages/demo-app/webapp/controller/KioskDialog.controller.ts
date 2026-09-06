import type Dialog from "sap/m/Dialog";
import type Input from "sap/m/Input";
import type { Button$PressEvent } from "sap/m/Button";
import type KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Keyboard behavior with sap.m.Dialog - three approaches:
 * A) Dialog without keyboard (docked auto-closes),
 * B) Dialog with embedded inline keyboard, and
 * C) Dialog whose input the page's docked keyboard also targets.
 *
 * All dialogs are XML fragments loaded once and reused across opens; cleanup
 * and re-focus hang off the dialog's afterClose so ESC and router-driven closes
 * behave identically.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskDialog extends BaseController {
  private _dialogA?: Promise<Dialog>;
  private _dialogB?: Promise<Dialog>;
  private _dialogC?: Promise<Dialog>;

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
    // SAFETY: loadFragment resolves to the fragment's single root control, and
    // DialogNoKeyboard.fragment.xml declares exactly one, a sap.m.Dialog.
    this._dialogA ??= this.loadFragment({
      name: "demo.hotkeys.view.fragments.DialogNoKeyboard",
    }) as Promise<Dialog>;
    void this._dialogA.then((dialog) => dialog.open());
  }

  onOpenDialogB(): void {
    // SAFETY: loadFragment resolves to the fragment's single root control, and
    // DialogEmbeddedKeyboard.fragment.xml declares exactly one, a sap.m.Dialog.
    this._dialogB ??= this.loadFragment({
      name: "demo.hotkeys.view.fragments.DialogEmbeddedKeyboard",
    }) as Promise<Dialog>;
    void this._dialogB.then((dialog) => dialog.open());
  }

  onOpenDialogC(): void {
    // SAFETY: loadFragment resolves to the fragment's single root control, and
    // DialogDockedKeyboard.fragment.xml declares exactly one, a sap.m.Dialog.
    this._dialogC ??= this.loadFragment({
      name: "demo.hotkeys.view.fragments.DialogDockedKeyboard",
    }) as Promise<Dialog>;
    void this._dialogC.then((dialog) => dialog.open());
  }

  onCloseDialog(event: Button$PressEvent): void {
    // SAFETY: both fragments wire this handler to a Button sitting in the Dialog's beginButton
    // aggregation, so the pressed button's parent is that Dialog.
    (event.getSource().getParent() as Dialog).close();
  }

  onDialogBBeforeOpen(): void {
    // The dialog is reused across opens, so clear any latch state (armed
    // Shift, etc.) the embedded keyboard carried from the previous session.
    // SAFETY: DialogEmbeddedKeyboard.fragment.xml declares dialogBKeyboard as a
    // ui5.kiosk.KioskKeyboard, and beforeOpen only fires once that fragment is loaded.
    (this.byId("dialogBKeyboard") as KioskKeyboard).reset();
  }

  onDialogAfterClose(): void {
    // Re-focus page input so the docked keyboard resumes.
    // SAFETY: KioskDialog.view.xml declares pageInput as a sap.m.Input; the undefined arm covers
    // an afterClose that arrives once the view is gone.
    (this.byId("pageInput") as Input | undefined)?.focus();
  }

  onNavBack(): void {
    // Router navigation closes any open dialog automatically (closeOnNavigation).
    this.getRouter().navTo(Scope.KioskHub);
  }
}
