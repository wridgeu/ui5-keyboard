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
import { reRenderAllUI5Elements } from "@ui5/webcomponents-base/dist/Render.js";
import getLocale from "@ui5/webcomponents-base/dist/locale/getLocale.js";

// Import generated i18n defaults (typed key constants with defaultText fallbacks)
import * as I18N from "../generated/i18n/i18n-defaults.js";

const I18N_NAMESPACE = "kiosk-keyboard-webc";

type I18nResolver = (key: string, locale: string, defaultText: string) => string | undefined;

let _resolver: I18nResolver | null = null;
let _bundle: I18nBundle | null = null;

function _getLanguage(): string {
  try {
    return getLocale().getLanguage();
  } catch {
    return "en";
  }
}

/**
 * Initialize the i18n bundle. Called once during component registration.
 * Uses the UI5 WC framework's async bundle loading.
 *
 * The bundle resolves after first render in non-English locales, so any
 * already-mounted instances have rendered with English defaults. Refresh
 * them once the locale-specific texts are available.
 */
export async function initI18n(): Promise<void> {
  _bundle = await getI18nBundle(I18N_NAMESPACE);
  await reRenderAllUI5Elements({ tag: "kiosk-keyboard" });
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
type I18nKey = keyof typeof I18N;

/** Fills `{0}`/`{1}`/… placeholders in a default text when no bundle is active. */
function _formatMessage(text: string, args: (string | number)[]): string {
  if (args.length === 0) return text;
  return text.replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}

function lookupI18nText(key: string): I18nText | undefined {
  return Object.hasOwn(I18N, key) ? I18N[key as I18nKey] : undefined;
}

export function getText(key: string, fallback: string, ...args: (string | number)[]): string {
  const i18nText = lookupI18nText(key);
  const defaultText = i18nText?.defaultText ?? fallback;

  // Try the UI5 WC i18n bundle first (locale-aware). The bundle runs
  // MessageFormat, so `{0}`/`{1}` placeholders are filled from `args`.
  let resolved = _formatMessage(defaultText, args);
  if (_bundle && i18nText) {
    const bundleText = _bundle.getText(i18nText, ...args);
    // When no translation exists, the bundle returns the key identifier as-is.
    // Compare against the bundle's internal key, not the JS export name.
    if (bundleText && bundleText !== i18nText.key) {
      resolved = bundleText;
    }
  }

  // Apply resolver override if set. The resolver receives no positional args, so
  // any `{0}`/`{1}` placeholders in the string it returns are filled here — the
  // same MessageFormat treatment the bundle/default paths above apply.
  if (_resolver) {
    try {
      const override = _resolver(key, _getLanguage(), resolved);
      if (typeof override === "string") return _formatMessage(override, args);
    } catch (err) {
      console.warn("[kiosk-keyboard] i18n resolver threw:", err);
      return resolved;
    }
  }

  return resolved;
}
