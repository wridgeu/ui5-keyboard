import MessageToast from "sap/m/MessageToast";
import type JSONModel from "sap/ui/model/json/JSONModel";
import { Scope } from "../constants";
import BaseController from "./BaseController";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";

/**
 * Hotkeys sequence scenario demo.
 *
 * @namespace demo.hotkeys.controller
 */
export default class HotkeysSequences extends BaseController {
  private _hotkeys!: RegistrationGroup;
  private _pendingTimer: ReturnType<typeof setTimeout> | null = null;

  onInit(): void {
    this._hotkeys = this.getTypedComponent().getHotkeyManager().createGroup();

    const stateModel = this.getStateModel();
    stateModel.setProperty("/sequenceStatus", "");

    const onPending = this._createPendingHandler(stateModel);

    this._hotkeys.registerSequence(
      ["G", "I"],
      () => {
        stateModel.setProperty("/lastAction", "Sequence: G I");
        stateModel.setProperty("/sequenceStatus", "");
        MessageToast.show("Sequence G I fired");
      },
      { scope: Scope.HotkeysSequences, description: "Go to Inbox", onPending },
    );

    this._hotkeys.registerSequence(
      ["G", "S"],
      () => {
        stateModel.setProperty("/lastAction", "Sequence: G S");
        stateModel.setProperty("/sequenceStatus", "");
        MessageToast.show("Sequence G S fired");
      },
      { scope: Scope.HotkeysSequences, description: "Go to Settings", onPending },
    );
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.HotkeysHub);
  }

  onExit(): void {
    this._hotkeys.destroyAll();
    if (this._pendingTimer) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
  }

  private _createPendingHandler(stateModel: JSONModel) {
    return (info: { completedSteps: number; totalSteps: number; nextKey: string }) => {
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
    };
  }
}
