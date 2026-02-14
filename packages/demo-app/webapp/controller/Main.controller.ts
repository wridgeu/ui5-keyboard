import Controller from "sap/ui/core/mvc/Controller";
import MessageToast from "sap/m/MessageToast";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import Text from "sap/m/Text";
import VBox from "sap/m/VBox";
import JSONModel from "sap/ui/model/json/JSONModel";
import type Component from "../Component";
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
export default class Main extends Controller {
  private _manager!: HotkeyManager;
  private _handles!: HotkeyRegistrationHandle[];
  private _dialogHandles!: HotkeyRegistrationHandle[];
  private _dialog!: Dialog | null;

  onInit(): void {
    this._handles = [];
    this._dialogHandles = [];
    this._dialog = null;

    const component = this.getOwnerComponent() as Component;
    this._manager = component.getHotkeyManager();
    const stateModel = component.getModel("state") as JSONModel;

    // Register view-scoped shortcuts — scope "main" matches the route name.
    // No pushScope/popScope needed; the router integration handles it.
    this._handles.push(
      this._manager.register(
        "F5",
        (_event) => {
          stateModel.setProperty("/lastAction", "Refresh (Main View)");
          MessageToast.show("F5: Refresh from Main View");
        },
        {
          scope: "main",
          description: "Refresh (Main View)",
        },
      ),
    );

    this._handles.push(
      this._manager.register(
        "Mod+D",
        (_event) => {
          this._navToDetail();
        },
        {
          scope: "main",
          description: "Navigate to Detail",
        },
      ),
    );
  }

  onNavToDetail(): void {
    this._navToDetail();
  }

  onOpenDialog(): void {
    const stateModel = (this.getOwnerComponent() as Component).getModel("state") as JSONModel;

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
          this._closeDialog(stateModel);
        },
      }),
      escapeHandler: (promise: { resolve: () => void }) => {
        // Let our hotkey handle the close logic (scope pop + cleanup)
        promise.resolve();
      },
    });

    // Dialog scope is NOT route-based → manual push/pop required
    this._manager.pushScope("dialog");
    stateModel.setProperty("/activeScope", this._manager.getActiveScope());

    // Register dialog-scoped F5
    this._dialogHandles.push(
      this._manager.register(
        "F5",
        (_event) => {
          stateModel.setProperty("/lastAction", "Refresh (Dialog)");
          MessageToast.show("F5: Refresh from Dialog");
        },
        {
          scope: "dialog",
          description: "Refresh (Dialog)",
        },
      ),
    );

    // Register dialog-scoped Escape to close dialog with proper cleanup
    this._dialogHandles.push(
      this._manager.register(
        "Escape",
        (_event) => {
          this._closeDialog(stateModel);
        },
        {
          scope: "dialog",
          description: "Close Dialog",
          preventDefault: false,
          stopPropagation: false,
        },
      ),
    );

    this._dialog.open();
  }

  onExit(): void {
    for (const handle of this._handles) {
      handle.unregister();
    }
    this._handles = [];

    if (this._dialog) {
      this._dialog.destroy();
      this._dialog = null;
    }
  }

  private _navToDetail(): void {
    (this.getOwnerComponent() as Component).getRouter().navTo("detail");
  }

  private _closeDialog(stateModel: JSONModel): void {
    for (const handle of this._dialogHandles) {
      handle.unregister();
    }
    this._dialogHandles = [];

    try {
      this._manager.popScope("dialog");
    } catch {
      // Already popped
    }

    stateModel.setProperty("/activeScope", this._manager.getActiveScope());

    if (this._dialog) {
      this._dialog.close();
      this._dialog.destroy();
      this._dialog = null;
    }
  }
}
