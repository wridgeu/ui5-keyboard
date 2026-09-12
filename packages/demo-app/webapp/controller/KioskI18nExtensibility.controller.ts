import JSONModel from "sap/ui/model/json/JSONModel";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { Route$PatternMatchedEvent } from "sap/ui/core/routing/Route";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import type { SegmentedButton$SelectionChangeEvent } from "sap/m/SegmentedButton";
import { Scope } from "../constants";
import BaseController from "./BaseController";

const MODE_DESCRIPTIONS = {
  default:
    "Built-in English texts (no customization). Special keys show an icon plus their text, and that visible text is the accessible name.",
  french:
    "French texts applied via setI18nResolver(). Shift -> Maj, Enter -> Entr\u00e9e, Space -> Espace, each visible on its keycap.",
  override:
    'Partial English overrides via resolver. Enter -> "Go", Backspace -> "Delete", keyboard aria-label -> "Touch Keyboard".',
  hook: 'Programmatic resolver. Uppercases special-key texts (SHIFT, ENTER, etc.) and sets the keyboard aria-label to "Custom Keyboard".',
} satisfies Record<string, string>;

const FRENCH_TEXTS = {
  KIOSK_KEYBOARD_LABEL: "Clavier virtuel",
  KIOSK_KEYBOARD_ROLEDESCRIPTION: "clavier",
  KEY_SHIFT: "Maj",
  KEY_ENTER: "Entr\u00e9e",
  KEY_BACKSPACE: "Retour",
  KEY_SPACE: "Espace",
  ARIA_CAPS_LOCK: "Verrouillage majuscule",
  ARIA_CAPS_LOCK_ON: "Verrouillage majuscule activ\u00e9",
  ARIA_CAPS_LOCK_OFF: "Verrouillage majuscule d\u00e9sactiv\u00e9",
  ARIA_SHIFT_ON: "Majuscule activ\u00e9e",
  ARIA_SHIFT_OFF: "Majuscule d\u00e9sactiv\u00e9e",
  ARIA_KEYBOARD_OPENED: "Clavier virtuel ouvert",
  ARIA_KEYBOARD_CLOSED: "Clavier virtuel ferm\u00e9",
} satisfies Record<string, string>;

const OVERRIDE_TEXTS = {
  KIOSK_KEYBOARD_LABEL: "Touch Keyboard",
  KEY_ENTER: "Go",
  KEY_BACKSPACE: "Delete",
} satisfies Record<string, string>;

/** Narrows an incoming key to one the given table actually declares. */
function declares<Table extends object>(table: Table, key: string): key is string & keyof Table {
  return key in table;
}

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
  private _inspectorDelegate: { onAfterRendering: () => void; canSkipRendering: true } | null = null;

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
      // The keyboard's renderer is apiVersion 4. A delegate carrying a rendering
      // hook forfeits the skip-rendering optimization unless it declares that it
      // reads nothing outside the control's own output, which this one does not.
      canSkipRendering: true,
    };
    this.byId("i18nKeyboard")!.addEventDelegate(this._inspectorDelegate, this);

    const router = this.getRouter();
    router.getRoute(Scope.KioskI18nExtensibility)?.attachPatternMatched(this._onPatternMatched, this);
    router.attachRouteMatched(this._onRouteMatched, this);
  }

  override onExit(): void {
    const router = this.getRouter();
    router.getRoute(Scope.KioskI18nExtensibility)?.detachPatternMatched(this._onPatternMatched, this);
    router.detachRouteMatched(this._onRouteMatched, this);
    if (this._inspectorDelegate) {
      this.byId("i18nKeyboard")?.removeEventDelegate(this._inspectorDelegate);
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

    const description = declares(MODE_DESCRIPTIONS, key) ? MODE_DESCRIPTIONS[key] : "";
    this._getViewModel().setData({ activeMode: key, modeDescription: description }, true);
  }

  onNavBack(): void {
    this._resetI18n();
    this.getRouter().navTo(Scope.KioskHub);
  }

  // i18n mode helpers

  private _resetI18n(): void {
    KioskKeyboard.setI18nResolver(null);
  }

  private _applyFrench(): void {
    KioskKeyboard.setI18nResolver((key) => (declares(FRENCH_TEXTS, key) ? FRENCH_TEXTS[key] : undefined));
  }

  private _applyOverrides(): void {
    KioskKeyboard.setI18nResolver((key) => (declares(OVERRIDE_TEXTS, key) ? OVERRIDE_TEXTS[key] : undefined));
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

  // ARIA Inspector

  private _updateAriaInspector(): void {
    const dom = this.byId("i18nKeyboard")?.getDomRef();
    if (!dom) return;

    const readKeyLabel = (dataKey: string): string => {
      const el = dom.querySelector(`[data-key="${CSS.escape(dataKey)}"]`);
      // Keys with visible text carry no aria-label (WCAG 2.5.3); only icon-only keys do.
      return el?.querySelector(".ui5KioskKey__label")?.textContent?.trim() || el?.getAttribute("aria-label") || "?";
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

  // Route lifecycle

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
    // SAFETY: `onInit` set a JSONModel under `_MODEL_NAME` on this view, and nothing
    // replaces it, so the model this reads back is that JSONModel.
    return this.getView()!.getModel(KioskI18nExtensibility._MODEL_NAME) as JSONModel;
  }
}
