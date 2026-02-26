import MessageToast from "sap/m/MessageToast";
import type { Switch$ChangeEvent } from "sap/m/Switch";
import { Scope } from "../constants";
import BaseController from "./BaseController";
import type HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type { HotkeyRegistrationHandle } from "ui5/hotkeys/types";

/**
 * Target-scoped bubbling scenario demo.
 *
 * @name demo.hotkeys.controller.HotkeysTargetBubble
 */
export default class HotkeysTargetBubble extends BaseController {
  private _manager!: HotkeyManager;
  private _outerHandle: HotkeyRegistrationHandle | null = null;
  private _innerHandle: HotkeyRegistrationHandle | null = null;

  onInit(): void {
    this._manager = this.getTypedComponent().getHotkeyManager();
    const stateModel = this.getStateModel();
    stateModel.setProperty("/hotkeysBubbleEnabled", false);
    stateModel.setProperty(
      "/hotkeysBubbleLog",
      "Focus the inner input and press Escape.\nExpect only inner by default; enable allowBubble for inner+outer.",
    );
  }

  onAfterRendering(): void {
    this._bindTargetHotkeys();
  }

  onToggleBubble(event: Switch$ChangeEvent): void {
    const enabled = Boolean(event.getParameter("state"));
    this.getStateModel().setProperty("/hotkeysBubbleEnabled", enabled);
    this._bindTargetHotkeys();
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.HotkeysHub);
  }

  onExit(): void {
    this._destroyHandles();
  }

  private _bindTargetHotkeys(): void {
    this._destroyHandles();

    const outerTarget = this.byId("outerTargetBox")?.getDomRef();
    const innerTarget = this.byId("innerTargetBox")?.getDomRef();
    if (!outerTarget || !innerTarget) return;

    const stateModel = this.getStateModel();

    this._outerHandle = this._manager.register(
      "Escape",
      () => {
        this._appendLogLine("outer target fired");
      },
      {
        scope: Scope.HotkeysTargetBubble,
        target: outerTarget as HTMLElement,
        stopPropagation: false,
        description: "Outer target Escape",
      },
    );

    this._innerHandle = this._manager.register(
      "Escape",
      () => {
        this._appendLogLine("inner target fired");
        stateModel.setProperty("/lastAction", "Target bubble demo fired");
        MessageToast.show("Inner target fired");
      },
      {
        scope: Scope.HotkeysTargetBubble,
        target: innerTarget as HTMLElement,
        allowBubble: stateModel.getProperty("/hotkeysBubbleEnabled") as boolean,
        stopPropagation: false,
        description: "Inner target Escape",
      },
    );
  }

  private _appendLogLine(line: string): void {
    const stateModel = this.getStateModel();
    const current = (stateModel.getProperty("/hotkeysBubbleLog") as string) || "";
    stateModel.setProperty("/hotkeysBubbleLog", current ? `${current}\n${line}` : line);
  }

  private _destroyHandles(): void {
    if (this._outerHandle) {
      this._outerHandle.unregister();
      this._outerHandle = null;
    }
    if (this._innerHandle) {
      this._innerHandle.unregister();
      this._innerHandle = null;
    }
  }
}
