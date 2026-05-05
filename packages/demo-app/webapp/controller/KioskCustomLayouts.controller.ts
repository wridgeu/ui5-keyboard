import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import type { LayoutDefinition } from "ui5/kiosk/types";
import { Scope } from "../constants";
import BaseController from "./BaseController";

const EMOJI_LAYOUT: LayoutDefinition = [
  [
    { value: "\u{1F600}" },
    { value: "\u{1F60D}" },
    { value: "\u{1F923}" },
    { value: "\u{1F44D}" },
    { value: "\u{1F389}" },
    { value: "\u{2764}\u{FE0F}", label: "\u{2764}\u{FE0F}" },
    { value: "\u{1F525}" },
    { value: "\u{2B50}" },
  ],
  [
    { value: "\u{1F60E}" },
    { value: "\u{1F622}" },
    { value: "\u{1F914}" },
    { value: "\u{1F4AA}" },
    { value: "\u{1F3C6}" },
    { value: "\u{1F308}" },
    { value: "\u{1F680}" },
    { value: "\u{1F436}" },
  ],
  [
    { value: "\u{1F60A}" },
    { value: "\u{1F609}" },
    { value: "\u{1F44B}" },
    { value: "\u{1F64F}" },
    { value: "\u{1F381}" },
    { value: "\u{2705}" },
    { value: "\u{1F3B5}" },
    { value: "\u{1F431}" },
  ],
  [
    { value: " ", width: "2", type: "space" },
    { value: "{backspace}", width: "2", type: "action" },
    { value: "{enter}", label: "Done", width: "2", type: "action" },
  ],
];

const IP_ADDRESS_LAYOUT: LayoutDefinition = [
  [{ value: "1" }, { value: "2" }, { value: "3" }],
  [{ value: "4" }, { value: "5" }, { value: "6" }],
  [{ value: "7" }, { value: "8" }, { value: "9" }],
  [{ value: ".", label: ".", type: "modifier" }, { value: "0" }, { value: "{backspace}", type: "action" }],
  [{ value: "{enter}", label: "Enter", width: "2", type: "action" }],
];

const CURRENCY_LAYOUT: LayoutDefinition = [
  [{ value: "1" }, { value: "2" }, { value: "3" }, { value: "$", type: "modifier" }],
  [{ value: "4" }, { value: "5" }, { value: "6" }, { value: "\u20AC", label: "EUR", type: "modifier" }],
  [{ value: "7" }, { value: "8" }, { value: "9" }, { value: "\u00A3", label: "GBP", type: "modifier" }],
  [{ value: "." }, { value: "0" }, { value: "," }, { value: "\u00A5", label: "JPY", type: "modifier" }],
  [
    { value: " ", width: "space", type: "space" },
    { value: "{backspace}", width: "1.5", type: "action" },
    { value: "{enter}", label: "Enter", width: "1.5", type: "action" },
  ],
];

const ICON_LABEL_LAYOUT: LayoutDefinition = [
  [
    { value: "home", icon: "sap-icon://home", label: "Home" },
    { value: "settings", icon: "sap-icon://settings", label: "Settings" },
    { value: "delete", icon: "sap-icon://delete", label: "" },
    { value: "search", icon: "\u{1F50D}", label: "Search" },
    { value: "globe", icon: "\u{1F310}", label: "Lang" },
  ],
  [
    { value: "{shift}", type: "modifier", width: "2.25" },
    { value: "{enter}", type: "action", width: "2.25" },
    { value: "{backspace}", type: "action", width: "2" },
    { value: " ", type: "space", width: "space" },
  ],
  [
    {
      value: "{shift}",
      type: "modifier",
      width: "2.25",
      label: "Custom Shift",
      capsLockLabel: "LOCKED",
      capsLockIcon: "\u{1F512}",
    },
    { value: "a" },
    { value: "b" },
    { value: "c" },
  ],
];

const LAYOUT_DESCRIPTIONS: Record<string, string> = {
  emoji:
    "3 rows of emojis (Unicode) + bottom row with Space, Backspace, and Done. Demonstrates Unicode character values.",
  "ip-address": "3x3 digit grid + dot/0/backspace row + full-width Enter. Minimal pad for IP address entry.",
  currency:
    "4x4 grid with digits and currency symbols ($, EUR, GBP, JPY). Shows label overrides and modifier key type.",
  "icon-label":
    "Icon + label rendering modes: SAP icons, Unicode/emoji icons, icon-only, built-in special keys with dual rendering, and capsLock overrides. Double-tap Shift on row 3 to see capsLockLabel/capsLockIcon.",
};

const CUSTOM_LAYOUTS: Record<string, LayoutDefinition> = {
  emoji: EMOJI_LAYOUT,
  "ip-address": IP_ADDRESS_LAYOUT,
  currency: CURRENCY_LAYOUT,
  "icon-label": ICON_LABEL_LAYOUT,
};

/**
 * Custom layouts gallery - four LayoutDefinitions attached to the keyboard
 * control via the per-instance `instanceLayouts` property, switchable via
 * buttons.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskCustomLayouts extends BaseController {
  onInit(): void {
    const kb = this.byId("customKeyboard") as KioskKeyboard;
    kb.setInstanceLayouts(CUSTOM_LAYOUTS);

    this._switchLayout("emoji");
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

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
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
