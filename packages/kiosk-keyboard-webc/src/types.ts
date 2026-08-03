import type { VariantTable } from "./core/latin-variants.js";

/**
 * Valid width values for keys.
 *
 * - Numeric values (`"1.5"`, `"1.75"`, etc.) set proportional flex-grow.
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
 * - `"default"` - Standard key (letter, number, symbol).
 * - `"modifier"` - Subdued style for Shift, layout switches (ABC, Fn), etc.
 * - `"action"` - Prominent style for Enter, Backspace, etc.
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
 * Any other string is treated as a literal character to insert. An
 * unrecognized `{...}` token (one not matching the cases above) fires a
 * cancelable `key-press` and is otherwise a no-op, not literal text. A consumer
 * can own such a token by listening for `key-press`, calling `preventDefault()`,
 * and driving the input via `insertText` / `deleteBackward`.
 *
 * @public
 * @since 0.1.0
 */
export type SpecialKeyValue = "{backspace}" | "{enter}" | "{shift}" | `{layout:${string}}` | `{fkey:${string}}`;

/**
 * Describes a single key on the keyboard.
 *
 * @public
 * @since 0.1.0
 */
export interface KeyDefinition {
  /** The character or action this key produces. */
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
   * When an icon is also present, both render together (inline by
   * default, customizable via `--kiosk-keyboard-dual-direction`).
   *
   * On `{shift}` keys, this label is replaced during Caps Lock state
   * by {@link capsLockLabel} (or the i18n fallback "Caps Lock").
   */
  label?: string;

  /** Label to show when Shift is active. */
  shiftLabel?: string;

  /**
   * Label to show on the `{shift}` key when Caps Lock is active.
   * Overrides {@link label} when Caps Lock is active.
   * Defaults to the i18n text for `KEY_CAPS_LOCK` ("Caps Lock").
   * Only meaningful on keys with `value: "{shift}"`.
   */
  capsLockLabel?: string;

  /**
   * Icon to show on the `{shift}` key when Caps Lock is active.
   * Evaluated independently of {@link icon}. Setting `icon` to `""`
   * does not suppress `capsLockIcon`.
   * Accepts SAP icon URIs or Unicode/emoji. Defaults to `sap-icon://locked`.
   * Only meaningful on keys with `value: "{shift}"`.
   */
  capsLockIcon?: string;

  /** Value to produce when Shift is active. Defaults to `value.toUpperCase()` for single-char keys. */
  shiftValue?: string;

  /** Proportional width of the key. */
  width?: KeyWidth;

  /** Visual style category. */
  type?: KeyType;

  /**
   * Icon displayed on the key face.
   * SAP icon URI (e.g. `"sap-icon://accept"`) or Unicode character / emoji (e.g. `"\u23CE"`).
   * When both icon and label are present, both render together (inline by
   * default, customizable via `--kiosk-keyboard-dual-direction`).
   * Set `label` to `""` for icon-only display; set `icon` to `""` to suppress a built-in icon.
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
   * Purely additive and opt-in per key; keys without `variants` show no popup.
   * The `accent-variants` attribute applies a built-in Latin-diacritics table
   * (covering German ä/ö/ü/ß and more) to a layout; an explicit `variants` here
   * always overrides the default.
   *
   * This is the concept other keyboard systems call `longPress` (CLDR LDML
   * Part 7), `moreKeys` (Android) or `sk` (Keyman).
   *
   * @example { value: "a", variants: ["ä", "à", "á", "â"] }
   * @since 0.1.0
   */
  variants?: string[];
}

/** A single row of keys on the keyboard.
 *
 * @public
 * @since 0.1.0
 */
export type KeyRow = KeyDefinition[];

/**
 * Complete layout definition - an ordered array of rows.
 *
 * @public
 * @since 0.1.0
 */
export type LayoutDefinition = KeyRow[];

/**
 * What one custom layout declares. A custom layout without `rows` overlays the layout its
 * `name` already resolves to. The tier applied under every layout is the host's
 * `defaultVariants` property, not a member of this collection.
 */
export interface CustomLayoutSpec {
  readonly name: string;
  readonly rows?: LayoutDefinition;
  readonly keycapLang?: string;
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

// ── Enum types for constrained properties ──

/**
 * Available keyboard type variants.
 *
 * @public
 * @since 0.1.0
 */
export enum KeyboardType {
  /** Full alphanumeric keyboard with all rows. */
  Full = "Full",
  /** Numeric keypad layout (calculator-style). */
  Numpad = "Numpad",
  /** Simplified numeric input (digits + basic operators). */
  Numeric = "Numeric",
}

/**
 * Mobile keyboard behavior modes.
 *
 * @public
 * @since 0.1.0
 */
export enum MobileKeyboard {
  /** Defer to native keyboard on touch devices, show custom on desktop. */
  Auto = "Auto",
  /** Always defer to the native on-screen keyboard. */
  Native = "Native",
  /** Always show the custom virtual keyboard. */
  Custom = "Custom",
}

/**
 * Function key dispatch modes.
 *
 * @public
 * @since 0.1.0
 */
export enum FKeyMode {
  /** Fire key-press event only (no native keyboard event). */
  Virtual = "Virtual",
  /** Dispatch a native KeyboardEvent for supported keys. */
  Native = "Native",
  /** Ignore function key presses entirely. */
  None = "None",
}

/**
 * Whether a layout is an auxiliary surface or a base alphabetic layout. A secondary
 * layout is never tracked as the base, so `{layout:base}` returns to the alphabetic
 * layout it was reached from.
 *
 * @public
 * @since 0.1.0
 */
export enum LayoutRole {
  /**
   * Takes the built-in layout of the same name's role, and the base alphabetic role
   * when there is no built-in of that name.
   */
  Inherit = "Inherit",
  /** A base alphabetic layout, even when the built-in of the same name is secondary. */
  Base = "Base",
  /** An auxiliary surface: numbers, symbols, F-keys, navigation. */
  Secondary = "Secondary",
}

/**
 * A per-layout facet whose inherited value a custom layout discards. A listed facet
 * resolves to nothing at that custom layout's position: the built-in tier and every
 * earlier custom layout's contribution are dropped, and only a value the same custom
 * layout declares survives.
 *
 * Rows are not listed: the built-in registry is sealed, so a custom layout shadows rows
 * and never removes them.
 *
 * @public
 * @since 0.1.0
 */
export enum LayoutFacet {
  /** Long-press accent variants. Suppressed, the layout's keys carry no long-press affordance. */
  Variants = "Variants",
  /** Composition (IME / dead-key) middleware. Suppressed, the layout's keys type directly. */
  Middleware = "Middleware",
}

// ── Event detail types ──

/**
 * Detail payload for the `key-press` event.
 *
 * @public
 * @since 0.1.0
 */
export interface KeyPressEventDetail {
  /** The key value that was pressed (character, or a key constant for non-character keys). */
  key: string;
  /** Whether the Shift modifier was active when the key was pressed. */
  shiftKey: boolean;
  /**
   * The character that would be inserted (after shift resolution).
   * `undefined` for action keys (`{shift}`, `{backspace}`, `{enter}`,
   * `{layout:...}`) and function/navigation keys (`{fkey:...}`).
   */
  char?: string;
}

/**
 * Detail payload for the `layout-change` event.
 *
 * @public
 * @since 0.1.0
 */
export interface LayoutChangeEventDetail {
  /** The name of the newly active layout. */
  layout: string;
}

/**
 * Detail payload for the `keyboard-type-change` event.
 *
 * @public
 * @since 0.1.0
 */
export interface KeyboardTypeChangeEventDetail {
  /** The new keyboard type. */
  keyboardType: `${KeyboardType}`;
  /** The previous keyboard type. */
  previousKeyboardType: `${KeyboardType}`;
  /** Whether this change was triggered by auto-type detection. */
  autoDetected: boolean;
}

/**
 * Detail payload for the `active-control-change` event.
 *
 * @public
 * @since 0.1.0
 */
export interface ActiveControlChangeEventDetail {
  /** The new active input element, or `null` if cleared. */
  activeElement: HTMLInputElement | HTMLTextAreaElement | null;
}

/**
 * Detail payload shared by the `after-open` and `after-close` events.
 *
 * @public
 * @since 0.1.0
 */
export interface OpenStateChangeEventDetail {
  /**
   * The active target input at the moment of the state change, or `null`.
   * For `after-close` this reports the input that was active just before
   * the keyboard closed.
   */
  activeElement: HTMLInputElement | HTMLTextAreaElement | null;
}
