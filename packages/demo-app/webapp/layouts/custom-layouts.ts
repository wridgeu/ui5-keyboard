import type { LayoutDefinition } from "ui5/kiosk/types";

// The gallery's layouts, kept out of the controller so a JSONModel can feed them
// straight into the `<kiosk:CustomLayout rows="{layouts>/...}">` nodes in the view.

export const EMOJI_LAYOUT: LayoutDefinition = [
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

export const IP_ADDRESS_LAYOUT: LayoutDefinition = [
  [{ value: "1" }, { value: "2" }, { value: "3" }],
  [{ value: "4" }, { value: "5" }, { value: "6" }],
  [{ value: "7" }, { value: "8" }, { value: "9" }],
  [{ value: ".", label: ".", type: "modifier" }, { value: "0" }, { value: "{backspace}", type: "action" }],
  [{ value: "{enter}", label: "Enter", width: "2", type: "action" }],
];

export const CURRENCY_LAYOUT: LayoutDefinition = [
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

export const ICON_LABEL_LAYOUT: LayoutDefinition = [
  [
    { value: "home", icon: "sap-icon://home", label: "Home" },
    { value: "settings", icon: "sap-icon://settings", label: "Settings" },
    { value: "delete", icon: "sap-icon://delete", label: "", ariaLabel: "Delete" },
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

/**
 * Arabic-Indic digits. The keycaps are Arabic script while the surrounding UI is
 * not, so `ArabicDigitsCustomLayout` declares `keycapLang="ar"` alongside them and
 * a screen reader announces them with Arabic pronunciation rules (WCAG 2.2 SC 3.1.2).
 */
export const ARABIC_DIGITS_LAYOUT: LayoutDefinition = [
  [{ value: "١" }, { value: "٢" }, { value: "٣" }],
  [{ value: "٤" }, { value: "٥" }, { value: "٦" }],
  [{ value: "٧" }, { value: "٨" }, { value: "٩" }],
  [{ value: "٠" }, { value: "٫", label: "٫" }, { value: "{backspace}", width: "1.5", type: "action" }],
];

/**
 * A house accent set, applied under every layout through the keyboard's
 * `defaultVariants`. Letters the built-in Latin table does not cover.
 */
export const HOUSE_ACCENTS = {
  q: ["ǫ", "ɋ"],
  w: ["ŵ"],
} satisfies Record<string, string[]>;

/**
 * One layout's own accents, merged over the tiers below per base letter, so `a` takes
 * this list instead of the built-in one while every letter it omits keeps theirs.
 */
export const POLISH_ACCENTS = {
  a: ["ą"],
  s: ["ś", "š"],
} satisfies Record<string, string[]>;
