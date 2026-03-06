/** Layouts that serve as secondary views (not base alphabetic layouts). @internal */
export const SECONDARY_LAYOUTS: ReadonlySet<string> = new Set(["numeric", "special", "fkeys", "nav"]);

/**
 * Valid width values for keys.
 *
 * - Numeric values (`"1.25"`, `"1.5"`, etc.) set proportional flex-grow.
 *   A key with `"2"` is twice as wide as a standard key.
 * - `"space"` gives the spacebar extra-wide flex (6x).
 * - `undefined` (default) gives a standard 1x flex-grow.
 *
 * Each numeric value maps to a CSS class (e.g. `"1.5"` → `.ui5KioskKey--w1-5`).
 *
 * @public
 * @since 0.1.0
 */
export type KeyWidth = "1.25" | "1.5" | "1.75" | "2" | "2.25" | "2.75" | "space";

/**
 * Key type determines the visual styling of the key.
 *
 * - `"default"` — Standard key (letter, number, symbol). Uses `@sapUiButton*` tokens.
 * - `"modifier"` — Subdued style for Shift, layout switches, etc. Uses `@sapUiButtonLite*` tokens.
 * - `"action"` — Prominent style for Enter, Backspace, etc. Uses `@sapUiButtonEmphasized*` tokens.
 * - `"space"` — Spacebar. Visually same as default but semantically distinct.
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
 * @example Action key with icon
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
   * For special actions, use a `{action}` syntax — see {@link SpecialKeyValue}.
   */
  value: string;

  /**
   * Display label shown on the key face. Defaults to `value`.
   *
   * Set to `""` (empty string) for icon-only keys.
   * The renderer will use the key's `icon` property for display and
   * fall back to a built-in aria-label for accessibility.
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
   * - `"modifier"` — Subdued (Shift, layout switches). Uses SAP Lite Button tokens.
   * - `"action"` — Prominent (Enter, Backspace). Uses SAP Emphasized Button tokens.
   * - `"space"` — Spacebar. Visually like default.
   * - `"default"` or omitted — Standard key. Uses SAP Button tokens.
   *
   * @see {@link KeyType}
   */
  type?: KeyType;

  /**
   * SAP icon URI for icon-only keys.
   *
   * When set, the key renders the icon instead of text. The icon receives
   * `aria-hidden="true"`; the key's accessibility is handled by the
   * `aria-label` attribute.
   *
   * The following special keys render built-in icons by default (no need to
   * set this property):
   * - `{shift}` — `sap-icon://arrow-top` (Caps Lock uses `sap-icon://locked`)
   * - `{enter}` — `sap-icon://accept`
   * - `{backspace}` — `sap-icon://arrow-left`
   *
   * To override a default icon, set this property to a different icon URI.
   *
   * @example "sap-icon://arrow-left"
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
 * Complete layout definition — an ordered array of rows.
 *
 * Each entry is a row of keys rendered top-to-bottom. Use this type
 * with {@link KioskKeyboard.registerLayout} to register custom layouts.
 *
 * **Accessibility:** For icon-only keys (where `label` is `""`), the renderer
 * automatically generates an `aria-label` from the key's `value` using i18n
 * translations for built-in special keys (`{backspace}`, `{enter}`, `{shift}`,
 * `" "`). For custom icon-only keys with non-standard values, ensure the
 * `value` is human-readable (e.g. `"Delete"` rather than `"del"`) since it
 * will be used as the accessible name.
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
 * KioskKeyboard.registerLayout("pinpad", pinpad);
 * ```
 *
 * Then in XML: `<kiosk:KioskKeyboard layout="pinpad" />`
 *
 * @public
 * @since 0.1.0
 */
export type LayoutDefinition = KeyRow[];

// ── i18n extensibility types ──────────────────────

/**
 * A single enhancement bundle descriptor.
 *
 * Exactly one of `bundleName` or `bundleUrl` is required.
 * `bundleName` follows the UI5 module-path convention
 * (e.g. `"my.app.i18n.kiosk"`).
 *
 * @public
 * @since 0.1.0
 */
export type KioskI18nEnhancement =
  | {
      /** UI5 module name for the resource bundle (e.g. `"my.app.i18n.kiosk"`). */
      readonly bundleName: string;
      readonly bundleUrl?: never;
      /**
       * Locales this bundle provides translations for, as UI5 locale
       * codes (e.g. `["", "de", "fr"]`). Use `""` for the root (fallback)
       * locale. When omitted, inherits from the top-level config.
       */
      readonly supportedLocales?: readonly string[];
      /**
       * Locale to use when the current UI5 locale is not in `supportedLocales`.
       * Typically `""` (root) or a specific locale code like `"en"`.
       * When omitted, inherits from the top-level config.
       */
      readonly fallbackLocale?: string;
    }
  | {
      readonly bundleName?: never;
      /** Absolute or relative URL to a `.properties` file. */
      readonly bundleUrl: string;
      /**
       * Locales this bundle provides translations for, as UI5 locale
       * codes (e.g. `["", "de", "fr"]`). Use `""` for the root (fallback)
       * locale. When omitted, inherits from the top-level config.
       */
      readonly supportedLocales?: readonly string[];
      /**
       * Locale to use when the current UI5 locale is not in `supportedLocales`.
       * Typically `""` (root) or a specific locale code like `"en"`.
       * When omitted, inherits from the top-level config.
       */
      readonly fallbackLocale?: string;
    };

/**
 * Configuration object for {@link KioskKeyboard.configureI18n}.
 *
 * @example Enhancement bundle by module name
 * ```ts
 * await KioskKeyboard.configureI18n({
 *   enhanceWith: [{
 *     bundleName: "my.app.i18n.kiosk",
 *     supportedLocales: ["", "de", "fr"],
 *     fallbackLocale: "",
 *   }],
 * });
 * ```
 *
 * @example Enhancement bundle by URL
 * ```ts
 * await KioskKeyboard.configureI18n({
 *   enhanceWith: [{
 *     bundleUrl: "/i18n/kiosk/messagebundle.properties",
 *     supportedLocales: [""],
 *     fallbackLocale: "",
 *   }],
 * });
 * ```
 *
 * @public
 * @since 0.1.0
 */
export interface KioskI18nConfig {
  /**
   * Locales that the enhancement bundles provide translations for.
   * Applies as default `supportedLocales` for enhancement entries
   * that do not declare their own.
   *
   * Does **not** reconfigure the base library bundle — its locale
   * list is determined by shipped `.properties` files.
   */
  readonly supportedLocales?: readonly string[];

  /**
   * Default fallback locale for enhancement entries that do not
   * declare their own.
   */
  readonly fallbackLocale?: string;

  /**
   * Additional resource bundles whose texts take precedence over
   * the base library bundle.  Evaluated in array order; the last
   * entry that provides a given key wins.
   */
  readonly enhanceWith?: readonly KioskI18nEnhancement[];
}

/**
 * Context passed to the i18n override hook.
 *
 * @public
 * @since 0.1.0
 */
export interface KioskI18nOverrideContext {
  /** The message key (e.g. `"KIOSK_KEYBOARD_LABEL"`). */
  readonly key: string;
  /**
   * Current locale as a BCP47 language tag (e.g. `"de"`, `"en-US"`).
   * Derived from `Localization.getLanguageTag()`.
   */
  readonly locale: string;
  /**
   * Hardcoded fallback text used when no bundle (base or enhancement)
   * contains the key. This is the second argument of the internal
   * `getText(key, fallback)` call, not the base-bundle text.
   */
  readonly defaultText: string;
  /**
   * Text resolved through the full bundle chain
   * (base + enhancements) *before* the hook runs.
   */
  readonly resolvedText: string;
}

/**
 * Override hook signature.
 *
 * Return a string to replace `resolvedText`.
 * Return `undefined` to keep the resolved text as-is.
 *
 * The hook must be synchronous — async hooks are not supported.
 * Returning a `Promise` is treated as a non-string value and ignored.
 *
 * If the hook throws, the error is logged and `resolvedText` is used.
 *
 * @public
 * @since 0.1.0
 */
export type KioskI18nOverrideHook = (ctx: KioskI18nOverrideContext) => string | undefined;
