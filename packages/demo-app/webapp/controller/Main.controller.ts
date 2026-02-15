import MessageToast from "sap/m/MessageToast";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import Text from "sap/m/Text";
import VBox from "sap/m/VBox";
import { Scope } from "../constants";
import BaseController from "./BaseController";
import type HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type { HotkeyRegistrationHandle } from "ui5/hotkeys/types";

/**
 * Main view controller — demonstrates view-scoped and dialog-scoped shortcuts.
 *
 * View-level scope ("main") is managed automatically by
 * `enableRouterIntegration()` — the route name IS the scope name.
 * Controllers only need `pushScope`/`popScope` for non-route scopes (dialogs).
 *
 * @name demo.hotkeys.controller.Main
 */
export default class Main extends BaseController {
  private _manager!: HotkeyManager;
  private _handles!: HotkeyRegistrationHandle[];
  private _dialogHandles!: HotkeyRegistrationHandle[];
  private _dialog!: Dialog | null;

  onInit(): void {
    this._handles = [];
    this._dialogHandles = [];
    this._dialog = null;

    this._manager = this.getTypedComponent().getHotkeyManager();
    const stateModel = this.getStateModel();

    // Register view-scoped shortcuts — scope "main" matches the route name.
    // No pushScope/popScope needed; the router integration handles it.
    this._handles.push(
      this._manager.register(
        "F5",
        () => {
          stateModel.setProperty("/lastAction", "Refresh (Main View)");
          MessageToast.show("F5: Refresh from Main View");
        },
        {
          scope: Scope.Main,
          description: "Refresh (Main View)",
        },
      ),
    );

    this._handles.push(
      this._manager.register(
        "Mod+D",
        () => {
          this._navToDetail();
        },
        {
          scope: Scope.Main,
          description: "Navigate to Detail",
        },
      ),
    );
  }

  onNavToDetail(): void {
    this._navToDetail();
  }

  onNavToKiosk(): void {
    this.getTypedComponent().getRouter().navTo(Scope.Kiosk);
  }

  onOpenDialog(): void {
    const stateModel = this.getStateModel();

    this._dialog = new Dialog({
      title: "Dialog with Scoped Shortcuts",
      type: "Message",
      content: new VBox({
        items: [
          new Text({ text: "This dialog has its own F5 handler." }),
          new Text({ text: "Press F5 — it will fire the dialog's handler, not the view's." }),
          new Text({ text: "Press Escape to close (dialog-scoped shortcut)." }),
        ],
      }),
      beginButton: new Button({
        text: "Close",
        press: () => {
          this._closeDialog();
        },
      }),
      escapeHandler: (promise: { resolve: () => void }) => {
        // Let our hotkey handle the close logic (scope pop + cleanup)
        promise.resolve();
      },
    });

    // Dialog scope is NOT route-based -> manual push/pop required
    this._manager.pushScope(Scope.Dialog);
    stateModel.setProperty("/activeScope", this._manager.getActiveScope());

    // Register dialog-scoped F5
    this._dialogHandles.push(
      this._manager.register(
        "F5",
        () => {
          stateModel.setProperty("/lastAction", "Refresh (Dialog)");
          MessageToast.show("F5: Refresh from Dialog");
        },
        {
          scope: Scope.Dialog,
          description: "Refresh (Dialog)",
        },
      ),
    );

    // Register dialog-scoped Escape to close dialog with proper cleanup
    this._dialogHandles.push(
      this._manager.register(
        "Escape",
        () => {
          this._closeDialog();
        },
        {
          scope: Scope.Dialog,
          description: "Close Dialog",
          preventDefault: false,
          stopPropagation: false,
        },
      ),
    );

    this._dialog.open();
  }

  onExit(): void {
    this._handles.forEach((h) => h.unregister());
    this._handles = [];
    this._cleanupDialog();
  }

  private _navToDetail(): void {
    this.getTypedComponent().getRouter().navTo(Scope.Detail);
  }

  private _closeDialog(): void {
    this._cleanupDialog();
    this.getStateModel().setProperty("/activeScope", this._manager.getActiveScope());
  }

  private _cleanupDialog(): void {
    this._dialogHandles.forEach((h) => h.unregister());
    this._dialogHandles = [];

    // Guard: only pop if dialog scope is actually on top
    if (this._manager.getActiveScope() === Scope.Dialog) {
      this._manager.popScope(Scope.Dialog);
    }

    this._dialog?.close();
    this._dialog?.destroy();
    this._dialog = null;
  }
}
