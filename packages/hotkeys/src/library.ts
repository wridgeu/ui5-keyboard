import DataType from "sap/ui/base/DataType";
import Lib from "sap/ui/core/Lib";

// ──────────────────────────────────────────────
// UI5 Enum Definitions
// ──────────────────────────────────────────────

/**
 * Strategy for handling conflicting hotkey registrations on the same scope.
 *
 * @enum {string}
 * @public
 */
export const ConflictBehavior = Object.freeze({
  /** Log a console warning but allow both registrations (default). */
  Warn: "warn",
  /** Throw an error, preventing the new registration. */
  Error: "error",
  /** Unregister the existing hotkey and register the new one. */
  Replace: "replace",
  /** Allow multiple registrations silently. */
  Allow: "allow",
} as const);
export type ConflictBehavior = (typeof ConflictBehavior)[keyof typeof ConflictBehavior];

/**
 * Reason why a key event was not handled by any registration.
 *
 * @enum {string}
 * @public
 */
export const UnhandledReason = Object.freeze({
  /** No registration matched the key combination in any scope. */
  NoMatch: "no_match",
  /** A registration matched, but its `enabled` option resolved to `false`. */
  Disabled: "disabled",
  /** A registration matched, but was suppressed because the target is an input element. */
  InputSuppressed: "input_suppressed",
  /** A registration matched, but was suppressed because a popup (dialog or popover) is open. */
  PopupSuppressed: "popup_suppressed",
  /** A registration matched, but was skipped because the key is held (`event.repeat`). */
  RepeatIgnored: "repeat_ignored",
} as const);
export type UnhandledReason = (typeof UnhandledReason)[keyof typeof UnhandledReason];

/**
 * Supported platform identifiers for cross-platform modifier resolution.
 *
 * @enum {string}
 * @public
 */
export const Platform = Object.freeze({
  /** macOS — uses Meta (Command) as the primary modifier. */
  Mac: "mac",
  /** Windows — uses Control as the primary modifier. */
  Windows: "windows",
  /** Linux — uses Control as the primary modifier. */
  Linux: "linux",
} as const);
export type Platform = (typeof Platform)[keyof typeof Platform];

// Re-export from constants — single source of truth
export { GLOBAL_SCOPE } from "./constants";

// ──────────────────────────────────────────────
// UI5 Enum Registration
// ──────────────────────────────────────────────

DataType.registerEnum("ui5.hotkeys.ConflictBehavior", ConflictBehavior);
DataType.registerEnum("ui5.hotkeys.UnhandledReason", UnhandledReason);
DataType.registerEnum("ui5.hotkeys.Platform", Platform);

// ──────────────────────────────────────────────
// Library Initialization
// ──────────────────────────────────────────────

const library = Lib.init({
  apiVersion: 2,
  name: "ui5.hotkeys",
  version: "${version}",
  dependencies: ["sap.ui.core"],
  types: ["ui5.hotkeys.ConflictBehavior", "ui5.hotkeys.UnhandledReason", "ui5.hotkeys.Platform"],
  interfaces: [],
  controls: [],
  elements: [],
  noLibraryCSS: true,
});

export default library;
