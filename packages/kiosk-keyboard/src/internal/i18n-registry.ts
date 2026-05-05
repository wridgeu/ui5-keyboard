import Lib from "sap/ui/core/Lib";
import Localization from "sap/base/i18n/Localization";
import Log from "sap/base/Log";
import type { I18nResolver } from "../types";

const LOG_COMPONENT = "ui5.kiosk.KioskKeyboard";

let resolver: I18nResolver | null = null;

function getCurrentLocale(): string {
  return Localization.getLanguageTag().toString();
}

/**
 * Resolve a single i18n key through the resolution chain:
 * base library bundle -> resolver callback.
 *
 * @param key       Resource bundle key (e.g. `"KIOSK_KEYBOARD_LABEL"`).
 * @param fallback  Hardcoded fallback returned when no bundle contains the key.
 * @returns The resolved text.
 */
export function getText(key: string, fallback: string): string {
  const bundle = Lib.getResourceBundleFor("ui5.kiosk");
  const baseText = bundle ? (bundle.getText(key, undefined, true) ?? fallback) : fallback;

  if (!resolver) {
    return baseText;
  }

  try {
    const override = resolver(key, getCurrentLocale(), baseText);
    if (typeof override === "string") {
      return override;
    }
  } catch (e) {
    Log.warning("i18n resolver threw", e instanceof Error ? e : String(e), LOG_COMPONENT);
  }

  return baseText;
}

/**
 * Set a custom i18n resolver callback for programmatic overrides.
 *
 * The resolver receives the i18n key, current locale, and the text resolved
 * from the base library bundle. Return a string to override, or `undefined`
 * to keep the base text.
 *
 * Only one resolver is active at a time. Calling again replaces the previous.
 * Pass `null` to clear the resolver.
 */
export function setI18nResolver(fn: I18nResolver | null): void {
  if (fn !== null && typeof fn !== "function") {
    Log.warning("setI18nResolver: argument must be a function or null.", undefined, LOG_COMPONENT);
    return;
  }
  resolver = fn;
}
