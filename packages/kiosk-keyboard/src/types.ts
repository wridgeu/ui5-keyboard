/**
 * Valid width values for keys.
 *
 * - Numeric values (`"1.25"`, `"1.5"`, etc.) set proportional flex-grow.
 *   A key with `"2"` is twice as wide as a standard key.
 * - `"space"` gives the spacebar extra-wide flex (6x).
 * - `undefined` (default) gives a standard 1x flex-grow.
 *
 * Each numeric value maps to a CSS class (e.g. `"1.5"` → `.ui5KioskKey--w15`).
 *
 * @public
 * @since 0.1.0
 */
export type KeyWidth = "1.25" | "1.5" | "1.75" | "2" | "2.25" | "2.75" | "space";

/**
 * Key type determines the visual styling of the key.
 *
 * - `"default"` - Standard key (letter, number, symbol). Uses `@sapUiButton*` tokens.
 * - `"modifier"` - Subdued style for Shift, layout switches (ABC, Fn), etc. Uses `@sapUiButtonLite*` tokens.
 * - `"action"` - Prominent style for Enter, Backspace, etc. Uses `@sapUiButtonEmphasized*` tokens.
 * - `"space"` - Spacebar. Visually same as default but semantically distinct.
 *
 * @public
 * @since 0.1.0
 */
export type KeyType = "default" | "modifier" | "action" | "space";

/**
 * Special action values that trigger built-in behavior instead of
 * inserting text. Use these as the `value` property of a {@link KeyDefinition}.
 *
 * | Value                  | Behavior                                      |
 * | ---------------------- | --------------------------------------------- |
 * | `{backspace}`          | Deletes the character before the cursor        |
 * | `{enter}`              | Inserts newline (TextArea) or fires change     |
 * | `{shift}`              | Toggles Shift / Caps Lock state                |
 * | `{layout:<name>}`      | Switches to the named layout (e.g. `numeric`)  |
 * | `{layout:base}`        | Returns to the base (alphabetic) layout        |
 * | `{fkey:<name>}`        | Fires keyPress with key name, no text insertion |
 *
 * Any other string is treated as a literal character to insert.
 *
 * @public
 * @since 0.1.0
 */
export type SpecialKeyValue = "{backspace}" | "{enter}" | "{shift}" | `{layout:${string}}` | `{fkey:${string}}`;

/**
 * Describes a single key on the keyboard.
 *
 * @example Character key
 * ```ts
 * { value: "a" }
 * ```
 *
 * @example Character key with shift variant
 * ```ts
 * { value: "1", shiftLabel: "!", shiftValue: "!" }
 * ```
 *
 * @example Action key with icon and label
 * ```ts
 * {
 *   value: "{backspace}",
 *   icon: "sap-icon://arrow-left",
 *   width: "2",
 *   type: "action",
 * }
 * ```
 *
 * @example Icon-only key (label suppressed)
 * ```ts
 * {
 *   value: "{backspace}",
 *   label: "",
 *   icon: "sap-icon://arrow-left",
 *   width: "2",
 *   type: "action",
 * }
 * ```
 *
 * @example Unicode icon with text label
 * ```ts
 * {
 *   value: "{shift}",
 *   icon: "\u21E7",
 *   label: "Shift",
 *   width: "2.25",
 *   type: "modifier",
 * }
 * ```
 *
 * @example Layout switch key
 * ```ts
 * {
 *   value: "{layout:numeric}",
 *   label: "123",
 *   width: "1.5",
 *   type: "modifier",
 * }
 * ```
 *
 * @public
 * @since 0.1.0
 */
export interface KeyDefinition {
  /**
   * The character or action this key produces.
   *
   * For regular characters, use the lowercase letter or symbol (e.g. `"a"`, `"1"`, `","`).
   * For special actions, use a `{action}` syntax - see {@link SpecialKeyValue}.
   */
  value: string;

  /**
   * Display label shown on the key face.
   *
   * - **Omitted**: the renderer resolves the label automatically. For
   *   special keys (`{shift}`, `{enter}`, `{backspace}`, `" "`), the
   *   label comes from the i18n bundle (e.g. "Shift", "Backspace",
   *   "Space"). For regular keys, defaults to `value`.
   * - **Set to a string**: that string is used as-is.
   * - **Set to `""`**: the label is suppressed (icon-only display).
   *
   * When an icon is also present (via `icon` property or built-in),
   * both icon and label render together (inline by default, customizable
   * via `--ui5KioskKeyboard-dualDirection`).
   *
   * On `{shift}` keys, this label is replaced during Caps Lock state
   * by {@link capsLockLabel} (or the i18n fallback "Caps Lock").
   */
  label?: string;

  /**
   * Label to show when Shift is active.
   *
   * For single-character keys without `shiftLabel`, the renderer
   * automatically uppercases the display. Use `shiftLabel` only when
   * the shifted symbol is different from the uppercase (e.g. `"!"` for `"1"`).
   */
  shiftLabel?: string;

  /**
   * Label to show on the `{shift}` key when Caps Lock is active.
   * Overrides {@link label} when Caps Lock is active.
   *
   * When omitted, the renderer uses the i18n text for `ARIA_CAPS_LOCK`
   * (default: "Caps Lock"). Set this to customize the Caps Lock label
   * per layout (e.g. localized or abbreviated text).
   * Only meaningful on keys with `value: "{shift}"`.
   */
  capsLockLabel?: string;

  /**
   * Icon to show on the `{shift}` key when Caps Lock is active.
   * Evaluated independently of {@link icon} -- setting `icon` to `""`
   * does not suppress `capsLockIcon`.
   *
   * Accepts the same values as `icon` (SAP icon URI or Unicode/emoji).
   * When omitted, defaults to `sap-icon://locked`.
   * Only meaningful on keys with `value: "{shift}"`.
   *
   * @example "sap-icon://locked"
   * @example "\uD83D\uDD12"
   */
  capsLockIcon?: string;

  /**
   * Value to produce when Shift is active.
   *
   * Defaults to `value.toUpperCase()` for single-character keys.
   * Set this for keys whose shifted output differs from simple uppercasing
   * (e.g. `"1"` → `"!"`).
   *
   * This value is also stored as `data-shift-value` in the DOM, enabling
   * physical-keyboard highlight to find the matching key.
   */
  shiftValue?: string;

  /**
   * Proportional width of the key.
   *
   * Controls the key's flex-grow factor relative to standard keys.
   * A key with `"2"` is twice as wide. `"space"` gives the spacebar 6x width.
   * Omit for standard (1x) width.
   *
   * Available values: `"1.25"`, `"1.5"`, `"1.75"`, `"2"`, `"2.25"`, `"2.75"`, `"space"`.
   *
   * @see {@link KeyWidth}
   */
  width?: KeyWidth;

  /**
   * Visual style category.
   *
   * - `"modifier"` - Subdued (Shift, layout switches). Uses SAP Lite Button tokens.
   * - `"action"` - Prominent (Enter, Backspace). Uses SAP Emphasized Button tokens.
   * - `"space"` - Spacebar. Visually like default.
   * - `"default"` or omitted - Standard key. Uses SAP Button tokens.
   *
   * @see {@link KeyType}
   */
  type?: KeyType;

  /**
   * Icon displayed on the key face.
   *
   * Accepts two value types:
   * - **SAP icon URI** (e.g. `"sap-icon://accept"`) - rendered via the
   *   platform icon component
   * - **Unicode character or emoji** (e.g. `"\u21E7"`, `"\u23CE"`, `"\uD83D\uDD0D"`) -
   *   rendered as a text span styled at icon font size
   *
   * When both `icon` and a non-empty `label` are present, both render
   * together (inline by default, customizable via
   * `--ui5KioskKeyboard-dualDirection`). Set `label` to `""` for
   * icon-only display.
   *
   * The following special keys render built-in icons by default (no need
   * to set this property):
   * - `{shift}` - `sap-icon://arrow-top` (Caps Lock uses `sap-icon://locked`)
   * - `{enter}` - `sap-icon://accept`
   * - `{backspace}` - `sap-icon://arrow-left`
   *
   * Set to `""` (empty string) to suppress a built-in icon.
   *
   * @example "sap-icon://arrow-left"
   * @example "\u23CE"
   */
  icon?: string;
}

/**
 * A single row of keys on the keyboard.
 *
 * Keys in a row share the available width proportionally based on their
 * `width` property (flex-grow). Rows are rendered as flex containers with
 * `justify-content: center`.
 *
 * @public
 * @since 0.1.0
 */
export type KeyRow = KeyDefinition[];

/**
 * Complete layout definition - an ordered array of rows.
 *
 * Each entry is a row of keys rendered top-to-bottom. Pass values of this
 * type through the `instanceLayouts` setting to expose custom layouts to
 * a single keyboard instance.
 *
 * **Accessibility:** Keys with visible text labels get their accessible name
 * from the visible text. For icon-only keys (where `label` is `""`), the
 * renderer sets an `aria-label` using i18n translations for built-in special
 * keys (`{backspace}`, `{enter}`, `{shift}`, `" "`). For custom icon-only
 * keys with non-standard values, ensure the `value` is human-readable
 * (e.g. `"Delete"` rather than `"del"`) since it will be used as the
 * accessible name.
 *
 * @example Minimal custom layout
 * ```ts
 * import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
 * import type { LayoutDefinition } from "ui5/kiosk/types";
 *
 * const pinpad: LayoutDefinition = [
 *   [{ value: "1" }, { value: "2" }, { value: "3" }],
 *   [{ value: "4" }, { value: "5" }, { value: "6" }],
 *   [{ value: "7" }, { value: "8" }, { value: "9" }],
 *   [
 *     { value: "{backspace}", label: "", type: "action" },
 *     { value: "0" },
 *     { value: "{enter}", label: "OK", type: "action" },
 *   ],
 * ];
 *
 * new KioskKeyboard({ layout: "pinpad", instanceLayouts: { pinpad } });
 * ```
 *
 * Or in XML, after assigning `instanceLayouts` on the controller:
 * `<kiosk:KioskKeyboard layout="pinpad" instanceLayouts="{/customLayouts}" />`
 *
 * @public
 * @since 0.1.0
 */
export type LayoutDefinition = KeyRow[];

// -- i18n resolver type --

/**
 * Resolver callback for programmatic i18n overrides.
 *
 * Called for every `getText()` resolution when a resolver is registered.
 * Receives the message key, current locale (BCP-47 tag), and the text
 * resolved from the base library bundle.
 *
 * Return a string to override the resolved text. Return `undefined` to
 * keep the base bundle text. The resolver must be synchronous.
 *
 * If the resolver throws, the error is logged and the base text is used.
 *
 * @example
 * ```ts
 * KioskKeyboard.setI18nResolver((key, locale, resolvedText) => {
 *   if (key === "KEY_SHIFT" && locale.startsWith("fr")) return "Maj";
 *   return undefined; // keep base bundle text
 * });
 * ```
 *
 * @public
 * @since 0.2.0
 */
export type I18nResolver = (key: string, locale: string, resolvedText: string) => string | undefined;

// ── Composition middleware types ──────────────────

/**
 * Composition middleware intercepts key events for layouts that need
 * script-specific processing (e.g., kana dakuten, Hangul jamo composition).
 *
 * @public
 * @since 0.1.0
 */
export interface CompositionMiddleware {
  /** Process a key event. Returns true if consumed (keyboard skips default handling). */
  handleKey(key: string, target: HTMLInputElement | HTMLTextAreaElement): boolean;

  /** Force-commit any in-progress composition. Returns committed text or null. */
  commit(): string | null;

  /** Clear all composition state without committing. */
  reset(): void;
}
