import Lib from "sap/ui/core/Lib";

/**
 * Resolves an i18n key from the `ui5.kiosk` library resource bundle.
 *
 * Falls back to `sDefault` when the bundle is not yet loaded or the
 * key is missing. This is a module-level function (not a static class
 * method) so it can be imported directly by both the control and the
 * renderer without coupling them.
 */
export function getText(sKey: string, sDefault: string): string {
  const bundle = Lib.getResourceBundleFor("ui5.kiosk");
  if (!bundle) return sDefault;
  return bundle.getText(sKey, undefined, true) ?? sDefault;
}
