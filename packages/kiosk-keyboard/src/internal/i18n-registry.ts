import ResourceBundle from "sap/base/i18n/ResourceBundle";
import Localization from "sap/base/i18n/Localization";
import Lib from "sap/ui/core/Lib";
import Log from "sap/base/Log";
import type { KioskI18nConfig, KioskI18nOverrideContext, KioskI18nOverrideHook } from "../types";

const LOG_COMPONENT = "ui5.kiosk.KioskKeyboard";

function isStringArray(value: unknown[]): value is string[] {
  return value.every((item) => typeof item === "string");
}

let activeConfig: KioskI18nConfig | null = null;
let enhancementBundles: ResourceBundle[] | null = null;
let generation = 0;
let overrideHook: KioskI18nOverrideHook | null = null;
let pendingReload: Promise<void> | null = null;

function getCurrentLocale(): string {
  return Localization.getLanguageTag().toString();
}

function loadBundles(): Promise<void> {
  const loadGeneration = ++generation;
  const entries = activeConfig?.enhanceWith;
  if (!entries?.length) {
    enhancementBundles = [];
    return Promise.resolve();
  }
  const topSupportedLocales = activeConfig?.supportedLocales;
  const topFallbackLocale = activeConfig?.fallbackLocale;

  const promises = entries.map((entry) => {
    const createParams: Record<string, unknown> = {
      async: true,
      supportedLocales: entry.supportedLocales ?? topSupportedLocales,
      fallbackLocale: entry.fallbackLocale ?? topFallbackLocale,
    };
    if (entry.bundleName) {
      createParams.bundleName = entry.bundleName;
    } else {
      createParams.url = entry.bundleUrl;
    }

    return (ResourceBundle.create(createParams) as Promise<ResourceBundle>).catch((e): null => {
      Log.warning(
        `Failed to create i18n enhancement bundle (${entry.bundleName ?? entry.bundleUrl}): ${e}`,
        undefined,
        LOG_COMPONENT,
      );
      return null;
    });
  });

  return Promise.all(promises).then((results) => {
    if (loadGeneration !== generation) {
      return;
    }
    enhancementBundles = results.filter((b): b is ResourceBundle => b !== null);
  });
}

/**
 * Resolve a single i18n key through the full resolution chain:
 * base library bundle → enhancement bundles (last wins) → override hook.
 *
 * @param key       Resource bundle key (e.g. `"KIOSK_KEYBOARD_LABEL"`).
 * @param fallback  Hardcoded fallback returned when no bundle contains the key.
 * @returns The resolved text.
 */
export function getText(key: string, fallback: string): string {
  const bundle = Lib.getResourceBundleFor("ui5.kiosk");
  const baseText = bundle ? (bundle.getText(key, undefined, true) ?? fallback) : fallback;

  if (!activeConfig?.enhanceWith?.length && !overrideHook) {
    return baseText;
  }

  let resolved = baseText;

  if (enhancementBundles) {
    for (let i = enhancementBundles.length - 1; i >= 0; i--) {
      const enhanced = enhancementBundles[i].getText(key, undefined, true);
      if (enhanced != null) {
        resolved = enhanced;
        break;
      }
    }
  }

  if (overrideHook) {
    const locale = getCurrentLocale();
    const ctx: KioskI18nOverrideContext = {
      key,
      locale,
      defaultText: fallback,
      resolvedText: resolved,
    };
    try {
      const hooked = overrideHook(ctx);
      if (typeof hooked === "string") {
        resolved = hooked;
      }
    } catch (e) {
      Log.warning(`i18n override hook threw: ${e}`, undefined, LOG_COMPONENT);
    }
  }

  return resolved;
}

/** Sentinel returned by `configureI18n` when validation rejects the config. @internal */
export const VALIDATION_REJECTED: Promise<void> = Promise.resolve();

/**
 * Apply an i18n enhancement configuration.
 *
 * Validates the config, stores it, and asynchronously loads all
 * enhancement bundles.  Replaces any previous configuration.
 * Uses a generation counter to discard stale loads when
 * `configureI18n` is called again before a previous load completes.
 *
 * @param config  Enhancement bundle descriptors and locale metadata.
 * @returns Resolves when all enhancement bundles have been loaded
 *          (or `VALIDATION_REJECTED` when the config is invalid).
 */
export function configureI18n(config: KioskI18nConfig): Promise<void> {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    Log.warning("configureI18n: config must be a plain object.", undefined, LOG_COMPONENT);
    return VALIDATION_REJECTED;
  }

  if (config.enhanceWith !== undefined && !Array.isArray(config.enhanceWith)) {
    Log.warning("configureI18n: enhanceWith must be an array.", undefined, LOG_COMPONENT);
    return VALIDATION_REJECTED;
  }

  if (
    config.supportedLocales !== undefined &&
    (!Array.isArray(config.supportedLocales) || !isStringArray(config.supportedLocales))
  ) {
    Log.warning("configureI18n: supportedLocales must be an array of strings.", undefined, LOG_COMPONENT);
    return VALIDATION_REJECTED;
  }

  if (config.fallbackLocale !== undefined && typeof config.fallbackLocale !== "string") {
    Log.warning("configureI18n: fallbackLocale must be a string.", undefined, LOG_COMPONENT);
    return VALIDATION_REJECTED;
  }

  const validEntries = config.enhanceWith?.filter((entry) => {
    if (!entry || typeof entry !== "object") {
      Log.warning("configureI18n: enhancement entry must be an object.", undefined, LOG_COMPONENT);
      return false;
    }
    const hasBundleName = typeof entry.bundleName === "string" && entry.bundleName;
    const hasBundleUrl = typeof entry.bundleUrl === "string" && entry.bundleUrl;
    if (hasBundleName && hasBundleUrl) {
      Log.warning(
        "configureI18n: enhancement entry must have bundleName or bundleUrl, not both. Skipping.",
        undefined,
        LOG_COMPONENT,
      );
      return false;
    }
    if (!hasBundleName && !hasBundleUrl) {
      Log.warning(
        "configureI18n: enhancement entry must have bundleName or bundleUrl. Skipping.",
        undefined,
        LOG_COMPONENT,
      );
      return false;
    }
    if (
      entry.supportedLocales !== undefined &&
      (!Array.isArray(entry.supportedLocales) || !isStringArray(entry.supportedLocales))
    ) {
      Log.warning(
        "configureI18n: entry supportedLocales must be an array of strings. Skipping.",
        undefined,
        LOG_COMPONENT,
      );
      return false;
    }
    if (entry.fallbackLocale !== undefined && typeof entry.fallbackLocale !== "string") {
      Log.warning("configureI18n: entry fallbackLocale must be a string. Skipping.", undefined, LOG_COMPONENT);
      return false;
    }
    return true;
  });

  activeConfig = { ...config, enhanceWith: validEntries };
  enhancementBundles = null;
  pendingReload = null;

  return loadBundles();
}

/**
 * Reset to library defaults — clears all enhancement bundles and
 * increments the generation counter to cancel any in-flight loads.
 */
export function resetI18nConfiguration(): void {
  activeConfig = null;
  enhancementBundles = null;
  pendingReload = null;
  generation++;
}

/**
 * Register a programmatic override hook.
 *
 * The hook is called after base and enhancement bundle resolution.
 * Only one hook may be active; calling again replaces the previous one.
 *
 * @param hook  Override function. Return a string to replace, or
 *              `undefined` to keep the resolved text.
 */
export function setI18nOverrideHook(hook: KioskI18nOverrideHook): boolean {
  if (typeof hook !== "function") {
    Log.warning("setI18nOverrideHook: argument must be a function.", undefined, LOG_COMPONENT);
    return false;
  }
  overrideHook = hook;
  return true;
}

/** Remove the active i18n override hook, if any. */
export function clearI18nOverrideHook(): void {
  overrideHook = null;
}

/**
 * Reload all enhancement bundles for the current locale.
 *
 * Called on locale change (`onLocalizationChanged`).
 * Coalesces concurrent calls via a pending-promise guard.
 *
 * @returns Resolves when bundles are reloaded.
 */
export function reloadBundles(): Promise<void> {
  if (pendingReload) return pendingReload;
  enhancementBundles = null;

  if (!activeConfig?.enhanceWith?.length) {
    return Promise.resolve();
  }

  pendingReload = loadBundles().finally(() => {
    pendingReload = null;
  });
  return pendingReload;
}
