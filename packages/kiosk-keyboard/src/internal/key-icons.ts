import IconPool from "sap/ui/core/IconPool";
import Log from "sap/base/Log";
import { SPECIAL_KEY_ICON_NAMES } from "./key-action-meta";

const SAP_ICON_PREFIX = "sap-icon://";

/**
 * Default special-key icons and icon URI validation.
 *
 * Lives in a leaf module so both the control (public static surface) and the
 * renderer can import it without a renderer -> control import cycle.
 */

/** Default icons for special keys - used when the key has no explicit icon. */
// The open `string` key is the contract: `getKeyIcon` looks this up by whatever token a custom
// layout declares. Re-exported as the public static `KioskKeyboard.SPECIAL_KEY_ICONS`.
export const SPECIAL_KEY_ICONS: Readonly<Record<string, string>> = {
  "{backspace}": SAP_ICON_PREFIX + SPECIAL_KEY_ICON_NAMES.backspace,
  "{shift}": SAP_ICON_PREFIX + SPECIAL_KEY_ICON_NAMES.shift,
  "{shift:capsLock}": SAP_ICON_PREFIX + SPECIAL_KEY_ICON_NAMES.capsLock,
  "{enter}": SAP_ICON_PREFIX + SPECIAL_KEY_ICON_NAMES.enter,
};

/** Icon for a `{layout:base}` key kept under the Numpad/Numeric constraint. */
export const LAYOUT_RETURN_ICON = SAP_ICON_PREFIX + SPECIAL_KEY_ICON_NAMES.layoutReturn;

/**
 * Returns the default icon URI for a special key value, or undefined
 * if the key has no default icon.
 */
export function getKeyIcon(keyValue: string): string | undefined {
  return SPECIAL_KEY_ICONS[keyValue];
}

/** Icon URIs already warned about, so re-renders do not repeat the warning. */
const warnedInvalidIcons = new Set<string>();

/**
 * Returns the icon unchanged when it is renderable, or "" when it is a SAP
 * icon URI not present in the IconPool registry. Warns once per unknown URI
 * (the renderer would otherwise repeat the warning on every re-render).
 *
 * @param icon Icon URI or Unicode glyph; may be empty.
 * @param kind Key property name used in the warning ("icon" / "capsLockIcon").
 */
export function validateKeyIcon(icon: string, kind: string): string {
  if (icon && IconPool.isIconURI(icon) && !IconPool.getIconInfo(icon)) {
    if (!warnedInvalidIcons.has(icon)) {
      warnedInvalidIcons.add(icon);
      Log.warning(`KioskKeyboard: ${kind} "${icon}" not found, skipping`, undefined, "KioskKeyboard");
    }
    return "";
  }
  return icon;
}

/**
 * Clears the warned-once cache. Called when the last KioskKeyboard instance
 * is destroyed so module-level state does not survive across app restarts
 * (mirrors the `_WARNED_UNSUPPORTED_NATIVE_FKEYS` cleanup).
 */
export function clearIconWarnings(): void {
  warnedInvalidIcons.clear();
}
