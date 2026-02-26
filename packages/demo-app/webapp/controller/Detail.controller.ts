import MessageToast from "sap/m/MessageToast";
import { Scope } from "../constants";
import BaseController from "./BaseController";
import type HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";
import type HotkeyRecorder from "ui5/hotkeys/HotkeyRecorder";
import type { HotkeyRegistrationHandle } from "ui5/hotkeys/types";

/**
 * Detail view controller — demonstrates same-key-different-scope pattern.
 * F5 fires a different handler here vs Main, resolved by the scope system.
 *
 * No scope management code needed — `enableRouterIntegration()` in
 * the Component handles it.
 *
 * @name demo.hotkeys.controller.Detail
 */
export default class Detail extends BaseController {
  private _manager!: HotkeyManager;
  private _hotkeys!: RegistrationGroup;
  private _recorder: HotkeyRecorder | null = null;
  private _dynamicHandle: HotkeyRegistrationHandle | null = null;

  onInit(): void {
    this._manager = this.getTypedComponent().getHotkeyManager();
    this._hotkeys = this._manager.createGroup();
    const stateModel = this.getStateModel();

    // Scope "detail" matches the route name — auto-activated by router integration
    this._hotkeys.register(
      "F5",
      () => {
        stateModel.setProperty("/lastAction", "Refresh (Detail View)");
        MessageToast.show("F5: Refresh from Detail View");
      },
      {
        scope: Scope.Detail,
        description: "Refresh (Detail View)",
      },
    );

    this._hotkeys.register(
      "Mod+B",
      () => {
        this._navBack();
      },
      {
        scope: Scope.Detail,
        description: "Navigate Back",
      },
    );
  }

  onNavBack(): void {
    this._navBack();
  }

  onStartRecording(): void {
    if (this._recorder?.isRecording) return;
    this._destroyRecorder();

    const stateModel = this.getStateModel();
    stateModel.setProperty("/isRecording", true);

    this._recorder = this._manager.createRecorder({
      onRecord: (hotkey) => {
        stateModel.setProperty("/recordedShortcut", hotkey || "(cleared)");
        stateModel.setProperty("/isRecording", false);

        this._unregisterDynamic();

        if (hotkey) {
          this._dynamicHandle = this._hotkeys.register(
            hotkey,
            () => {
              stateModel.setProperty("/lastAction", `Custom shortcut: ${hotkey}`);
              MessageToast.show(`Custom shortcut fired: ${hotkey}`);
            },
            { scope: Scope.Detail, description: `Custom: ${hotkey}` },
          );
        }
      },
      onCancel: () => {
        stateModel.setProperty("/isRecording", false);
      },
    });

    this._recorder.start();
  }

  onResetRecording(): void {
    this._unregisterDynamic();
    this._destroyRecorder();

    const stateModel = this.getStateModel();
    stateModel.setProperty("/recordedShortcut", "");
    stateModel.setProperty("/isRecording", false);
  }

  onExit(): void {
    this._destroyRecorder();
    // destroyAll() unregisters every handle in the group, including _dynamicHandle
    this._hotkeys.destroyAll();
  }

  private _unregisterDynamic(): void {
    if (this._dynamicHandle?.isActive) {
      this._dynamicHandle.unregister();
    }
    this._dynamicHandle = null;
  }

  private _destroyRecorder(): void {
    if (this._recorder && !this._recorder.isDestroyed) {
      this._recorder.destroy();
    }
    this._recorder = null;
  }

  private _navBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.HotkeysHub);
  }
}
