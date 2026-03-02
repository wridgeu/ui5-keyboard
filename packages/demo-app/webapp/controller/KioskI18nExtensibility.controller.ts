import JSONModel from "sap/ui/model/json/JSONModel";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import type { SegmentedButton$SelectionChangeEvent } from "sap/m/SegmentedButton";
import { Scope } from "../constants";
import BaseController from "./BaseController";

const MODE_DESCRIPTIONS: Record<string, string> = {
  default:
    "Built-in English aria-labels (no customization). Special keys show icons; their text is only exposed to screen readers.",
  french:
    "French aria-labels loaded via configureI18n() with a bundleName. Shift → Maj, Enter → Entrée, Space → Espace (visible on key).",
  override:
    'Partial English overrides via enhancement bundle. Enter → "Go", Backspace → "Delete", keyboard aria-label → "Touch Keyboard".',
  hook: 'Programmatic override hook. Uppercases special-key aria-labels (SHIFT, ENTER, etc.) and sets the keyboard aria-label to "Custom Keyboard".',
};

/**
 * i18n extensibility demo — shows all three customization vectors:
 * 1. New language via enhancement bundle (French)
 * 2. Overriding existing labels via enhancement bundle
 * 3. Programmatic override hook
 *
 * @name demo.hotkeys.controller.KioskI18nExtensibility
 */
export default class KioskI18nExtensibility extends BaseController {
  private static readonly _MODEL_NAME = "i18nDemo";

  onInit(): void {
    this.getView()!.setModel(
      new JSONModel({
        activeMode: "default",
        modeDescription: MODE_DESCRIPTIONS["default"],
        lastKey: "None",
      }),
      KioskI18nExtensibility._MODEL_NAME,
    );

    this.getTypedComponent().getRouter().attachRouteMatched(this._onRouteMatched, this);
  }

  onExit(): void {
    this.getTypedComponent().getRouter().detachRouteMatched(this._onRouteMatched, this);
    this._setKeyboardRouteActive(false);
  }

  onKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this._getViewModel().setProperty("/lastKey", this.formatKeyPress(event));
  }

  onModeChange(event: SegmentedButton$SelectionChangeEvent): void {
    const key = event.getParameter("item")!.getKey();

    switch (key) {
      case "french":
        this._applyFrench();
        break;
      case "override":
        this._applyOverrides();
        break;
      case "hook":
        this._applyHook();
        break;
      default:
        this._resetI18n();
        break;
    }

    const vm = this._getViewModel();
    vm.setProperty("/activeMode", key);
    vm.setProperty("/modeDescription", MODE_DESCRIPTIONS[key] ?? "");
  }

  onNavBack(): void {
    this._resetI18n();
    this._setKeyboardRouteActive(false);
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  // ── i18n mode helpers ──────────────────────────

  private _resetI18n(): void {
    KioskKeyboard.resetI18nConfiguration();
    KioskKeyboard.clearI18nOverrideHook();
  }

  private _applyFrench(): void {
    this._resetI18n();
    void KioskKeyboard.configureI18n({
      enhanceWith: [
        {
          bundleName: "demo.hotkeys.i18n-kiosk.messagebundle_fr",
          supportedLocales: [""],
          fallbackLocale: "",
        },
      ],
    });
  }

  private _applyOverrides(): void {
    this._resetI18n();
    void KioskKeyboard.configureI18n({
      enhanceWith: [
        {
          bundleName: "demo.hotkeys.i18n-kiosk.messagebundle_override",
          supportedLocales: [""],
          fallbackLocale: "",
        },
      ],
    });
  }

  private _applyHook(): void {
    this._resetI18n();
    KioskKeyboard.setI18nOverrideHook((ctx) => {
      if (ctx.key === "KIOSK_KEYBOARD_LABEL") {
        return "Custom Keyboard";
      }
      if (ctx.key.startsWith("KEY_")) {
        return ctx.resolvedText.toUpperCase();
      }
      return undefined;
    });
  }

  // ── Route lifecycle ────────────────────────────

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    const routeName = event.getParameter("name");
    this._setKeyboardRouteActive(routeName === Scope.KioskI18nExtensibility);
  }

  private _setKeyboardRouteActive(active: boolean): void {
    const keyboard = this.byId("i18nKeyboard") as KioskKeyboard | undefined;
    if (!keyboard) return;

    if (active) {
      keyboard.setAutoShow(true);
      return;
    }

    this._resetI18n();
    keyboard.close();
    keyboard.setAutoShow(false);

    const vm = this._getViewModel();
    vm.setProperty("/activeMode", "default");
    vm.setProperty("/modeDescription", MODE_DESCRIPTIONS["default"]);
    vm.setProperty("/lastKey", "None");
  }

  private _getViewModel(): JSONModel {
    return this.getView()!.getModel(KioskI18nExtensibility._MODEL_NAME) as JSONModel;
  }
}
