import MessageToast from "sap/m/MessageToast";
import { Scope } from "../constants";
import BaseController from "./BaseController";
import type HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";
import type HotkeyRecorder from "ui5/hotkeys/HotkeyRecorder";

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
  private _recorder!: HotkeyRecorder | null;

  onInit(): void {
    this._recorder = null;

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

    const stateModel = this.getStateModel();
    stateModel.setProperty("/isRecording", true);

    this._recorder = this._manager.createRecorder({
      onRecord: (hotkey) => {
        stateModel.setProperty("/recordedShortcut", hotkey || "(cleared)");
        stateModel.setProperty("/isRecording", false);
      },
      onCancel: () => {
        stateModel.setProperty("/isRecording", false);
      },
    });

    this._recorder.start();
  }

  onExit(): void {
    this._hotkeys.destroyAll();
    if (this._recorder) {
      this._recorder.destroy();
      this._recorder = null;
    }
  }

  private _navBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.Main);
  }
}
