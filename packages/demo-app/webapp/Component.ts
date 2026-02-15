import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { formatForDisplay } from "ui5/hotkeys/format";
import type { HotkeyRegistrationHandle } from "ui5/hotkeys/types";

/**
 * @name demo.hotkeys.Component
 */
export default class Component extends UIComponent {
  public static metadata = {
    manifest: "json",
  };

  private _hotkeyManager!: HotkeyManager;
  private _handles!: HotkeyRegistrationHandle[];
  private _routeMatchedHandler!: () => void;

  init(): void {
    super.init();

    this._handles = [];

    // Initialize the HotkeyManager singleton
    this._hotkeyManager = HotkeyManager.getInstance();

    // Enable automatic scope management via the router.
    // Route name = scope name. Controllers just register with { scope: "routeName" }.
    // No pushScope/popScope needed in controllers for view-level scopes.
    this._hotkeyManager.enableRouterIntegration(this.getRouter());

    // Keep the state model's activeScope in sync with route changes.
    // enableRouterIntegration handles scope push/pop; this listener mirrors it to the model.
    const stateModel = this.getModel("state") as JSONModel;
    this._routeMatchedHandler = () => {
      stateModel.setProperty("/activeScope", this._hotkeyManager.getActiveScope());
    };
    this.getRouter().attachRouteMatched(this._routeMatchedHandler, this);
    const platform = this._hotkeyManager.getPlatform();
    stateModel.setProperty("/platform", platform);
    stateModel.setProperty("/saveLabel", formatForDisplay("Mod+S", platform));
    stateModel.setProperty("/escapeLabel", formatForDisplay("Escape", platform));
    stateModel.setProperty("/f5Label", formatForDisplay("F5", platform));
    stateModel.setProperty("/navLabel", formatForDisplay("Mod+D", platform));

    // Register global shortcuts (active across all views).
    // Global scope is the default — no need to specify scope explicitly.
    this._handles.push(
      this._hotkeyManager.register(
        "Mod+S",
        (_event, details) => {
          stateModel.setProperty("/lastAction", `Save (${details.scope})`);
        },
        {
          description: "Save",
        },
      ),
    );

    this._handles.push(
      this._hotkeyManager.register(
        "Escape",
        (_event) => {
          stateModel.setProperty("/lastAction", "Cancel / Close");
        },
        {
          description: "Cancel / Close",
          // Don't block UI5's native Escape handling (e.g., dialog close)
          preventDefault: false,
          stopPropagation: false,
        },
      ),
    );

    // Initialize the router
    this.getRouter().initialize();
  }

  /**
   * Get the shared HotkeyManager instance.
   */
  getHotkeyManager(): HotkeyManager {
    return this._hotkeyManager;
  }

  destroy(): void {
    this.getRouter().detachRouteMatched(this._routeMatchedHandler, this);
    this._handles.forEach((h) => h.unregister());
    this._handles = [];
    this._hotkeyManager.destroy();
    super.destroy();
  }
}
