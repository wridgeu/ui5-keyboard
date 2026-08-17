import UIComponent from "sap/ui/core/UIComponent";
import Log from "sap/base/Log";
import JSONModel from "sap/ui/model/json/JSONModel";
import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import type RegistrationGroup from "ui5/hotkeys/RegistrationGroup";
import {
  EMOJI_LAYOUT,
  IP_ADDRESS_LAYOUT,
  CURRENCY_LAYOUT,
  ICON_LABEL_LAYOUT,
  HOUSE_ACCENTS,
  POLISH_ACCENTS,
} from "./layouts/custom-layouts";

/**
 * @name demo.hotkeys.Component
 */
export default class Component extends UIComponent {
  public static metadata = {
    manifest: "json",
    interfaces: ["sap.ui.core.IAsyncContentCreation"],
  };

  private _hotkeyManager!: HotkeyManager;
  private _hotkeys!: RegistrationGroup;
  private _routeMatchedHandler!: () => void;

  override init(): void {
    super.init();

    // The layouts the Custom Layouts gallery declares in XML. A model is what lets
    // `<kiosk:CustomLayout rows="{layouts>/emoji}">` carry rows without a controller.
    this.setModel(
      new JSONModel({
        emoji: EMOJI_LAYOUT,
        ipAddress: IP_ADDRESS_LAYOUT,
        currency: CURRENCY_LAYOUT,
        iconLabel: ICON_LABEL_LAYOUT,
        houseAccents: HOUSE_ACCENTS,
        polishAccents: POLISH_ACCENTS,
      }),
      "layouts",
    );

    this._hotkeyManager = new HotkeyManager();
    this._hotkeys = this._hotkeyManager.createGroup();

    // Enable automatic scope management via the router on the group.
    // Route name = scope name. Controllers just register with { scope: "routeName" }.
    // destroyAll() automatically detaches the router listener.
    this._hotkeys.enableRouterIntegration(this.getRouter());

    // Keep the state model's activeScope in sync with route changes.
    // enableRouterIntegration handles scope push/pop; this listener mirrors it to the model.
    // SAFETY: manifest.json declares the "state" model with type sap.ui.model.json.JSONModel,
    // and UIComponent has instantiated the manifest models before init() runs.
    const stateModel = this.getModel("state") as JSONModel;

    this._routeMatchedHandler = () => {
      stateModel.setProperty("/activeScope", this._hotkeyManager.getActiveScope());
    };
    this.getRouter().attachRouteMatched(this._routeMatchedHandler, this);

    // Re-apply the live active scope once the JSONModel fixture finishes async
    // loading, since the fixture would otherwise overwrite /activeScope.
    void stateModel
      .dataLoaded()
      .then(() => {
        if (this.isDestroyed()) return;
        this._routeMatchedHandler();
      })
      // Annotated because `Promise.catch` declares its reason `any`; the `instanceof Error` check
      // below is the parse.
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

    // Keep the browser tab / accessibility-tree document title in sync with the
    // active route, so history navigation announces a page change.
    this.getRouter().attachTitleChanged((event) => {
      // SAFETY: the parameter is optional on the event, but every routing target in manifest.json
      // declares a title and the router only fires titleChanged for a target that has one.
      document.title = event.getParameter("title") as string;
    });

    this.getRouter().initialize();
  }

  /**
   * Get the shared HotkeyManager instance.
   */
  getHotkeyManager(): HotkeyManager {
    return this._hotkeyManager;
  }

  override exit(): void {
    // The router (and the routeMatched listener attached in init) is destroyed
    // by UIComponent before exit() runs, so no manual detach is needed here.
    this._hotkeyManager.destroy();
  }
}
