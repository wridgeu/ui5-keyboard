import type App from "sap/m/App";
import type Input from "sap/m/Input";
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
 * @namespace demo.hotkeys.controller
 */
export default class HotkeysTargetBubble extends BaseController {
  private static readonly _MAX_LOG = 80;

  private _manager!: HotkeyManager;
  private _outerHandle: HotkeyRegistrationHandle | null = null;
  private _innerHandle: HotkeyRegistrationHandle | null = null;
  private _docFallbackHandle: HotkeyRegistrationHandle | null = null;
  private _logModel!: JSONModel;
  private _renderDelegate = { onAfterRendering: () => this._bindTargetHotkeys() };
  private _boundOuterTarget: HTMLElement | null = null;
  private _boundInnerTarget: HTMLElement | null = null;

  onInit(): void {
    this._manager = this.getTypedComponent().getHotkeyManager();

    this._logModel = new JSONModel({ entries: [] as LogEntry[] });
    this.getView()!.setModel(this._logModel, "bubbleLog");

    // Re-bind whenever the target container re-renders (DOM refs change)
    this.byId("outerTargetBox")!.addEventDelegate(this._renderDelegate);
    this.byId("bubbleInput")!.addEventDelegate(this._renderDelegate);
    // Uses attachRouteMatched (not attachPatternMatched) because autoFocus
    // must be restored when navigating to any other route, not just this one.
    this.getTypedComponent().getRouter().attachRouteMatched(this._onRouteMatched, this);
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
    this._destroyHandles();
  }

  private _bindTargetHotkeys(): void {
    const outerTarget = this.byId("outerTargetBox")?.getDomRef();
    const bubbleInput = this.byId("bubbleInput") as Input | undefined;
    const innerTarget = bubbleInput?.getDomRef();
    if (!outerTarget || !innerTarget) {
      return;
    }

    const outerTargetElement = outerTarget as HTMLElement;
    const innerTargetElement = innerTarget as HTMLElement;

    if (
      this._docFallbackHandle &&
      this._outerHandle &&
      this._innerHandle &&
      this._boundOuterTarget === outerTargetElement &&
      this._boundInnerTarget === innerTargetElement
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
        target: outerTargetElement,
        stopPropagation: true,
        description: "Outer target Escape",
      },
    );

    const stateModel = this.getStateModel();
    this._innerHandle = this._manager.register(
      "Escape",
      () => {
        this._addLogEntry("Escape", "inner target fired", "Success");
        stateModel.setProperty("/lastAction", "Target bubble demo fired");
      },
      {
        scope: Scope.HotkeysTargetBubble,
        target: innerTargetElement,
        stopPropagation: true,
        description: "Inner target Escape",
      },
    );

    this._docFallbackHandle = this._manager.register(
      "Escape",
      () => {
        this._addLogEntry("Escape", "outside nested target", "Information");
      },
      {
        scope: Scope.HotkeysTargetBubble,
        stopPropagation: false,
        description: "Route fallback Escape",
      },
    );

    this._boundOuterTarget = outerTargetElement;
    this._boundInnerTarget = innerTargetElement;
  }

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    const isTargetRoute = event.getParameter("name") === Scope.HotkeysTargetBubble;
    this._setAppAutoFocus(!isTargetRoute);
    if (!isTargetRoute) {
      return;
    }
    this._bindTargetHotkeys();
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
    this._boundOuterTarget = null;
    this._boundInnerTarget = null;
  }
}
