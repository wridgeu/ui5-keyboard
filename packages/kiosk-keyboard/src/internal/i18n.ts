/**
 * Resolves an i18n key from the `ui5.kiosk` library resource bundle,
 * optionally enhanced by consumer-configured bundles and override hooks.
 *
 * Falls back to `sDefault` when the key is missing from all bundles.
 */
export { getText } from "./i18n-registry";
