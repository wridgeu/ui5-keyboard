import UIComponent from "sap/ui/core/UIComponent";
import Log from "sap/base/Log";
import JSONModel from "sap/ui/model/json/JSONModel";
import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";
import { formatForDisplay } from "ui5/hotkeys/format";
import "demo/hotkeys/webc/register";

/**
 * @name demo.hotkeys.Component
 */
export default class Component extends UIComponent {
  public static metadata = {
    manifest: "json",
  };

  private _hotkeyManager!: HotkeyManager;
  private _hotkeys!: RegistrationGroup;
  private _routeMatchedHandler!: () => void;
  private _keyDownHandler!: (e: KeyboardEvent) => void;

  init(): void {
    super.init();

    // Initialize the HotkeyManager singleton
    this._hotkeyManager = HotkeyManager.getInstance();
    this._hotkeys = this._hotkeyManager.createGroup();

    // Enable automatic scope management via the router.
    // Route name = scope name. Controllers just register with { scope: "routeName" }.
    // No pushScope/popScope needed in controllers for view-level scopes.
    this._hotkeyManager.enableRouterIntegration(this.getRouter());

    // Keep the state model's activeScope in sync with route changes.
    // enableRouterIntegration handles scope push/pop; this listener mirrors it to the model.
    const stateModel = this.getModel("state") as JSONModel;
    const applyRuntimeState = () => {
      const platform = this._hotkeyManager.getPlatform();
      stateModel.setProperty("/platform", platform);
      stateModel.setProperty("/saveLabel", formatForDisplay("Mod+S", platform));
      stateModel.setProperty("/escapeLabel", formatForDisplay("Escape", platform));
      stateModel.setProperty("/f5Label", formatForDisplay("F5", platform));
      stateModel.setProperty("/navLabel", formatForDisplay("Mod+D", platform));
    };

    this._routeMatchedHandler = () => {
      stateModel.setProperty("/activeScope", this._hotkeyManager.getActiveScope());
    };
    this.getRouter().attachRouteMatched(this._routeMatchedHandler, this);

    // Keep runtime-derived state stable when the JSONModel URI finishes async loading.
    applyRuntimeState();
    void stateModel
      .dataLoaded()
      .then(() => {
        if (this.isDestroyed()) return;
        applyRuntimeState();
        this._routeMatchedHandler();
      })
      .catch((err: unknown) => {
        Log.warning(
          "State model fixture failed to load",
          err instanceof Error ? err : String(err),
          "demo.hotkeys.Component",
        );
      });

    // Register global shortcuts (active across all views).
    // Global scope is the default - no need to specify scope explicitly.
    this._hotkeys.register(
      "Mod+S",
      (_event, details) => {
        stateModel.setProperty("/lastAction", `Save (${details.scope})`);
      },
      {
        description: "Save",
      },
    );

    this._hotkeys.register(
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
    );

    // Track physical keyboard presses separately from kiosk virtual key events.
    this._keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === "Unidentified" || e.key === "Process") return;
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Meta");
      if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) parts.push(e.key);
      if (parts.length) stateModel.setProperty("/physicalLastKey", parts.join(" + "));
    };
    document.addEventListener("keydown", this._keyDownHandler, true);

    // Initialize the router
    this.getRouter().initialize();
  }

  /**
   * Get the shared HotkeyManager instance.
   */
  getHotkeyManager(): HotkeyManager {
    return this._hotkeyManager;
  }

  exit(): void {
    // Clean up only what this Component instance owns.
    // The HotkeyManager singleton must not be destroyed here -- in FLP,
    // modules survive Component destroy/recreate cycles.
    // Router integration is cleaned up automatically on re-entry.
    this._hotkeys.destroyAll();
    document.removeEventListener("keydown", this._keyDownHandler, true);
  }
}
