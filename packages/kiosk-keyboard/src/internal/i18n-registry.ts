import ResourceBundle from "sap/base/i18n/ResourceBundle";
import Localization from "sap/base/i18n/Localization";
import Lib from "sap/ui/core/Lib";
import Log from "sap/base/Log";
import type { KioskI18nConfig, KioskI18nOverrideContext, KioskI18nOverrideHook } from "../types";

const LOG_COMPONENT = "ui5.kiosk.KioskKeyboard";

let activeConfig: KioskI18nConfig | null = null;
let enhancementBundles: ResourceBundle[] | null = null;
let generation = 0;
let overrideHook: KioskI18nOverrideHook | null = null;

function getCurrentLocale(): string {
  return Localization.getLanguage() || "en";
}

function loadBundles(): Promise<void> {
  const entries = activeConfig?.enhanceWith;
  if (!entries?.length) {
    enhancementBundles = [];
    return Promise.resolve();
  }

  const loadGeneration = ++generation;
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

export function getText(key: string, fallback: string): string {
  const bundle = Lib.getResourceBundleFor("ui5.kiosk");
  const baseText = bundle ? (bundle.getText(key, undefined, true) ?? fallback) : fallback;

  if (!activeConfig && !overrideHook) {
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

export function configureI18n(config: KioskI18nConfig): Promise<void> {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    Log.warning("configureI18n: config must be a plain object.", undefined, LOG_COMPONENT);
    return Promise.resolve();
  }

  if (config.enhanceWith !== undefined && !Array.isArray(config.enhanceWith)) {
    Log.warning("configureI18n: enhanceWith must be an array.", undefined, LOG_COMPONENT);
    return Promise.resolve();
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
    return true;
  });

  activeConfig = { ...config, enhanceWith: validEntries };
  enhancementBundles = null;

  return loadBundles();
}

export function resetI18nConfiguration(): void {
  activeConfig = null;
  enhancementBundles = null;
  generation++;
}

export function setI18nOverrideHook(hook: KioskI18nOverrideHook): void {
  if (typeof hook !== "function") {
    Log.warning("setI18nOverrideHook: argument must be a function.", undefined, LOG_COMPONENT);
    return;
  }
  overrideHook = hook;
}

export function clearI18nOverrideHook(): void {
  overrideHook = null;
}

export function reloadBundles(): Promise<void> {
  enhancementBundles = null;

  if (!activeConfig?.enhanceWith?.length) {
    return Promise.resolve();
  }

  return loadBundles();
}
