import MessageToast from "sap/m/MessageToast";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import Text from "sap/m/Text";
import VBox from "sap/m/VBox";
import { Scope } from "../constants";
import BaseController from "./BaseController";
import type HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type { HotkeyRegistrationHandle, SequenceRegistrationHandle } from "ui5/hotkeys/types";
import KeyStateTracker from "ui5/hotkeys/KeyStateTracker";
import { formatForDisplay } from "ui5/hotkeys/format";

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
  private _sequenceHandles!: SequenceRegistrationHandle[];
  private _keyTracker!: KeyStateTracker;
  private _pendingTimer!: ReturnType<typeof setTimeout> | null;

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

    // D1: Multi-key sequences via HotkeyManager facade
    this._sequenceHandles = [];
    this._pendingTimer = null;

    this._sequenceHandles.push(
      this._manager.registerSequence(
        ["G", "I"],
        () => {
          stateModel.setProperty("/lastAction", "Sequence: Go to Inbox (G I)");
          stateModel.setProperty("/sequenceStatus", "");
          MessageToast.show("G I: Navigate to Detail");
          this._navToDetail();
        },
        { scope: Scope.Main, description: "Go to Inbox" },
      ),
    );

    this._sequenceHandles.push(
      this._manager.registerSequence(
        ["G", "S"],
        () => {
          stateModel.setProperty("/lastAction", "Sequence: Go to Settings (G S)");
          stateModel.setProperty("/sequenceStatus", "");
          MessageToast.show("G S: Go to Settings (no-op)");
        },
        { scope: Scope.Main, description: "Go to Settings" },
      ),
    );

    this._manager.setSequencePendingHandler((info) => {
      if (this._pendingTimer) clearTimeout(this._pendingTimer);
      stateModel.setProperty(
        "/sequenceStatus",
        `Waiting for next key\u2026 (${info.completedSteps}/${info.totalSteps}) \u2014 press ${info.nextKey}`,
      );
      this._pendingTimer = setTimeout(() => {
        stateModel.setProperty("/sequenceStatus", "");
        this._pendingTimer = null;
      }, 1500);
    });

    // D3: KeyStateTracker live display
    this._keyTracker = KeyStateTracker.getInstance();
    this._keyTracker.setChangeCallback((keys) => {
      stateModel.setProperty("/heldKeys", keys.length > 0 ? keys.join(" + ") : "None");
    });

    // D4: Dynamic enabled demo — shortcut only fires when toggle is on
    const platform = this._manager.getPlatform();
    stateModel.setProperty("/printLabel", formatForDisplay("Mod+P", platform));

    this._handles.push(
      this._manager.register(
        "Mod+P",
        () => {
          stateModel.setProperty("/lastAction", "Print (conditional)");
          MessageToast.show("Mod+P: Print — dynamic enabled demo");
        },
        {
          scope: Scope.Main,
          description: "Print (conditional)",
          enabled: () => stateModel.getProperty("/canSave") as boolean,
        },
      ),
    );
  }

  onNavToDetail(): void {
    this._navToDetail();
  }

  onNavToKiosk(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  onOpenDialog(): void {
    // Guard against opening multiple dialogs
    if (this._dialog) return;

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
    this._sequenceHandles.forEach((h) => h.unregister());
    this._sequenceHandles = [];
    this._manager.setSequencePendingHandler(null);
    if (this._pendingTimer) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
    this._keyTracker.setChangeCallback(null);
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

    if (this._dialog) {
      if (this._dialog.isOpen()) {
        this._dialog.close();
      }
      this._dialog.destroy();
      this._dialog = null;
    }
  }
}
