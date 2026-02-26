import MessageToast from "sap/m/MessageToast";
import type App from "sap/m/App";
import type Input from "sap/m/Input";
import type { Switch$ChangeEvent } from "sap/m/Switch";
import type View from "sap/ui/core/mvc/View";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import JSONModel from "sap/ui/model/json/JSONModel";
import { Scope } from "../constants";
import BaseController from "./BaseController";
import type HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type { HotkeyRegistrationHandle } from "ui5/hotkeys/types";

interface LogEntry {
  time: string;
  event: string;
  detail: string;
  state: string;
}

/**
 * Target-scoped bubbling scenario demo.
 *
 * @name demo.hotkeys.controller.HotkeysTargetBubble
 */
export default class HotkeysTargetBubble extends BaseController {
  private static readonly _MAX_LOG = 80;

  private _manager!: HotkeyManager;
  private _outerHandle: HotkeyRegistrationHandle | null = null;
  private _innerHandle: HotkeyRegistrationHandle | null = null;
  private _innerWrapperHandle: HotkeyRegistrationHandle | null = null;
  private _docFallbackHandle: HotkeyRegistrationHandle | null = null;
  private _logModel!: JSONModel;
  private _renderDelegate = { onAfterRendering: () => this._bindTargetHotkeys() };
  private _focusTimers: number[] = [];
  private _boundOuterTargetId: string | null = null;
  private _boundInnerTargetId: string | null = null;
  private _boundInnerWrapperTargetId: string | null = null;
  private _boundBubbleEnabled = false;

  onInit(): void {
    this._manager = this.getTypedComponent().getHotkeyManager();
    const stateModel = this.getStateModel();
    stateModel.setProperty("/hotkeysBubbleEnabled", false);

    this._logModel = new JSONModel({ entries: [] as LogEntry[] });
    this.getView()!.setModel(this._logModel, "bubbleLog");

    // Re-bind whenever the target container re-renders (DOM refs change)
    this.byId("outerTargetBox")!.addEventDelegate(this._renderDelegate);
    this.byId("bubbleInput")!.addEventDelegate(this._renderDelegate);
    this.getTypedComponent().getRouter().attachRouteMatched(this._onRouteMatched, this);
  }

  onToggleBubble(event: Switch$ChangeEvent): void {
    const enabled = Boolean(event.getParameter("state"));
    this.getStateModel().setProperty("/hotkeysBubbleEnabled", enabled);
    this._bindTargetHotkeys();
  }

  onClearLog(): void {
    this._logModel.setProperty("/entries", []);
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.HotkeysHub);
  }

  onExit(): void {
    this.byId("outerTargetBox")?.removeEventDelegate(this._renderDelegate);
    this.byId("bubbleInput")?.removeEventDelegate(this._renderDelegate);
    this.getTypedComponent().getRouter().detachRouteMatched(this._onRouteMatched, this);
    this._setAppAutoFocus(true);
    this._clearFocusTimers();
    this._destroyHandles();
  }

  private _bindTargetHotkeys(): void {
    const outerTarget = this.byId("outerTargetBox")?.getDomRef();
    const bubbleInput = this.byId("bubbleInput") as Input | undefined;
    const innerTarget = bubbleInput?.getFocusDomRef() ?? bubbleInput?.getDomRef();
    const innerWrapperTarget = bubbleInput?.getDomRef();
    if (!outerTarget || !innerTarget) {
      return;
    }

    const stateModel = this.getStateModel();
    const bubbleEnabled = stateModel.getProperty("/hotkeysBubbleEnabled") as boolean;

    const nextOuterId = outerTarget.id || null;
    const nextInnerId = (innerTarget as HTMLElement).id || null;
    const nextInnerWrapperId = innerWrapperTarget?.id || null;
    if (
      this._docFallbackHandle &&
      this._outerHandle &&
      this._innerHandle &&
      this._boundOuterTargetId === nextOuterId &&
      this._boundInnerTargetId === nextInnerId &&
      this._boundInnerWrapperTargetId === nextInnerWrapperId &&
      this._boundBubbleEnabled === bubbleEnabled
    ) {
      return;
    }

    this._destroyHandles();

    this._outerHandle = this._manager.register(
      "Escape",
      () => {
        this._addLogEntry("Escape", "outer target fired", "Warning");
      },
      {
        scope: Scope.HotkeysTargetBubble,
        target: outerTarget as HTMLElement,
        stopPropagation: true,
        description: "Outer target Escape",
      },
    );

    this._innerHandle = this._manager.register(
      "Escape",
      () => {
        this._addLogEntry("Escape", "inner target fired", "Success");
        stateModel.setProperty("/lastAction", "Target bubble demo fired");
        MessageToast.show("Inner target fired");
      },
      {
        scope: Scope.HotkeysTargetBubble,
        target: innerTarget as HTMLElement,
        allowBubble: bubbleEnabled,
        stopPropagation: !bubbleEnabled,
        description: "Inner target Escape",
      },
    );

    if (innerWrapperTarget && innerWrapperTarget !== innerTarget) {
      this._innerWrapperHandle = this._manager.register(
        "Escape",
        () => {
          this._addLogEntry("Escape", "inner target fired", "Success");
          stateModel.setProperty("/lastAction", "Target bubble demo fired");
          MessageToast.show("Inner target fired");
        },
        {
          scope: Scope.HotkeysTargetBubble,
          target: innerWrapperTarget as HTMLElement,
          allowBubble: bubbleEnabled,
          stopPropagation: !bubbleEnabled,
          description: "Inner wrapper Escape",
        },
      );
    }

    this._docFallbackHandle = this._manager.register(
      "Escape",
      () => {
        this._addLogEntry("Escape", "outside nested target (refocus input)", "Information");
        this._focusBubbleInput();
      },
      {
        scope: Scope.HotkeysTargetBubble,
        stopPropagation: false,
        description: "Route fallback Escape",
      },
    );

    this._boundOuterTargetId = nextOuterId;
    this._boundInnerTargetId = nextInnerId;
    this._boundInnerWrapperTargetId = nextInnerWrapperId;
    this._boundBubbleEnabled = bubbleEnabled;

    this._focusBubbleInput();
  }

  private _focusBubbleInput(): void {
    const input = this.byId("bubbleInput") as Input | undefined;
    input?.focus();
  }

  private _focusBubbleInputAfterNavigation(): void {
    this._clearFocusTimers();

    const timer = window.setTimeout(() => {
      if (this._manager.getActiveScope() !== Scope.HotkeysTargetBubble) {
        return;
      }
      const input = this.byId("bubbleInput") as Input | undefined;
      input?.focus();
    }, 0);
    this._focusTimers.push(timer);
  }

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    const isTargetRoute = event.getParameter("name") === Scope.HotkeysTargetBubble;
    this._setAppAutoFocus(!isTargetRoute);
    if (!isTargetRoute) {
      this._clearFocusTimers();
      return;
    }
    this._bindTargetHotkeys();
    this._focusBubbleInputAfterNavigation();
  }

  private _setAppAutoFocus(enabled: boolean): void {
    const rootView = this.getTypedComponent().getRootControl() as View | undefined;
    const app = rootView?.byId("appControl") as App | undefined;
    if (!app) {
      return;
    }
    if (app.getAutoFocus() !== enabled) {
      app.setAutoFocus(enabled);
    }
  }

  private _clearFocusTimers(): void {
    for (const timer of this._focusTimers) {
      window.clearTimeout(timer);
    }
    this._focusTimers = [];
  }

  private _addLogEntry(event: string, detail: string, state: string): void {
    const current = (this._logModel.getProperty("/entries") as LogEntry[]) ?? [];
    const next = [{ time: this._formatTimestamp(new Date()), event, detail, state }, ...current].slice(
      0,
      HotkeysTargetBubble._MAX_LOG,
    );
    this._logModel.setProperty("/entries", next);
  }

  private _formatTimestamp(now: Date): string {
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    return `${hh}:${mm}:${ss}.${ms}`;
  }

  private _destroyHandles(): void {
    if (this._docFallbackHandle) {
      this._docFallbackHandle.unregister();
      this._docFallbackHandle = null;
    }
    if (this._outerHandle) {
      this._outerHandle.unregister();
      this._outerHandle = null;
    }
    if (this._innerHandle) {
      this._innerHandle.unregister();
      this._innerHandle = null;
    }
    if (this._innerWrapperHandle) {
      this._innerWrapperHandle.unregister();
      this._innerWrapperHandle = null;
    }
    this._boundOuterTargetId = null;
    this._boundInnerTargetId = null;
    this._boundInnerWrapperTargetId = null;
  }
}
