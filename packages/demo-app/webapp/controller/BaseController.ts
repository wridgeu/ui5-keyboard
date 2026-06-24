import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import type Router from "sap/ui/core/routing/Router";
import type { ListBase$ItemPressEvent } from "sap/m/ListBase";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import type Component from "../Component";

/**
 * Base controller for the demo app.
 *
 * Provides typed accessors for the owner component, its router, and the
 * state model, eliminating repeated `as Component` / `as JSONModel` casts
 * and `getTypedComponent().getRouter()` chains in every controller.
 *
 * @namespace demo.hotkeys.controller
 */
export default class BaseController extends Controller {
  getTypedComponent(): Component {
    return this.getOwnerComponent() as Component;
  }

  /** The owner component's router. */
  getRouter(): Router {
    return this.getTypedComponent().getRouter();
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

  /** Navigate to the route held in the pressed list item's `state` binding context. */
  onListEntryNavigate(event: ListBase$ItemPressEvent): void {
    const item = event.getParameter("listItem");
    const route = item?.getBindingContext("state")?.getProperty("route") as string | undefined;
    if (!route) return;
    this.getRouter().navTo(route);
  }
}
