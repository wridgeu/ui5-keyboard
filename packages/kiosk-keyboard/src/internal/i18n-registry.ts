import ResourceBundle from "sap/base/i18n/ResourceBundle";
import Localization from "sap/base/i18n/Localization";
import Lib from "sap/ui/core/Lib";
import Log from "sap/base/Log";
import type { KioskI18nConfig, KioskI18nEnhancement, KioskI18nOverrideContext, KioskI18nOverrideHook } from "../types";

const LOG_COMPONENT = "ui5.kiosk.KioskKeyboard";
const VALIDATION_REJECTED_MESSAGE = "configureI18n: configuration validation failed.";

type ConfigureI18nResult = {
  accepted: boolean;
  promise: Promise<void>;
};

function isStringArray(value: readonly unknown[]): value is readonly string[] {
  return value.every((item) => typeof item === "string");
}

function cloneStringArray(value: readonly string[] | undefined): string[] | undefined {
  return value ? [...value] : undefined;
}

function createValidationRejectedPromise(): Promise<void> {
  const rejected = Promise.reject(new TypeError(VALIDATION_REJECTED_MESSAGE));
  // Keep fire-and-forget usage safe while still allowing callers to await/catch.
  void rejected.catch(() => undefined);
  return rejected;
}

function validateTopLevelConfig(config: unknown): string | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return "configureI18n: config must be a plain object.";
  }

  const candidate = config as KioskI18nConfig;
  if (candidate.enhanceWith !== undefined && !Array.isArray(candidate.enhanceWith)) {
    return "configureI18n: enhanceWith must be an array.";
  }

  if (
    candidate.supportedLocales !== undefined &&
    (!Array.isArray(candidate.supportedLocales) || !isStringArray(candidate.supportedLocales))
  ) {
    return "configureI18n: supportedLocales must be an array of strings.";
  }

  if (candidate.fallbackLocale !== undefined && typeof candidate.fallbackLocale !== "string") {
    return "configureI18n: fallbackLocale must be a string.";
  }

  return null;
}

let activeConfig: KioskI18nConfig | null = null;
let enhancementBundles: ResourceBundle[] | null = null;
let bundlesLoadedLocale: string | null = null;
let generation = 0;
let overrideHook: KioskI18nOverrideHook | null = null;
let pendingReload: Promise<void> | null = null;
let pendingReloadRequestedLocale: string | null = null;
const NO_RELOAD_NEEDED: Promise<void> = Promise.resolve();
const MAX_RELOAD_CYCLES = 5;

function getCurrentLocale(): string {
  return Localization.getLanguageTag().toString();
}

/**
 * Returns true when loaded enhancement bundles belong to a different
 * locale than the framework's current locale.  This happens when the
 * locale changes while no KioskKeyboard instances exist, so
 * `onLocalizationChanged` never fires and `reloadBundles` is not called.
 */
function areBundlesStale(): boolean {
  return bundlesLoadedLocale !== null && bundlesLoadedLocale !== getCurrentLocale();
}

function createEnhancementBundle(
  entry: KioskI18nEnhancement,
  createParams: Record<string, unknown>,
): Promise<ResourceBundle | null> {
  const onError = (error: unknown): null => {
    Log.warning(
      `Failed to create i18n enhancement bundle (${entry.bundleName ?? entry.bundleUrl}): ${error}`,
      undefined,
      LOG_COMPONENT,
    );
    return null;
  };

  try {
    const created = ResourceBundle.create(createParams) as ResourceBundle | Promise<ResourceBundle>;
    return Promise.resolve(created).catch(onError);
  } catch (e) {
    return Promise.resolve(onError(e));
  }
}

function loadBundles(): Promise<void> {
  const loadGeneration = ++generation;
  const entries = activeConfig?.enhanceWith;
  if (!entries?.length) {
    enhancementBundles = [];
    return NO_RELOAD_NEEDED;
  }
  // activeConfig is guaranteed non-null here: entries is non-empty,
  // and entries is derived from activeConfig.enhanceWith above.
  const topSupportedLocales = activeConfig!.supportedLocales;
  const topFallbackLocale = activeConfig!.fallbackLocale;

  const requestedLocale = getCurrentLocale();
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

    return createEnhancementBundle(entry, createParams);
  });

  return Promise.all(promises).then((results) => {
    if (loadGeneration !== generation) {
      return;
    }
    enhancementBundles = results.filter((b): b is ResourceBundle => b !== null);
    bundlesLoadedLocale = requestedLocale;
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
      if (enhanced !== null && enhanced !== undefined) {
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
      Log.warning(`i18n override hook threw: ${e instanceof Error ? e.message : String(e)}`, undefined, LOG_COMPONENT);
    }
  }

  return resolved;
}

function applyConfiguration(config: KioskI18nConfig): Promise<void> {
  const validEntries: KioskI18nEnhancement[] = [];
  for (const entry of config.enhanceWith ?? []) {
    if (!entry || typeof entry !== "object") {
      Log.warning("configureI18n: enhancement entry must be an object.", undefined, LOG_COMPONENT);
      continue;
    }

    const bundleName = typeof entry.bundleName === "string" ? entry.bundleName.trim() : undefined;
    const bundleUrl = typeof entry.bundleUrl === "string" ? entry.bundleUrl.trim() : undefined;
    const hasBundleName = Boolean(bundleName);
    const hasBundleUrl = Boolean(bundleUrl);

    if (hasBundleName && hasBundleUrl) {
      Log.warning(
        "configureI18n: enhancement entry must have bundleName or bundleUrl, not both. Skipping.",
        undefined,
        LOG_COMPONENT,
      );
      continue;
    }

    if (!hasBundleName && !hasBundleUrl) {
      Log.warning(
        "configureI18n: enhancement entry must have bundleName or bundleUrl. Skipping.",
        undefined,
        LOG_COMPONENT,
      );
      continue;
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
      continue;
    }

    if (entry.fallbackLocale !== undefined && typeof entry.fallbackLocale !== "string") {
      Log.warning("configureI18n: entry fallbackLocale must be a string. Skipping.", undefined, LOG_COMPONENT);
      continue;
    }

    const supportedLocales = cloneStringArray(entry.supportedLocales);
    const bundle: KioskI18nEnhancement = bundleName
      ? { bundleName, supportedLocales, fallbackLocale: entry.fallbackLocale }
      : { bundleUrl: bundleUrl!, supportedLocales, fallbackLocale: entry.fallbackLocale };
    validEntries.push(bundle);
  }

  if (config.enhanceWith?.length && validEntries.length === 0) {
    Log.warning(
      "configureI18n: all enhancement entries were invalid and skipped. Configuration has no effect.",
      undefined,
      LOG_COMPONENT,
    );
  }

  activeConfig = {
    supportedLocales: cloneStringArray(config.supportedLocales),
    fallbackLocale: config.fallbackLocale,
    enhanceWith: config.enhanceWith ? validEntries : undefined,
  };
  // Old bundles are invalid for the new config; null them so getText()
  // falls back to base-bundle text during the async load.  This differs
  // from reloadBundles(), which preserves stale bundles: on a locale
  // change the keys are still valid (just wrong language), so showing
  // stale enhanced text is better than dropping to the hardcoded fallback.
  enhancementBundles = null;
  bundlesLoadedLocale = null;
  pendingReload = null;
  pendingReloadRequestedLocale = null;

  return loadBundles();
}

/**
 * Apply an i18n enhancement configuration.
 *
 * Validates the config, stores it, and asynchronously loads all
 * enhancement bundles. Replaces any previous configuration.
 * Uses a generation counter to discard stale loads when
 * `configureI18n` is called again before a previous load completes.
 *
 * **Graceful degradation:** individual enhancement bundles that fail to
 * load (network error, wrong path) are silently skipped with a
 * `Log.warning`.  The returned promise still resolves — only top-level
 * validation failures cause a rejection.
 *
 * @param config  Enhancement bundle descriptors and locale metadata.
 * @returns Resolves when all enhancement bundles have been loaded
 *          (or individually failed), rejects when top-level validation fails.
 */
export function configureI18n(config: KioskI18nConfig): Promise<void> {
  return configureI18nWithStatus(config).promise;
}

/**
 * Configure i18n and return whether top-level validation accepted the config.
 * @internal
 */
export function configureI18nWithStatus(config: KioskI18nConfig): ConfigureI18nResult {
  const validationError = validateTopLevelConfig(config);
  if (validationError) {
    Log.warning(validationError, undefined, LOG_COMPONENT);
    return {
      accepted: false,
      promise: createValidationRejectedPromise(),
    };
  }

  return {
    accepted: true,
    promise: applyConfiguration(config),
  };
}

/** Returns true when enhancement bundles are currently configured. @internal */
export function hasConfiguredEnhancements(): boolean {
  return Boolean(activeConfig?.enhanceWith?.length);
}

/**
 * Returns a frozen deep copy of the active i18n configuration,
 * or `null` when no configuration has been applied.
 *
 * Intended for debugging, logging, and test assertions.
 * @internal
 */
export function getI18nConfiguration(): Readonly<KioskI18nConfig> | null {
  if (!activeConfig) return null;
  const copy: KioskI18nConfig = {
    supportedLocales: activeConfig.supportedLocales ? [...activeConfig.supportedLocales] : undefined,
    fallbackLocale: activeConfig.fallbackLocale,
    enhanceWith: activeConfig.enhanceWith
      ? activeConfig.enhanceWith.map((entry) => ({
          ...entry,
          supportedLocales: entry.supportedLocales ? [...entry.supportedLocales] : undefined,
        }))
      : undefined,
  };
  if (copy.supportedLocales) {
    Object.freeze(copy.supportedLocales);
  }
  if (copy.enhanceWith) {
    for (const entry of copy.enhanceWith) {
      if (entry.supportedLocales) {
        Object.freeze(entry.supportedLocales);
      }
      Object.freeze(entry);
    }
    Object.freeze(copy.enhanceWith);
  }
  return Object.freeze(copy);
}

/**
 * Reset to library defaults — clears all enhancement bundles and
 * increments the generation counter to cancel any in-flight loads.
 */
export function resetI18nConfiguration(): void {
  activeConfig = null;
  enhancementBundles = null;
  bundlesLoadedLocale = null;
  pendingReload = null;
  pendingReloadRequestedLocale = null;
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

/** Remove the active i18n override hook, if any. Returns true when a hook was actually removed. */
export function clearI18nOverrideHook(): boolean {
  if (!overrideHook) return false;
  overrideHook = null;
  return true;
}

/**
 * If enhancement bundles are configured but were loaded for a
 * different locale, trigger a reload.  Returns `NO_RELOAD_NEEDED`
 * when bundles are current, the reload promise otherwise.
 *
 * Called from `KioskKeyboard.init()` to cover the window where
 * the locale changed while no instances existed.
 * @internal
 */
export function reloadIfStale(): Promise<void> {
  if (!activeConfig?.enhanceWith?.length) return NO_RELOAD_NEEDED;
  if (!areBundlesStale()) return NO_RELOAD_NEEDED;
  return reloadBundles();
}

/**
 * Reload all enhancement bundles for the current locale.
 *
 * Called on locale change (`onLocalizationChanged`) and from
 * `reloadIfStale` when stale bundles are detected at init time.
 * Coalesces concurrent calls via a pending-promise guard.
 *
 * @returns Resolves when bundles are reloaded.
 */
export function reloadBundles(): Promise<void> {
  if (!activeConfig?.enhanceWith?.length) {
    return NO_RELOAD_NEEDED;
  }

  pendingReloadRequestedLocale = getCurrentLocale();
  if (pendingReload) {
    return pendingReload;
  }

  // The IIFE executes synchronously up to the first `await`, then
  // yields — by which point `pendingReload = reloadPromise` (below)
  // has already run.  The definite-assignment assertion (`!`) avoids
  // a TS2454 error in the detach guard inside the loop body.
  let reloadPromise!: Promise<void>;
  reloadPromise = (async () => {
    let cycles = 0;
    while (activeConfig?.enhanceWith?.length) {
      if (++cycles > MAX_RELOAD_CYCLES) {
        Log.warning(
          `reloadBundles: exceeded ${MAX_RELOAD_CYCLES} reload cycles (locale churn). Aborting.`,
          undefined,
          LOG_COMPONENT,
        );
        break;
      }

      const localeAtLoopStart: string | null = pendingReloadRequestedLocale;
      // Keep stale bundles in place — loadBundles() overwrites them
      // atomically (guarded by the generation counter), so getText()
      // keeps returning enhancement text during the async load.
      await loadBundles();

      // configureI18n/resetI18nConfiguration can detach an in-flight reload
      // by nulling pendingReload. Abort immediately so a detached loop cannot
      // start another cycle and invalidate a newer configureI18n load.
      if (pendingReload !== reloadPromise) {
        return;
      }

      // Catch up with locale churn: if locale changed while this load was in
      // flight, run one more reload cycle. Loop until latest requested locale
      // matches the locale at the start of a completed cycle.
      if (pendingReloadRequestedLocale === localeAtLoopStart) {
        break;
      }
    }
  })();

  pendingReload = reloadPromise;

  void reloadPromise.finally(() => {
    // configureI18n/resetI18nConfiguration can detach an in-flight reload by
    // nulling pendingReload. Only clear module state if this promise is still
    // the active one.
    if (pendingReload === reloadPromise) {
      pendingReload = null;
      pendingReloadRequestedLocale = null;
    }
  });

  return reloadPromise;
}
