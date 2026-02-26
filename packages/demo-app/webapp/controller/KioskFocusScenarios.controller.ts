import Input from "sap/m/Input";
import JSONModel from "sap/ui/model/json/JSONModel";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type {
  KioskKeyboard$KeyPressEvent,
  KioskKeyboard$KeyboardTypeChangeEvent,
  KioskKeyboard$LayoutChangeEvent,
} from "ui5/kiosk/KioskKeyboard";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import { Scope } from "../constants";
import BaseController from "./BaseController";

interface LogEntry {
  time: Date;
  event: string;
  detail: string;
  state: string;
}

/**
 * Focus scenarios demo - interactive testbed for verifying docked KioskKeyboard
 * focus transitions, auto-show/close behavior, and deferred focus handling.
 *
 * @name demo.hotkeys.controller.KioskFocusScenarios
 */
export default class KioskFocusScenarios extends BaseController {
  private static readonly _MAX_LOG = 80;

  private _logModel!: JSONModel;
  private _focusDelegate!: { onfocusin: (event: Event) => void; onfocusout: (event: Event) => void };
  private _deferredTimer: ReturnType<typeof setTimeout> | null = null;

  onInit(): void {
    this._logModel = new JSONModel({ entries: [] as LogEntry[] });
    this.getView()!.setModel(this._logModel, "log");

    this._focusDelegate = {
      onfocusin: this._onDomFocusIn.bind(this),
      onfocusout: this._onDomFocusOut.bind(this),
    };
    this.byId("scenarioArea")!.addEventDelegate(this._focusDelegate);

    this.getTypedComponent().getRouter().attachRouteMatched(this._onRouteMatched, this);
  }

  onExit(): void {
    this.getTypedComponent().getRouter().detachRouteMatched(this._onRouteMatched, this);
    this.byId("scenarioArea")?.removeEventDelegate(this._focusDelegate);
    this._setKeyboardRouteActive(false);

    if (this._deferredTimer !== null) {
      clearTimeout(this._deferredTimer);
      this._deferredTimer = null;
    }
  }

  // --- Keyboard events ---

  onKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this._addLogEntry("keyPress", this.formatKeyPress(event), "Information");
  }

  onAfterOpen(): void {
    this._addLogEntry("afterOpen", "Keyboard opened", "Success");
  }

  onAfterClose(): void {
    this._addLogEntry("afterClose", "Keyboard closed", "None");
  }

  onKeyboardTypeChange(event: KioskKeyboard$KeyboardTypeChangeEvent): void {
    const type = event.getParameter("keyboardType") ?? "";
    const prev = event.getParameter("previousKeyboardType") ?? "";
    const auto = event.getParameter("autoDetected") ?? false;
    this._addLogEntry("typeChange", auto ? `${prev} \u2192 ${type} (auto)` : `${prev} \u2192 ${type}`, "Information");
  }

  onLayoutChange(event: KioskKeyboard$LayoutChangeEvent): void {
    this._addLogEntry("layoutChange", event.getParameter("layout") ?? "", "Information");
  }

  // --- Scenario handlers ---

  onAdjacentButtonPress(): void {
    this._addLogEntry("press", "Adjacent Button pressed", "Information");
  }

  onDeferredFocus(): void {
    if (this._deferredTimer !== null) {
      clearTimeout(this._deferredTimer);
    }

    const input1 = this.byId("focusInput1") as Input;
    input1.focus();
    this._addLogEntry("timer", "Focus \u2192 focusInput1; moving to outsideInput in 2 s", "Warning");

    this._deferredTimer = setTimeout(() => {
      this._deferredTimer = null;
      const outside = this.byId("outsideInput") as Input;
      outside.focus();
      this._addLogEntry("timer", "Deferred focus \u2192 outsideInput (relatedTarget was null)", "Warning");
    }, 2000);
  }

  onClearLog(): void {
    this._logModel.setProperty("/entries", []);
  }

  onNavBack(): void {
    this._setKeyboardRouteActive(false);
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  // --- DOM focus delegate ---

  private _onDomFocusIn(event: Event): void {
    const fe = event as FocusEvent;
    const target = this._describeElement(fe.target as HTMLElement | null);
    const related = this._describeElement(fe.relatedTarget as HTMLElement | null);
    this._addLogEntry("focusin", `${target} \u2190 from ${related}`, "Success");
  }

  private _onDomFocusOut(event: Event): void {
    const fe = event as FocusEvent;
    const target = this._describeElement(fe.target as HTMLElement | null);
    const related = this._describeElement(fe.relatedTarget as HTMLElement | null);
    this._addLogEntry("focusout", `${target} \u2192 to ${related}`, "Warning");
  }

  // --- Private helpers ---

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    this._setKeyboardRouteActive(event.getParameter("name") === Scope.KioskFocusScenarios);
  }

  private _setKeyboardRouteActive(active: boolean): void {
    const keyboard = this.byId("focusKeyboard") as KioskKeyboard | undefined;
    if (!keyboard) return;

    if (active) {
      keyboard.setAutoShow(true);
      return;
    }

    keyboard.close();
    keyboard.setAutoShow(false);
  }

  private _describeElement(el: HTMLElement | null): string {
    if (!el) return "(null)";
    const id = el.id;
    if (!id) return el.tagName.toLowerCase();
    const prefix = this.getView()!.getId() + "--";
    return id.startsWith(prefix) ? id.slice(prefix.length) : id;
  }

  private _addLogEntry(event: string, detail: string, state: string): void {
    const entries = this._logModel.getProperty("/entries") as LogEntry[];
    entries.unshift({ time: new Date(), event, detail, state });
    if (entries.length > KioskFocusScenarios._MAX_LOG) {
      entries.length = KioskFocusScenarios._MAX_LOG;
    }
    this._logModel.setProperty("/entries", entries);
  }
}
