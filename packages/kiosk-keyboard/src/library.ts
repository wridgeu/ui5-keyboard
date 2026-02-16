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
  /** Always use KioskKeyboard, suppress native keyboard. Default for kiosk use cases. */
  Custom: "Custom",
  /** On mobile/touch devices, defer to the native keyboard entirely. */
  Native: "Native",
  /** Auto-detect: desktop/kiosk uses custom keyboard, phone/tablet uses native. */
  Auto: "Auto",
} as const);

// ──────────────────────────────────────────────
// UI5 Enum Registration
// ──────────────────────────────────────────────

DataType.registerEnum("ui5.kiosk.KeyboardLayout", KeyboardLayout);
DataType.registerEnum("ui5.kiosk.KeyboardType", KeyboardType);
DataType.registerEnum("ui5.kiosk.MobileKeyboard", MobileKeyboard);

// ──────────────────────────────────────────────
// Library Initialization
// ──────────────────────────────────────────────

const library = Lib.init({
  apiVersion: 2,
  name: "ui5.kiosk",
  version: "${version}",
  dependencies: ["sap.ui.core", "sap.m"],
  types: ["ui5.kiosk.KeyboardLayout", "ui5.kiosk.KeyboardType", "ui5.kiosk.MobileKeyboard"],
  interfaces: [],
  controls: ["ui5.kiosk.KioskKeyboard"],
  elements: [],
  noLibraryCSS: false,
});

export default library;
