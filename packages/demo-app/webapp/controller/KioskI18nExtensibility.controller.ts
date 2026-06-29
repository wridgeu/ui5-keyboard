import JSONModel from "sap/ui/model/json/JSONModel";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { Route$PatternMatchedEvent } from "sap/ui/core/routing/Route";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import type { SegmentedButton$SelectionChangeEvent } from "sap/m/SegmentedButton";
import { Scope } from "../constants";
import BaseController from "./BaseController";

const MODE_DESCRIPTIONS: Record<string, string> = {
  default:
    "Built-in English aria-labels (no customization). Special keys show icons; their text is only exposed to screen readers.",
  french:
    "French aria-labels applied via setI18nResolver(). Shift -> Maj, Enter -> Entr\u00e9e, Space -> Espace (visible on key).",
  override:
    'Partial English overrides via resolver. Enter -> "Go", Backspace -> "Delete", keyboard aria-label -> "Touch Keyboard".',
  hook: 'Programmatic resolver. Uppercases special-key aria-labels (SHIFT, ENTER, etc.) and sets the keyboard aria-label to "Custom Keyboard".',
};

const FRENCH_TEXTS: Record<string, string> = {
  KIOSK_KEYBOARD_LABEL: "Clavier virtuel",
  KIOSK_KEYBOARD_ROLEDESCRIPTION: "clavier",
  KEY_SHIFT: "Maj",
  KEY_ENTER: "Entr\u00e9e",
  KEY_BACKSPACE: "Retour",
  KEY_SPACE: "Espace",
  ARIA_CAPS_LOCK: "Verrouillage majuscule",
  ARIA_CAPS_LOCK_ON: "Verrouillage majuscule activ\u00e9",
  ARIA_SHIFT_ON: "Majuscule activ\u00e9e",
  ARIA_KEYBOARD_OPENED: "Clavier virtuel ouvert",
  ARIA_KEYBOARD_CLOSED: "Clavier virtuel ferm\u00e9",
};

const OVERRIDE_TEXTS: Record<string, string> = {
  KIOSK_KEYBOARD_LABEL: "Touch Keyboard",
  KEY_ENTER: "Go",
  KEY_BACKSPACE: "Delete",
};

/**
 * i18n extensibility demo - shows customization via setI18nResolver():
 * 1. New language via resolver (French)
 * 2. Overriding existing labels via resolver
 * 3. Programmatic resolver with transformation logic
 *
 * Includes an ARIA Label Inspector that reads resolved labels from
 * the keyboard DOM after each mode change.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskI18nExtensibility extends BaseController {
  private static readonly _MODEL_NAME = "i18nDemo";
  private _active = false;
  private _inspectorDelegate: { onAfterRendering: () => void } | null = null;

  override onInit(): void {
    this.getView()!.setModel(
      new JSONModel({
        activeMode: "default",
        modeDescription: MODE_DESCRIPTIONS["default"],
        inspector: {
          keyboardLabel: "...",
          roleDescription: "...",
          shiftKey: "...",
          enterKey: "...",
          backspaceKey: "...",
          spaceKey: "...",
        },
      }),
      KioskI18nExtensibility._MODEL_NAME,
    );

    this._inspectorDelegate = {
      onAfterRendering: () => this._updateAriaInspector(),
    };
    (this.byId("i18nKeyboard") as KioskKeyboard).addEventDelegate(this._inspectorDelegate, this);

    const router = this.getRouter();
    router.getRoute(Scope.KioskI18nExtensibility)?.attachPatternMatched(this._onPatternMatched, this);
    router.attachRouteMatched(this._onRouteMatched, this);
  }

  override onExit(): void {
    const router = this.getRouter();
    router.getRoute(Scope.KioskI18nExtensibility)?.detachPatternMatched(this._onPatternMatched, this);
    router.detachRouteMatched(this._onRouteMatched, this);
    if (this._inspectorDelegate) {
      (this.byId("i18nKeyboard") as KioskKeyboard | undefined)?.removeEventDelegate(this._inspectorDelegate);
    }
    this._resetI18n();
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

    this._getViewModel().setData({ activeMode: key, modeDescription: MODE_DESCRIPTIONS[key] ?? "" }, true);
  }

  onNavBack(): void {
    this._resetI18n();
    this.getRouter().navTo(Scope.KioskHub);
  }

  // -- i18n mode helpers --

  private _resetI18n(): void {
    KioskKeyboard.setI18nResolver(null);
  }

  private _applyFrench(): void {
    KioskKeyboard.setI18nResolver((key) => FRENCH_TEXTS[key]);
  }

  private _applyOverrides(): void {
    KioskKeyboard.setI18nResolver((key) => OVERRIDE_TEXTS[key]);
  }

  private _applyHook(): void {
    KioskKeyboard.setI18nResolver((key, _locale, resolvedText) => {
      if (key === "KIOSK_KEYBOARD_LABEL") {
        return "Custom Keyboard";
      }
      if (key.startsWith("KEY_")) {
        return resolvedText.toUpperCase();
      }
      return undefined;
    });
  }

  // -- ARIA Inspector --

  private _updateAriaInspector(): void {
    const keyboard = this.byId("i18nKeyboard") as KioskKeyboard | undefined;
    const dom = keyboard?.getDomRef();
    if (!dom) return;

    const readKeyLabel = (dataKey: string): string => {
      const el = dom.querySelector(`[data-key="${CSS.escape(dataKey)}"]`);
      return el?.getAttribute("aria-label") ?? "?";
    };

    this._getViewModel().setData(
      {
        inspector: {
          keyboardLabel: dom.getAttribute("aria-label") ?? "?",
          roleDescription: dom.getAttribute("aria-roledescription") ?? "?",
          shiftKey: readKeyLabel("{shift}"),
          enterKey: readKeyLabel("{enter}"),
          backspaceKey: readKeyLabel("{backspace}"),
          spaceKey: readKeyLabel(" "),
        },
      },
      true,
    );
  }

  // -- Route lifecycle --

  private _onPatternMatched(_event: Route$PatternMatchedEvent): void {
    this._active = true;
  }

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    if (!this._active) return;
    const routeName = event.getParameter("name");
    if (routeName !== Scope.KioskI18nExtensibility) {
      this._active = false;
      this._resetI18n();
      this._getViewModel().setData({ activeMode: "default", modeDescription: MODE_DESCRIPTIONS["default"] }, true);
    }
  }

  private _getViewModel(): JSONModel {
    return this.getView()!.getModel(KioskI18nExtensibility._MODEL_NAME) as JSONModel;
  }
}
