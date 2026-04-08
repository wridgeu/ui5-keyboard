import DataType from "sap/ui/base/DataType";
import Lib from "sap/ui/core/Lib";
import "sap/m/library"; // resolve dependency before Lib.init()

// ──────────────────────────────────────────────
// UI5 Enum Definitions
// ──────────────────────────────────────────────

/**
 * Built-in keyboard layout identifiers.
 *
 * Values match the layout registry keys (lowercase with hyphens).
 *
 * @enum {string}
 * @public
 */
export const KeyboardLayout = Object.freeze({
  /** Standard QWERTY layout. */
  Qwerty: "qwerty",
  /** German QWERTZ layout with Umlaute (\u00E4, \u00F6, \u00FC, \u00DF). */
  QwertzDe: "qwertz-de",
  /** Numeric layout with number pad and basic operators. */
  Numeric: "numeric",
  /** Special characters layout. */
  Special: "special",
  /** Compact numeric keypad layout. */
  Numpad: "numpad",
  /** Function keys F1-F12 standalone layout. */
  Fkeys: "fkeys",
  /** Navigation keys (arrows, Home/End, Page keys) standalone layout. */
  Nav: "nav",
  /** Japanese Romaji layout (QWERTY base with JIS punctuation). */
  JaRomaji: "ja-romaji",
  /** Japanese Kana direct-input layout (JIS X 6002). */
  JaKana: "ja-kana",
  /** Arabic keyboard layout (standard Arabic 101). */
  Arabic: "arabic",
  /** Korean Hangul Dubeolsik layout (KS X 5002). */
  KoHangul: "ko-hangul",
  /** Spanish QWERTY layout with accented vowels and inverted punctuation. */
  QwertyEs: "qwerty-es",
} as const);

/**
 * Keyboard display type.
 *
 * UI5 enum convention: key === value (PascalCase).
 * This ensures DataType.parseValue() works correctly in XML views.
 *
 * @enum {string}
 * @public
 */
export const KeyboardType = Object.freeze({
  /** Full alphabetic keyboard with all keys. */
  Full: "Full",
  /** Numeric layout with number pad and basic operators. */
  Numeric: "Numeric",
  /** Compact numeric keypad only. */
  Numpad: "Numpad",
} as const);

/** Value type derived from {@link KeyboardType}. */
export type KeyboardTypeValue = (typeof KeyboardType)[keyof typeof KeyboardType];

/**
 * Controls native keyboard behavior on mobile/touch devices.
 *
 * @enum {string}
 * @public
 */
export const MobileKeyboard = Object.freeze({
  /** Always use KioskKeyboard, suppress native keyboard via `inputmode="none"`. Best for dedicated kiosk terminals without a physical keyboard. */
  Custom: "Custom",
  /** Always defer to the native keyboard - KioskKeyboard will not open on focus. */
  Native: "Native",
  /** Desktop browsers use KioskKeyboard, phones/tablets defer to native. Note: on a regular laptop/desktop with a physical keyboard the virtual keyboard will still appear - use `Native` if that is not desired. */
  Auto: "Auto",
} as const);

/**
 * Controls how virtual F-key taps are dispatched.
 *
 * @enum {string}
 * @public
 */
export const FKeyMode = Object.freeze({
  /** Virtual mode: fire `keyPress` only (application handles behavior). */
  Virtual: "Virtual",
  /** Native mode: dispatch synthetic `keydown` and run built-in native actions for selected keys. */
  Native: "Native",
  /** None: fire `keyPress` only, skip native dispatch and built-in navigation actions. */
  None: "None",
} as const);

/**
 * Key names used in the `keyPress` event's `key` parameter.
 *
 * Regular character keys fire their literal value (e.g. `"a"`, `"A"`, `"1"`,
 * `"!"`). This enum covers all **non-character** key names that the keyboard
 * can fire - action keys, function keys, and navigation keys.
 *
 * Values align with the standard {@link https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key | KeyboardEvent.key}
 * names where applicable.
 *
 * @example <caption>TypeScript - intercept Enter in a keyPress handler</caption>
 * import { KeyName } from "ui5/kiosk/library";
 *
 * keyboard.attachKeyPress((event) => {
 *   if (event.getParameter("key") === KeyName.Enter) {
 *     event.preventDefault();
 *     advanceToNextField();
 *   }
 * });
 *
 * @public
 */
export const KeyName = Object.freeze({
  // Action keys
  /** Enter / Return key. */
  Enter: "Enter",
  /** Backspace (delete backward). */
  Backspace: "Backspace",

  // Function keys
  /** Function key F1. */ F1: "F1",
  /** Function key F2. */ F2: "F2",
  /** Function key F3. */ F3: "F3",
  /** Function key F4. */ F4: "F4",
  /** Function key F5. */ F5: "F5",
  /** Function key F6. */ F6: "F6",
  /** Function key F7. */ F7: "F7",
  /** Function key F8. */ F8: "F8",
  /** Function key F9. */ F9: "F9",
  /** Function key F10. */ F10: "F10",
  /** Function key F11. */ F11: "F11",
  /** Function key F12. */ F12: "F12",

  // Navigation keys
  /** Left arrow - moves caret one character left. */
  ArrowLeft: "ArrowLeft",
  /** Right arrow - moves caret one character right. */
  ArrowRight: "ArrowRight",
  /** Up arrow - moves caret up one line (textarea only). */
  ArrowUp: "ArrowUp",
  /** Down arrow - moves caret down one line (textarea only). */
  ArrowDown: "ArrowDown",
  /** Home - moves caret to start of text. */
  Home: "Home",
  /** End - moves caret to end of text. */
  End: "End",
  /** Page Up - moves caret to start of text. */
  PageUp: "PageUp",
  /** Page Down - moves caret to end of text. */
  PageDown: "PageDown",
} as const);

/**
 * Keys that are allowed for synthetic native `keydown` dispatch in
 * `fKeyMode="Native"`.
 *
 * Custom `{fkey:...}` names still fire `keyPress`, but are intentionally
 * excluded from native dispatch and native action execution.
 *
 * @public
 */
export const NativeDispatchableKeyNames = Object.freeze([
  KeyName.F1,
  KeyName.F2,
  KeyName.F3,
  KeyName.F4,
  KeyName.F5,
  KeyName.F6,
  KeyName.F7,
  KeyName.F8,
  KeyName.F9,
  KeyName.F10,
  KeyName.F11,
  KeyName.F12,
  KeyName.ArrowLeft,
  KeyName.ArrowRight,
  KeyName.ArrowUp,
  KeyName.ArrowDown,
  KeyName.Home,
  KeyName.End,
  KeyName.PageUp,
  KeyName.PageDown,
] as const);

// ──────────────────────────────────────────────
// UI5 Enum Registration
// ──────────────────────────────────────────────

DataType.registerEnum("ui5.kiosk.KeyboardLayout", KeyboardLayout);
DataType.registerEnum("ui5.kiosk.KeyboardType", KeyboardType);
DataType.registerEnum("ui5.kiosk.MobileKeyboard", MobileKeyboard);
DataType.registerEnum("ui5.kiosk.FKeyMode", FKeyMode);

// ──────────────────────────────────────────────
// Library Initialization
// ──────────────────────────────────────────────

const library = Lib.init({
  apiVersion: 2,
  name: "ui5.kiosk",
  version: "${version}",
  dependencies: ["sap.ui.core", "sap.m"],
  types: ["ui5.kiosk.KeyboardLayout", "ui5.kiosk.KeyboardType", "ui5.kiosk.MobileKeyboard", "ui5.kiosk.FKeyMode"],
  interfaces: [],
  controls: ["ui5.kiosk.KioskKeyboard"],
  elements: [],
  noLibraryCSS: false,
});

export default library;
