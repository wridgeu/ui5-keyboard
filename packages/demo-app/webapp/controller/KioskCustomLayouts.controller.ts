import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import { Scope } from "../constants";
import BaseController from "./BaseController";

const LAYOUT_DESCRIPTIONS: Record<string, string> = {
  emoji:
    "3 rows of emojis (Unicode) + bottom row with Space, Backspace, and Done. Demonstrates Unicode character values.",
  "ip-address": "3x3 digit grid + dot/0/backspace row + full-width Enter. Minimal pad for IP address entry.",
  currency:
    "4x4 grid with digits and currency symbols ($, EUR, GBP, JPY). Shows label overrides and modifier key type.",
  "arabic-digits":
    'Arabic-Indic digits shipped as their own element, <demo:ArabicDigitsCustomLayout>, rather than as bare rows. The declared keycapLang="ar" is emitted on each keycap label, so a screen reader announces them with Arabic pronunciation rules instead of the UI language.',
  "icon-label":
    "Icon + label rendering modes: SAP icons, Unicode/emoji icons, icon-only, built-in special keys with dual rendering, and capsLock overrides. Double-tap Shift on row 3 to see capsLockLabel/capsLockIcon.",
};

/**
 * Custom layouts gallery - five layouts declared as `<kiosk:CustomLayout>` child
 * elements in the view, switchable via buttons. The controller selects among them;
 * it never configures them.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskCustomLayouts extends BaseController {
  private _initialLayoutApplied = false;

  /**
   * The gallery's rows arrive through a `layouts>` model binding, and a control is
   * constructed before it joins the view, so those rows do not exist yet in `onInit`.
   * The opening selection therefore waits for the first render, by which point the
   * model has propagated and every custom layout resolves.
   */
  override onAfterRendering(): void {
    if (this._initialLayoutApplied) return;
    this._initialLayoutApplied = true;
    this._switchLayout("emoji");
    this._switchVariantLayout("qwerty");
  }

  onKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this.getStateModel().setProperty("/customLastKey", this.formatKeyPress(event));
  }

  onUseEmoji(): void {
    this._switchLayout("emoji");
  }

  onUseIpAddress(): void {
    this._switchLayout("ip-address");
  }

  onUseCurrency(): void {
    this._switchLayout("currency");
  }

  onUseIconLabel(): void {
    this._switchLayout("icon-label");
  }

  onUseArabicDigits(): void {
    this._switchLayout("arabic-digits");
  }

  onUseVariantQwerty(): void {
    this._switchVariantLayout("qwerty");
  }

  onUseVariantQwertz(): void {
    this._switchVariantLayout("qwertz-de");
  }

  onNavBack(): void {
    this.getRouter().navTo(Scope.KioskHub);
  }

  private _switchVariantLayout(name: string): void {
    (this.byId("variantKeyboard") as KioskKeyboard).setLayout(name);
    this.getStateModel().setProperty("/variantLayout", name);
  }

  private _switchLayout(name: string): void {
    const kb = this.byId("customKeyboard") as KioskKeyboard;
    kb.resetKeyboardType();
    kb.setLayout(name);

    const stateModel = this.getStateModel();
    stateModel.setProperty("/customActiveLayout", name);
    stateModel.setProperty("/customLastKey", "None");
    stateModel.setProperty("/customDescription", LAYOUT_DESCRIPTIONS[name] ?? "");
  }
}
