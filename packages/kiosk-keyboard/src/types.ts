import type { VariantTable } from "./internal/latin-variants";

/**
 * Valid width values for keys.
 *
 * - Numeric values (`"1.25"`, `"1.5"`, etc.) set proportional flex-grow.
 *   A key with `"2"` is twice as wide as a standard key.
 * - `"space"` gives the spacebar extra-wide flex (6x).
 * - `undefined` (default) gives a standard 1x flex-grow.
 *
 * Each value is emitted verbatim as the `data-key-span` attribute (e.g. `"1.5"` → `[data-key-span="1.5"]`).
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
 * - `"space"` - Spacebar. Renders like `"default"`.
 *
 * `"modifier"`, `"action"` and `"space"` keys never take table variants, so
 * `accentVariants` and a `defaultVariants` entry both skip them even when the key's
 * `value` is a base letter the table covers. Only a per-key `variants` array reaches
 * such a key. That is the sole non-visual effect of this field, and the reason
 * `"space"` exists as a distinct value at all.
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
 * Any other string is treated as a literal character to insert. An
 * unrecognized `{...}` token (one not matching the cases above) fires a
 * cancelable `keyPress` and is otherwise a no-op, not literal text. A consumer
 * can own such a token by listening for `keyPress`, calling `preventDefault()`,
 * and driving the input via `insertText` / `deleteBackward`.
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
   * Evaluated independently of {@link icon}. Setting `icon` to `""`
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
   * - `"space"` - Spacebar. Renders like `"default"`.
   * - `"default"` or omitted - Standard key. Uses SAP Button tokens.
   *
   * Also gates accent-variant merging: see {@link KeyType}.
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

  /**
   * Per-key accessible name, used as the `aria-label` when the key has no
   * visible text label (an icon-only key, `label: ""`).
   *
   * Resolution order for the accessible name is `ariaLabel` -> visible
   * `label` -> the built-in i18n bundle (built-in tokens only). Set this for
   * icon-only custom keys (e.g. a `{paste}` key): without it, an icon-only
   * custom token has no i18n entry and would announce its raw value, and the
   * keyboard logs a dev-time warning. Localizable by the consumer.
   */
  ariaLabel?: string;

  /**
   * Ordered alternate glyphs surfaced in a long-press / right-click popup
   * (press-and-hold the key, or right-click, then pick a glyph). Mirrors the
   * CLDR LDML Part 7 `longPress` model: the key's own {@link value} stays the
   * tap default and is **not** repeated here. When Shift/Caps Lock is active
   * the popup surfaces the uppercase forms.
   *
   * Purely additive and opt-in per key; a key without `variants` shows no
   * popup. A built-in Latin-diacritics table (covering German
   * ä/ö/ü/ß and more) can be applied to a layout via the keyboard's long-press
   * variant setting; an explicit `variants` here always overrides the default.
   *
   * This is the concept other keyboard systems call `longPress` (CLDR LDML
   * Part 7), `moreKeys` (Android) or `sk` (Keyman).
   *
   * @example { value: "a", variants: ["ä", "à", "á", "â"] }
   * @since 0.1.0
   */
  variants?: string[];
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
 * type through the `customLayouts` aggregation to expose custom layouts to
 * a single keyboard instance.
 *
 * **Accessibility:** Keys with visible text labels get their accessible name
 * from the visible text. For icon-only keys (where `label` is `""`), the
 * renderer sets an `aria-label` using i18n translations for built-in special
 * keys (`{backspace}`, `{enter}`, `{shift}`, `" "`). For custom icon-only
 * keys with non-standard values, set {@link KeyDefinition.ariaLabel}: the
 * renderer warns and falls back to the raw `value` when it finds neither.
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
 * new KioskKeyboard({
 *   layout: "pinpad",
 *   customLayouts: [new CustomLayout({ name: "pinpad", rows: pinpad })],
 * });
 * ```
 *
 * Or in XML, with the rows bound from a model:
 * `<kiosk:CustomLayout name="pinpad" rows="{layouts>/pinpad}" />`
 *
 * @public
 * @since 0.1.0
 */
export type LayoutDefinition = KeyRow[];

/**
 * What one custom layout declares. A custom layout without `rows` overlays the layout its
 * `name` already resolves to. The tier applied under every layout is the host's
 * `defaultVariants` property, not a member of this collection.
 *
 * @public
 * @since 0.1.0
 */
export interface CustomLayoutSpec {
  readonly name: string;
  readonly rows?: LayoutDefinition;
  /**
   * `rows` is declared through a binding that has not produced a value yet. The layout
   * resolves as soon as it does, so the name is not unresolvable and must not be
   * reported as one.
   */
  readonly rowsPending?: boolean;
  readonly keycapLang?: string;
  /**
   * The layout rendered instead of this one on a keyboard too narrow to seat its rows,
   * read only when `autoCompact` is on. Matched after trim and lowercase, like any layout
   * name. Absent takes the built-in of the same name's counterpart.
   */
  readonly compact?: string;
  /**
   * Whether the layout is an auxiliary surface rather than a base alphabetic layout.
   * Absent takes the built-in of the same name's value, and the base alphabetic role
   * when there is no built-in of that name.
   */
  readonly secondary?: boolean;
  readonly locales?: readonly string[];
  readonly middleware?: () => CompositionMiddleware;
  readonly variants?: VariantTable;
  /**
   * Facets whose inherited value this custom layout discards. A listed facet resolves to
   * nothing at this custom layout's position; a value this same custom layout declares
   * still applies. Entries outside `SUPPRESSIBLE_FACETS` are reported and ignored.
   */
  readonly suppress?: readonly string[];
}

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
 * @since 0.1.0
 */
export type I18nResolver = (key: string, locale: string, resolvedText: string) => string | undefined;

/**
 * Locates the native `<input>` or `<textarea>` inside a target control whose focus
 * DOM ref is not one itself, for `setTargetResolver()` and
 * `KioskKeyboard.setGlobalTargetResolver()`.
 *
 * Receives the control's focus DOM ref and returns the text field inside it, or
 * `null` to use the built-in resolver, which searches the light DOM and up to three
 * levels of shadow DOM. A resolver that throws is logged and treated as `null`.
 *
 * @example
 * ```ts
 * const resolver: TargetResolver = (el) => el.querySelector<HTMLInputElement>(".my-editor input");
 * KioskKeyboard.setGlobalTargetResolver(resolver);
 * ```
 *
 * @public
 * @since 0.1.0
 */
export type TargetResolver = (el: HTMLElement) => HTMLInputElement | HTMLTextAreaElement | null;

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
