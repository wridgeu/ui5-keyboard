import MessageToast from "sap/m/MessageToast";
import type JSONModel from "sap/ui/model/json/JSONModel";
import { Scope } from "../constants";
import BaseController from "./BaseController";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";

/** Step timeout both sequences register with; the hint clears on the same clock. */
const SEQUENCE_TIMEOUT = 1000;

/**
 * Hotkeys sequence scenario demo.
 *
 * @namespace demo.hotkeys.controller
 */
export default class HotkeysSequences extends BaseController {
  private _hotkeys!: RegistrationGroup;
  private _pendingTimer: ReturnType<typeof setTimeout> | null = null;
  /** Continuations reported by the `onPending` calls of the current key press. */
  private _nextKeys: string[] = [];
  private _collectingKeyPress = false;

  override onInit(): void {
    this._hotkeys = this.getTypedComponent().getHotkeyManager().createGroup();

    const stateModel = this.getStateModel();
    stateModel.setProperty("/sequenceStatus", "");

    const onPending = this._createPendingHandler(stateModel);

    this._hotkeys.register(
      "G I",
      () => {
        stateModel.setProperty("/lastAction", "Sequence: G I");
        stateModel.setProperty("/sequenceStatus", "");
        MessageToast.show("Sequence G I fired");
      },
      { scope: Scope.HotkeysSequences, description: "Go to Inbox", timeout: SEQUENCE_TIMEOUT, onPending },
    );

    this._hotkeys.register(
      "G S",
      () => {
        stateModel.setProperty("/lastAction", "Sequence: G S");
        stateModel.setProperty("/sequenceStatus", "");
        MessageToast.show("Sequence G S fired");
      },
      { scope: Scope.HotkeysSequences, description: "Go to Settings", timeout: SEQUENCE_TIMEOUT, onPending },
    );
  }

  onNavBack(): void {
    this.getRouter().navTo(Scope.HotkeysHub);
  }

  override onExit(): void {
    this._hotkeys.destroyAll();
    if (this._pendingTimer) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
  }

  private _createPendingHandler(stateModel: JSONModel) {
    return (info: { completedSteps: number; totalSteps: number; nextKey: string }) => {
      // One key press fires onPending once per sequence it advanced, synchronously
      // within the keydown; the microtask closes that batch.
      if (!this._collectingKeyPress) {
        this._collectingKeyPress = true;
        this._nextKeys = [];
        queueMicrotask(() => {
          this._collectingKeyPress = false;
        });
      }
      if (!this._nextKeys.includes(info.nextKey)) {
        this._nextKeys.push(info.nextKey);
      }
      if (this._pendingTimer) {
        clearTimeout(this._pendingTimer);
      }
      stateModel.setProperty(
        "/sequenceStatus",
        `Waiting for next key (${info.completedSteps}/${info.totalSteps}) - press ${this._nextKeys.join(" or ")}`,
      );
      this._pendingTimer = setTimeout(() => {
        stateModel.setProperty("/sequenceStatus", "");
        this._pendingTimer = null;
      }, SEQUENCE_TIMEOUT);
    };
  }
}
