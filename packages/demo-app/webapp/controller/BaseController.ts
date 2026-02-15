import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import type Component from "../Component";

/**
 * Base controller for the demo app.
 *
 * Provides typed accessors for the owner component and state model,
 * eliminating repeated `as Component` / `as JSONModel` casts in every controller.
 *
 * @name demo.hotkeys.controller.BaseController
 */
export default class BaseController extends Controller {
  getTypedComponent(): Component {
    return this.getOwnerComponent() as Component;
  }

  getStateModel(): JSONModel {
    return this.getTypedComponent().getModel("state") as JSONModel;
  }
}
