import DataType from "sap/ui/base/DataType";
import Lib from "sap/ui/core/Lib";
import "sap/m/library"; // resolve dependency before Lib.init()

// ──────────────────────────────────────────────
// UI5 Enum Definitions
// ──────────────────────────────────────────────

/**
 * Built-in keyboard layout identifiers.
 *
 * @enum {string}
 * @public
 */
export const KeyboardLayout = Object.freeze({
  /** Standard QWERTY layout. */
  Qwerty: "Qwerty",
  /** German QWERTZ layout with Umlaute (\u00E4, \u00F6, \u00FC, \u00DF). */
  QwertzDe: "QwertzDe",
  /** Numeric layout with number pad and basic operators. */
  Numeric: "Numeric",
  /** Special characters layout. */
  Special: "Special",
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

// ──────────────────────────────────────────────
// UI5 Enum Registration
// ──────────────────────────────────────────────

DataType.registerEnum("ui5.kiosk.KeyboardLayout", KeyboardLayout);
DataType.registerEnum("ui5.kiosk.KeyboardType", KeyboardType);

// ──────────────────────────────────────────────
// Library Initialization
// ──────────────────────────────────────────────

const library = Lib.init({
  apiVersion: 2,
  name: "ui5.kiosk",
  version: "${version}",
  dependencies: ["sap.ui.core", "sap.m"],
  types: ["ui5.kiosk.KeyboardLayout", "ui5.kiosk.KeyboardType"],
  interfaces: [],
  controls: ["ui5.kiosk.KioskKeyboard"],
  elements: [],
  noLibraryCSS: false,
});

export default library;
