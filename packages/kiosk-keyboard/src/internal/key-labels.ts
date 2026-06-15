import Log from "sap/base/Log";
import { getText } from "./i18n-registry";
import type { KeyDefinition } from "../types";

/** Map from special key value to [i18nKey, fallback]. */
const SPECIAL_KEY_I18N: Record<string, [string, string]> = {
  "{backspace}": ["KEY_BACKSPACE", "Backspace"],
  "{enter}": ["KEY_ENTER", "Enter"],
  "{shift}": ["KEY_SHIFT", "Shift"],
  " ": ["KEY_SPACE", "Space"],
};

/**
 * The display label for a key, given the current shift/caps state. Empty string
 * when the label is suppressed (icon-only opt-out).
 */
export function getKeyLabel(key: KeyDefinition, shift: boolean, caps: boolean): string {
  if (key.label === "") return "";

  // Caps Lock state: use capsLockLabel if defined, else i18n fallback
  if (key.value === "{shift}" && caps) {
    if (key.capsLockLabel !== undefined) return key.capsLockLabel;
    return getText("ARIA_CAPS_LOCK", "Caps Lock");
  }

  if (shift && key.shiftLabel) return key.shiftLabel;

  // Explicit label takes priority over i18n
  if (key.label !== undefined) {
    return shift && key.value.length === 1 && key.value.trim() ? key.label.toUpperCase() : key.label;
  }

  // No explicit label: i18n for special keys, value for regular keys
  const entry = SPECIAL_KEY_I18N[key.value];
  if (entry) return getText(entry[0], entry[1]);

  const base = key.value;
  if (!base) return "";
  if (shift) {
    if (key.shiftValue) return key.shiftValue;
    if (key.value.length === 1 && key.value.trim()) return base.toUpperCase();
  }
  return base;
}

/**
 * Accessible label for a key - always non-empty. Used as aria-label when no
 * visible text is present.
 *
 * Resolution order: per-key `ariaLabel` -> visible label (`getKeyLabel`) ->
 * built-in i18n entry. For an icon-only key (`label: ""`) with none of these,
 * a dev-time warning is logged and the raw `value` is used as a last resort,
 * so a custom icon-only token never silently announces itself with no
 * accessible name.
 */
export function getKeyAriaLabel(key: KeyDefinition, shift: boolean, caps: boolean): string {
  if (key.ariaLabel) return key.ariaLabel;

  const display = getKeyLabel(key, shift, caps);
  if (display) return display;

  const entry = SPECIAL_KEY_I18N[key.value];
  if (entry) return getText(entry[0], entry[1]);

  // Icon-only key (label suppressed) with no ariaLabel and no i18n entry:
  // warn so the consumer adds a localizable accessible name, and fall back
  // to the raw value rather than announcing nothing.
  if (key.label === "") {
    Log.warning(
      `Icon-only key "${key.value}" has no accessible name; set ariaLabel on the KeyDefinition.`,
      undefined,
      "ui5.kiosk.KioskKeyboard",
    );
  }

  return key.value;
}
