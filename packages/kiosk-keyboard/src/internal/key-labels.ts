import Log from "sap/base/Log";
import { getText } from "./i18n-registry";
import { SPECIAL_KEY_I18N_KEYS } from "./key-action-meta";
import { shiftedGlyph } from "./latin-variants";
import type { KeyDefinition } from "../types";

/** Map from special key value to [i18nKey, fallback]. */
const SPECIAL_KEY_I18N: Record<string, [string, string]> = {
  "{backspace}": [SPECIAL_KEY_I18N_KEYS.backspace, "Backspace"],
  "{enter}": [SPECIAL_KEY_I18N_KEYS.enter, "Enter"],
  "{shift}": [SPECIAL_KEY_I18N_KEYS.shift, "Shift"],
  " ": [SPECIAL_KEY_I18N_KEYS.space, "Space"],
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

  // shiftLabel names the Shift symbol, which CapsLock does not type.
  if (shift && !caps && key.shiftLabel) return key.shiftLabel;

  // Explicit label takes priority over i18n
  if (key.label !== undefined) {
    return shift && key.value.length === 1 && key.value.trim() ? key.label.toUpperCase() : key.label;
  }

  // No explicit label: i18n for special keys, value for regular keys
  const entry = SPECIAL_KEY_I18N[key.value];
  if (entry) return getText(entry[0], entry[1]);

  const base = key.value;
  if (!base) return "";
  // Shift/Caps form of the key: Shift types the shiftValue, CapsLock uppercases
  // the base (incl. ß -> ẞ) and ignores an uncased shiftValue.
  if (shift) return shiftedGlyph(base, key.shiftValue, caps);
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
  // to the raw value rather than announcing nothing. Warn once per key value
  // (the renderer would otherwise repeat the warning on every re-render).
  if (key.label === "" && !warnedMissingLabels.has(key.value)) {
    warnedMissingLabels.add(key.value);
    Log.warning(
      `Icon-only key "${key.value}" has no accessible name; set ariaLabel on the KeyDefinition.`,
      undefined,
      "ui5.kiosk.KioskKeyboard",
    );
  }

  return key.value;
}

/** Key values already warned about, so re-renders do not repeat the warning. */
const warnedMissingLabels = new Set<string>();

/**
 * Clears the warned-once cache. Called when the last KioskKeyboard instance
 * is destroyed so module-level state does not survive across app restarts
 * (mirrors `clearIconWarnings`).
 */
export function clearLabelWarnings(): void {
  warnedMissingLabels.clear();
}
