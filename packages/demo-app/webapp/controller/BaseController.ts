import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import type Component from "../Component";

/**
 * Base controller for the demo app.
 *
 * Provides typed accessors for the owner component and state model,
 * eliminating repeated `as Component` / `as JSONModel` casts in every controller.
 *
 * @namespace demo.hotkeys.controller
 */
export default class BaseController extends Controller {
  getTypedComponent(): Component {
    return this.getOwnerComponent() as Component;
  }

  getStateModel(): JSONModel {
    return this.getTypedComponent().getModel("state") as JSONModel;
  }

  /** Format a KioskKeyboard keyPress event as a display string (e.g. "a (Shift)"). */
  protected formatKeyPress(event: KioskKeyboard$KeyPressEvent): string {
    const key = event.getParameter("key") ?? "";
    const shift = event.getParameter("shiftKey") ?? false;
    return shift ? `${key} (Shift)` : key;
  }
}
