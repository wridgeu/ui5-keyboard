import MessageToast from "sap/m/MessageToast";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import Text from "sap/m/Text";
import VBox from "sap/m/VBox";
import { Scope } from "../constants";
import BaseController from "./BaseController";
import type HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";
import type { HotkeyRegistrationHandle } from "ui5/hotkeys/types";
import { ConflictBehavior } from "ui5/hotkeys/library";
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
  private static readonly CONFLICT_HOTKEY = "Ctrl+Shift+K";
  private static readonly COMBO_HOTKEY = "Ctrl+Shift+M";

  private _manager!: HotkeyManager;
  private _hotkeys!: RegistrationGroup;
  private _dialogHotkeys!: RegistrationGroup;
  private _dialog!: Dialog | null;
  private _keyTracker!: KeyStateTracker;
  private _pendingTimer!: ReturnType<typeof setTimeout> | null;
  private _conflictHandles!: HotkeyRegistrationHandle[];
  private _targetHandle!: HotkeyRegistrationHandle | null;

  onInit(): void {
    this._dialog = null;

    this._manager = this.getTypedComponent().getHotkeyManager();
    this._hotkeys = this._manager.createGroup();
    this._dialogHotkeys = this._manager.createGroup();
    const stateModel = this.getStateModel();

    // Register view-scoped shortcuts — scope "main" matches the route name.
    // No pushScope/popScope needed; the router integration handles it.
    this._hotkeys.register(
      "F5",
      () => {
        stateModel.setProperty("/lastAction", "Refresh (Main View)");
        MessageToast.show("F5: Refresh from Main View");
      },
      {
        scope: Scope.Main,
        description: "Refresh (Main View)",
      },
    );

    this._hotkeys.register(
      "Mod+D",
      () => {
        this._navToDetail();
      },
      {
        scope: Scope.Main,
        description: "Navigate to Detail",
      },
    );

    // D1: Multi-key sequences via HotkeyManager facade
    this._pendingTimer = null;

    this._hotkeys.registerSequence(
      ["G", "I"],
      () => {
        stateModel.setProperty("/lastAction", "Sequence: Go to Inbox (G I)");
        stateModel.setProperty("/sequenceStatus", "");
        MessageToast.show("G I: Navigate to Detail");
        this._navToDetail();
      },
      { scope: Scope.Main, description: "Go to Inbox" },
    );

    this._hotkeys.registerSequence(
      ["G", "S"],
      () => {
        stateModel.setProperty("/lastAction", "Sequence: Go to Settings (G S)");
        stateModel.setProperty("/sequenceStatus", "");
        MessageToast.show("G S: Go to Settings (no-op)");
      },
      { scope: Scope.Main, description: "Go to Settings" },
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

    this._hotkeys.register(
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
    );

    // Conflict behavior demo state
    this._conflictHandles = [];
    stateModel.setProperty("/conflictStatus", `Not configured. Choose a strategy, then press ${Main.CONFLICT_HOTKEY}.`);
    stateModel.setProperty("/conflictState", "Information");

    stateModel.setProperty("/targetStatus", "Focus inside the panel and press Ctrl+Enter.");

    stateModel.setProperty("/comboStatus", `Try ${Main.COMBO_HOTKEY} or type with the virtual keyboard.`);
    stateModel.setProperty("/comboText", "");

    this._hotkeys.register(
      Main.COMBO_HOTKEY,
      () => {
        const previous = (stateModel.getProperty("/comboText") as string) || "";
        const next = `${previous}${previous ? " " : ""}[hotkey:${Main.COMBO_HOTKEY}]`;
        stateModel.setProperty("/comboText", next);
        stateModel.setProperty("/comboStatus", `${Main.COMBO_HOTKEY} fired via HotkeyManager.`);
        stateModel.setProperty("/lastAction", "Combined demo hotkey");
        MessageToast.show(`${Main.COMBO_HOTKEY}: Combined demo hotkey fired`);
      },
      {
        scope: Scope.Main,
        description: "Combined hotkey + kiosk demo",
      },
    );

    // Target-element scoped hotkey — bound after rendering
    this._targetHandle = null;
  }

  onAfterRendering(): void {
    // Rebind target-element hotkey to the current DOM ref after each render
    if (this._targetHandle) {
      this._targetHandle.unregister();
      this._targetHandle = null;
    }

    const targetPanel = this.byId("targetPanel")?.getDomRef();
    if (targetPanel) {
      const stateModel = this.getStateModel();
      this._targetHandle = this._manager.register(
        "Ctrl+Enter",
        () => {
          stateModel.setProperty("/targetStatus", "Ctrl+Enter fired inside panel!");
          stateModel.setProperty("/lastAction", "Target-scoped Ctrl+Enter");
          MessageToast.show("Ctrl+Enter: Target-scoped hotkey fired!");
        },
        {
          scope: Scope.Main,
          target: targetPanel as HTMLElement,
          description: "Target-scoped action",
        },
      );
    }
  }

  onNavToDetail(): void {
    this._navToDetail();
  }

  onNavToKiosk(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  onConflictWarn(): void {
    this._configureConflictDemo(ConflictBehavior.Warn);
  }

  onConflictAllow(): void {
    this._configureConflictDemo(ConflictBehavior.Allow);
  }

  onConflictReplace(): void {
    this._configureConflictDemo(ConflictBehavior.Replace);
  }

  onConflictError(): void {
    this._configureConflictDemo(ConflictBehavior.Error);
  }

  onConflictReset(): void {
    this._clearConflictHandles();
    const stateModel = this.getStateModel();
    stateModel.setProperty("/conflictStatus", `Reset complete. Choose a strategy, then press ${Main.CONFLICT_HOTKEY}.`);
    stateModel.setProperty("/conflictState", "Information");
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
    this._dialogHotkeys.register(
      "F5",
      () => {
        stateModel.setProperty("/lastAction", "Refresh (Dialog)");
        MessageToast.show("F5: Refresh from Dialog");
      },
      {
        scope: Scope.Dialog,
        description: "Refresh (Dialog)",
      },
    );

    // Register dialog-scoped Escape to close dialog with proper cleanup
    this._dialogHotkeys.register(
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
    );

    this._dialog.open();
  }

  onExit(): void {
    this._clearConflictHandles();
    if (this._targetHandle) {
      this._targetHandle.unregister();
      this._targetHandle = null;
    }
    this._hotkeys.destroyAll();
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
    this._dialogHotkeys.destroyAll();
    this._dialogHotkeys = this._manager.createGroup();

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

  private _configureConflictDemo(behavior: (typeof ConflictBehavior)[keyof typeof ConflictBehavior]): void {
    this._clearConflictHandles();

    const stateModel = this.getStateModel();
    const triggerA = () => {
      stateModel.setProperty("/lastAction", `Conflict demo A (${behavior})`);
      stateModel.setProperty("/conflictStatus", `Handler A fired (${behavior}). Press ${Main.CONFLICT_HOTKEY} again.`);
      stateModel.setProperty("/conflictState", "Success");
    };
    const triggerB = () => {
      stateModel.setProperty("/lastAction", `Conflict demo B (${behavior})`);
      stateModel.setProperty("/conflictStatus", `Handler B fired (${behavior}). Press ${Main.CONFLICT_HOTKEY} again.`);
      stateModel.setProperty("/conflictState", "Success");
    };

    try {
      this._conflictHandles.push(
        this._manager.register(Main.CONFLICT_HOTKEY, triggerA, {
          scope: Scope.Main,
          description: `Conflict demo A (${behavior})`,
          conflictBehavior: behavior,
        }),
      );
      this._conflictHandles.push(
        this._manager.register(Main.CONFLICT_HOTKEY, triggerB, {
          scope: Scope.Main,
          description: `Conflict demo B (${behavior})`,
          conflictBehavior: behavior,
        }),
      );
      stateModel.setProperty("/conflictStatus", `Registered using ${behavior}. Press ${Main.CONFLICT_HOTKEY} to test.`);
      stateModel.setProperty("/conflictState", "Information");
    } catch (error) {
      stateModel.setProperty("/conflictStatus", `Registration failed (${behavior}): ${String(error)}`);
      stateModel.setProperty("/conflictState", "Error");
    }
  }

  private _clearConflictHandles(): void {
    for (const handle of this._conflictHandles) {
      if (handle.isActive) {
        handle.unregister();
      }
    }
    this._conflictHandles = [];
  }
}
