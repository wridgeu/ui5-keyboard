/**
 * Valid width values for keys.
 *
 * - Numeric values (`"1.5"`, `"1.75"`, etc.) set proportional flex-grow.
 *   A key with `"2"` is twice as wide as a standard key.
 * - `"space"` gives the spacebar extra-wide flex (6x).
 * - `undefined` (default) gives a standard 1x flex-grow.
 *
 * Each numeric value maps to a CSS class (e.g. `"1.5"` → `.kiosk-key--w1-5`).
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
 * Any other string is treated as a literal character to insert.
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
   * Display label shown on the key face. Defaults to `value`.
   * When an icon is also present, both render together.
   * Set to `""` to suppress the label for icon-only display.
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
   * Defaults to the i18n text for `ARIA_CAPS_LOCK` ("Caps Lock").
   * Only meaningful on keys with `value: "{shift}"`.
   */
  capsLockLabel?: string;

  /**
   * Icon to show on the `{shift}` key when Caps Lock is active.
   * Evaluated independently of {@link icon} -- setting `icon` to `""`
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
   * When both icon and label are present, both render together.
   * Set `label` to `""` for icon-only display; set `icon` to `""` to suppress a built-in icon.
   */
  icon?: string;
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

// ── Event detail types ──

/**
 * Detail payload for the `key-press` event.
 *
 * @public
 * @since 0.1.0
 */
export interface KeyPressEventDetail {
  key: string;
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
  layout: string;
}

/**
 * Detail payload for the `keyboard-type-change` event.
 *
 * @public
 * @since 0.1.0
 */
export interface KeyboardTypeChangeEventDetail {
  keyboardType: `${KeyboardType}`;
  previousKeyboardType: `${KeyboardType}`;
  autoDetected: boolean;
}

/**
 * Detail payload for the `target-input-change` event.
 *
 * @public
 * @since 0.1.0
 */
export interface TargetInputChangeEventDetail {
  targetElement: HTMLInputElement | HTMLTextAreaElement | null;
}
