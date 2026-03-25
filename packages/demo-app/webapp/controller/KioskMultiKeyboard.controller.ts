import type Input from "sap/m/Input";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Two independent KioskKeyboard instances on one page - demonstrates
 * instance isolation via `inputIds`.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskMultiKeyboard extends BaseController {
  private _sharedScenarioInitialized: boolean = false;

  onInit(): void {
    const stateModel = this.getStateModel();
    stateModel.setProperty("/multiSearchLastKey", "None");
    stateModel.setProperty("/multiQuantityLastKey", "None");
    stateModel.setProperty("/multiDockedOpen", false);
    stateModel.setProperty("/sharedAOpen", false);
    stateModel.setProperty("/sharedBOpen", false);
    stateModel.setProperty("/sharedInputMode", "(pending render)");
    stateModel.setProperty("/sharedInputModeState", "Information");
    stateModel.setProperty("/sharedExpectation", "Expected inputmode: email (all keyboards closed).");
    stateModel.setProperty("/sharedLastAction", "Last action: none");
  }

  onAfterRendering(): void {
    if (!this._sharedScenarioInitialized) {
      this._sharedScenarioInitialized = true;
      this.onResetSharedScenario();
      return;
    }

    this._syncSharedScenarioState();
  }

  onSearchKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this.getStateModel().setProperty("/multiSearchLastKey", this.formatKeyPress(event));
  }

  onQuantityKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this.getStateModel().setProperty("/multiQuantityLastKey", this.formatKeyPress(event));
  }

  onSearchAfterOpen(): void {
    this.getStateModel().setProperty("/multiDockedOpen", true);
  }

  onSearchAfterClose(): void {
    this.getStateModel().setProperty("/multiDockedOpen", false);
  }

  onOpenSharedA(): void {
    this._getSharedKeyboardA()?.show();
    this._syncSharedScenarioState("Opened keyboard A");
  }

  onCloseSharedA(): void {
    this._getSharedKeyboardA()?.close();
    this._syncSharedScenarioState("Closed keyboard A");
  }

  onOpenSharedB(): void {
    this._getSharedKeyboardB()?.show();
    this._syncSharedScenarioState("Opened keyboard B");
  }

  onCloseSharedB(): void {
    this._getSharedKeyboardB()?.close();
    this._syncSharedScenarioState("Closed keyboard B");
  }

  onResetSharedScenario(): void {
    this._closeSharedKeyboards();
    this._getSharedInputDomRef()?.setAttribute("inputmode", "email");
    this._syncSharedScenarioState("Reset scenario to inputmode=email");
  }

  onNavBack(): void {
    this._closeSharedKeyboards();
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  onExit(): void {
    this._closeSharedKeyboards();
  }

  private _getSharedKeyboardA(): KioskKeyboard | null {
    return (this.byId("sharedKeyboardA") as KioskKeyboard | undefined) ?? null;
  }

  private _getSharedKeyboardB(): KioskKeyboard | null {
    return (this.byId("sharedKeyboardB") as KioskKeyboard | undefined) ?? null;
  }

  private _closeSharedKeyboards(): void {
    this._getSharedKeyboardA()?.close();
    this._getSharedKeyboardB()?.close();
  }

  private _getSharedInputDomRef(): HTMLInputElement | null {
    const input = this.byId("sharedInput") as Input | undefined;
    const dom = input?.getFocusDomRef();
    return dom instanceof HTMLInputElement ? dom : null;
  }

  private _syncSharedScenarioState(lastAction?: string): void {
    const stateModel = this.getStateModel();
    const aOpen = this._getSharedKeyboardA()?.isOpen() ?? false;
    const bOpen = this._getSharedKeyboardB()?.isOpen() ?? false;
    const inputDom = this._getSharedInputDomRef();

    const inputMode = inputDom?.getAttribute("inputmode") ?? null;
    const expectedInputMode = aOpen || bOpen ? "none" : "email";
    const expectation =
      aOpen || bOpen
        ? "Expected inputmode: none (at least one keyboard is open)."
        : "Expected inputmode: email (all keyboards closed).";

    let inputModeState: "Information" | "Success" | "Error" = "Information";
    if (inputDom) {
      inputModeState = inputMode === expectedInputMode ? "Success" : "Error";
    }

    stateModel.setProperty("/sharedAOpen", aOpen);
    stateModel.setProperty("/sharedBOpen", bOpen);
    stateModel.setProperty("/sharedInputMode", inputMode ?? "(unset)");
    stateModel.setProperty("/sharedInputModeState", inputModeState);
    stateModel.setProperty("/sharedExpectation", expectation);

    if (lastAction) {
      stateModel.setProperty("/sharedLastAction", `Last action: ${lastAction}`);
    }
  }
}
