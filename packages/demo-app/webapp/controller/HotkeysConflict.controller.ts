import { ConflictBehavior } from "ui5/hotkeys/library";
import type HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type { HotkeyRegistrationHandle } from "ui5/hotkeys/types";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Conflict behavior scenario demo.
 *
 * @namespace demo.hotkeys.controller
 */
export default class HotkeysConflict extends BaseController {
  private static readonly CONFLICT_HOTKEY = "Ctrl+Shift+K";

  private _manager!: HotkeyManager;
  private _conflictHandles: HotkeyRegistrationHandle[] = [];

  onInit(): void {
    this._manager = this.getTypedComponent().getHotkeyManager();
    const stateModel = this.getStateModel();
    stateModel.setProperty(
      "/conflictStatus",
      `Not configured. Choose a strategy, then press ${HotkeysConflict.CONFLICT_HOTKEY}.`,
    );
    stateModel.setProperty("/conflictState", "Information");
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.HotkeysHub);
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
    stateModel.setProperty(
      "/conflictStatus",
      `Reset complete. Choose a strategy, then press ${HotkeysConflict.CONFLICT_HOTKEY}.`,
    );
    stateModel.setProperty("/conflictState", "Information");
  }

  onExit(): void {
    this._clearConflictHandles();
  }

  private _configureConflictDemo(behavior: (typeof ConflictBehavior)[keyof typeof ConflictBehavior]): void {
    this._clearConflictHandles();

    const stateModel = this.getStateModel();
    const triggerA = () => {
      stateModel.setProperty("/lastAction", `Conflict demo A (${behavior})`);
      stateModel.setProperty(
        "/conflictStatus",
        `Handler A fired (${behavior}). Press ${HotkeysConflict.CONFLICT_HOTKEY} again.`,
      );
      stateModel.setProperty("/conflictState", "Success");
    };
    const triggerB = () => {
      stateModel.setProperty("/lastAction", `Conflict demo B (${behavior})`);
      stateModel.setProperty(
        "/conflictStatus",
        `Handler B fired (${behavior}). Press ${HotkeysConflict.CONFLICT_HOTKEY} again.`,
      );
      stateModel.setProperty("/conflictState", "Success");
    };

    try {
      this._conflictHandles.push(
        this._manager.register(HotkeysConflict.CONFLICT_HOTKEY, triggerA, {
          scope: Scope.HotkeysConflict,
          description: `Conflict demo A (${behavior})`,
          conflictBehavior: behavior,
        }),
      );
      this._conflictHandles.push(
        this._manager.register(HotkeysConflict.CONFLICT_HOTKEY, triggerB, {
          scope: Scope.HotkeysConflict,
          description: `Conflict demo B (${behavior})`,
          conflictBehavior: behavior,
        }),
      );
      stateModel.setProperty(
        "/conflictStatus",
        `Registered using ${behavior}. Press ${HotkeysConflict.CONFLICT_HOTKEY} to test.`,
      );
      stateModel.setProperty("/conflictState", "Information");
    } catch (error) {
      this._clearConflictHandles();
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
