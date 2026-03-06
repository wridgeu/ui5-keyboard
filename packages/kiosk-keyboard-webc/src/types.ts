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
 * Each numeric value maps to a CSS class (e.g. `"1.5"` → `.kioskKey--w1-5`).
 */
export type KeyWidth = "1.25" | "1.5" | "1.75" | "2" | "2.25" | "2.75" | "space";

/**
 * Key type determines the visual styling of the key.
 *
 * - `"default"` — Standard key (letter, number, symbol).
 * - `"modifier"` — Subdued style for Shift, layout switches, etc.
 * - `"action"` — Prominent style for Enter, Backspace, etc.
 * - `"space"` — Spacebar. Visually same as default but semantically distinct.
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
 */
export type SpecialKeyValue = "{backspace}" | "{enter}" | "{shift}" | `{layout:${string}}` | `{fkey:${string}}`;

/**
 * Describes a single key on the keyboard.
 */
export interface KeyDefinition {
  /** The character or action this key produces. */
  value: string;

  /** Display label shown on the key face. Defaults to `value`. */
  label?: string;

  /** Label to show when Shift is active. */
  shiftLabel?: string;

  /** Value to produce when Shift is active. Defaults to `value.toUpperCase()` for single-char keys. */
  shiftValue?: string;

  /** Proportional width of the key. */
  width?: KeyWidth;

  /** Visual style category. */
  type?: KeyType;

  /** Icon identifier for icon-only keys. */
  icon?: string;
}

/** A single row of keys on the keyboard. */
export type KeyRow = KeyDefinition[];

/** Complete layout definition — an ordered array of rows. */
export type LayoutDefinition = KeyRow[];

// ── Event detail types ──

export interface KeyPressEventDetail {
  key: string;
  shiftKey: boolean;
}
export interface LayoutChangeEventDetail {
  layout: string;
}
export interface KeyboardTypeChangeEventDetail {
  keyboardType: string;
  previousKeyboardType: string;
  autoDetected: boolean;
}

// ── F-key mode ──

export type FKeyMode = "Virtual" | "Native" | "None";
