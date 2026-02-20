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
  /** QWERTY layout with F1-F12 row on top. */
  QwertyFk: "qwerty-fk",
  /** German QWERTZ layout with F1-F12 row on top. */
  QwertzDeFk: "qwertz-de-fk",
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

/**
 * Controls native keyboard behavior on mobile/touch devices.
 *
 * @enum {string}
 * @public
 */
export const MobileKeyboard = Object.freeze({
  /** Always use KioskKeyboard, suppress native keyboard via `inputmode="none"`. Best for dedicated kiosk terminals without a physical keyboard. */
  Custom: "Custom",
  /** Always defer to the native keyboard — KioskKeyboard will not open on focus. */
  Native: "Native",
  /** Desktop browsers use KioskKeyboard, phones/tablets defer to native. Note: on a regular laptop/desktop with a physical keyboard the virtual keyboard will still appear — use `Native` if that is not desired. */
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
} as const);

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
