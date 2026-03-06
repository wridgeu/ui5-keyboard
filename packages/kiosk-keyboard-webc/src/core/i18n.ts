/**
 * i18n module for the kiosk-keyboard web component.
 *
 * Uses the UI5 Web Components i18n infrastructure for locale-aware text resolution:
 *   - Default texts from generated i18n-defaults.ts (build output from .properties files)
 *   - Runtime locale bundles loaded via registerI18nLoader() (JSON assets in dist/)
 *   - Optional programmatic override via setI18nResolver()
 *
 * @module core/i18n
 */

import { getI18nBundle } from "@ui5/webcomponents-base/dist/i18nBundle.js";
import type I18nBundle from "@ui5/webcomponents-base/dist/i18nBundle.js";
import type { I18nText } from "@ui5/webcomponents-base/dist/i18nBundle.js";

// Import generated i18n defaults (typed key constants with defaultText fallbacks)
import * as I18N from "../generated/i18n/i18n-defaults.js";

const I18N_NAMESPACE = "kiosk-keyboard-webc";

type I18nResolver = (key: string, locale: string, defaultText: string) => string | undefined;

let _resolver: I18nResolver | null = null;
let _bundle: I18nBundle | null = null;

function _getLanguage(): string {
  try {
    return new Intl.Locale(navigator.language).language;
  } catch {
    return "en";
  }
}

/**
 * Initialize the i18n bundle. Called once during component registration.
 * Uses the UI5 WC framework's async bundle loading.
 */
export async function initI18n(): Promise<void> {
  _bundle = await getI18nBundle(I18N_NAMESPACE);
}

/**
 * Set a custom i18n resolver callback for programmatic overrides.
 *
 * The resolver receives the i18n key, current locale, and the resolved default text.
 * Return a string to override the default, or `undefined` to keep it.
 *
 * @example
 * ```ts
 * KioskKeyboard.setI18nResolver((key, locale, defaultText) => {
 *   if (key === "KEY_SHIFT" && locale === "fr") return "Maj";
 *   return undefined; // fall through to default
 * });
 * ```
 */
export function setI18nResolver(fn: I18nResolver | null): void {
  _resolver = fn;
}

/**
 * Get a translated text for the given i18n key.
 *
 * Resolution order:
 * 1. Resolver callback (if set and returns a string)
 * 2. UI5 WC i18n bundle (locale-aware, loaded from JSON assets)
 * 3. Default text from i18n-defaults.ts (English fallback)
 */
export function getText(key: string, fallback: string): string {
  // Look up the typed I18nText constant
  const i18nText = (I18N as Record<string, I18nText | undefined>)[key];
  const defaultText = i18nText?.defaultText ?? fallback;

  // Try the UI5 WC i18n bundle first (locale-aware)
  let resolved = defaultText;
  if (_bundle && i18nText) {
    const bundleText = _bundle.getText(i18nText);
    if (bundleText && bundleText !== key) {
      resolved = bundleText;
    }
  }

  // Apply resolver override if set
  if (_resolver) {
    try {
      const override = _resolver(key, _getLanguage(), resolved);
      if (typeof override === "string") return override;
    } catch (err) {
      console.warn("[kiosk-keyboard] i18n resolver threw:", err);
    }
  }

  return resolved;
}
