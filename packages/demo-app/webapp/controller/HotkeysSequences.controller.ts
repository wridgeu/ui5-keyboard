import MessageToast from "sap/m/MessageToast";
import { Scope } from "../constants";
import BaseController from "./BaseController";
import type HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";

/**
 * Hotkeys sequence scenario demo.
 *
 * @name demo.hotkeys.controller.HotkeysSequences
 */
export default class HotkeysSequences extends BaseController {
  private _manager!: HotkeyManager;
  private _hotkeys!: RegistrationGroup;
  private _pendingTimer: ReturnType<typeof setTimeout> | null = null;

  onInit(): void {
    this._manager = this.getTypedComponent().getHotkeyManager();
    this._hotkeys = this._manager.createGroup();

    const stateModel = this.getStateModel();
    stateModel.setProperty("/sequenceStatus", "");

    this._hotkeys.registerSequence(
      ["G", "I"],
      () => {
        stateModel.setProperty("/lastAction", "Sequence: G I");
        stateModel.setProperty("/sequenceStatus", "");
        MessageToast.show("Sequence G I fired");
      },
      { scope: Scope.HotkeysSequences, description: "Go to Inbox" },
    );

    this._hotkeys.registerSequence(
      ["G", "S"],
      () => {
        stateModel.setProperty("/lastAction", "Sequence: G S");
        stateModel.setProperty("/sequenceStatus", "");
        MessageToast.show("Sequence G S fired");
      },
      { scope: Scope.HotkeysSequences, description: "Go to Settings" },
    );

    this._manager.setSequencePendingHandler((info) => {
      if (this._pendingTimer) {
        clearTimeout(this._pendingTimer);
      }
      stateModel.setProperty(
        "/sequenceStatus",
        `Waiting for next key (${info.completedSteps}/${info.totalSteps}) - press ${info.nextKey}`,
      );
      this._pendingTimer = setTimeout(() => {
        stateModel.setProperty("/sequenceStatus", "");
        this._pendingTimer = null;
      }, 1500);
    });
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.HotkeysHub);
  }

  onExit(): void {
    this._hotkeys.destroyAll();
    this._manager.setSequencePendingHandler(null);
    if (this._pendingTimer) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
  }
}
