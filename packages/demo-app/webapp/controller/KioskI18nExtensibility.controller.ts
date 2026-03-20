import JSONModel from "sap/ui/model/json/JSONModel";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import type { SegmentedButton$SelectionChangeEvent } from "sap/m/SegmentedButton";
import { Scope } from "../constants";
import BaseController from "./BaseController";

const MODE_DESCRIPTIONS: Record<string, string> = {
  default:
    "Built-in English aria-labels (no customization). Special keys show icons; their text is only exposed to screen readers.",
  french:
    "French aria-labels loaded via configureI18n() with a bundleName. Shift -> Maj, Enter -> Entr\u00e9e, Space -> Espace (visible on key).",
  override:
    'Partial English overrides via enhancement bundle. Enter -> "Go", Backspace -> "Delete", keyboard aria-label -> "Touch Keyboard".',
  hook: 'Programmatic override hook. Uppercases special-key aria-labels (SHIFT, ENTER, etc.) and sets the keyboard aria-label to "Custom Keyboard".',
};

/**
 * i18n extensibility demo - shows all three customization vectors:
 * 1. New language via enhancement bundle (French)
 * 2. Overriding existing labels via enhancement bundle
 * 3. Programmatic override hook
 *
 * Includes an ARIA Label Inspector that reads resolved labels from
 * the keyboard DOM after each mode change.
 *
 * @name demo.hotkeys.controller.KioskI18nExtensibility
 */
export default class KioskI18nExtensibility extends BaseController {
  private static readonly _MODEL_NAME = "i18nDemo";
  private _inspectorDelegate: object | null = null;

  onInit(): void {
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

    this.getTypedComponent().getRouter().attachRouteMatched(this._onRouteMatched, this);
  }

  onExit(): void {
    this.getTypedComponent().getRouter().detachRouteMatched(this._onRouteMatched, this);
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

  // ── ARIA Inspector ─────────────────────────────

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

  // ── Route lifecycle ────────────────────────────

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    const routeName = event.getParameter("name");
    if (routeName !== Scope.KioskI18nExtensibility) {
      this._resetI18n();
      this._getViewModel().setData({ activeMode: "default", modeDescription: MODE_DESCRIPTIONS["default"] }, true);
    }
  }

  private _getViewModel(): JSONModel {
    return this.getView()!.getModel(KioskI18nExtensibility._MODEL_NAME) as JSONModel;
  }
}
