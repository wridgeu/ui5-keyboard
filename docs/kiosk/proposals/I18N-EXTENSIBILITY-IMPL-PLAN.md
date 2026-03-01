# Implementation Plan: i18n Extensibility for `ui5.kiosk`

Based on the [I18N-EXTENSIBILITY proposal](./I18N-EXTENSIBILITY.md).
Incorporates findings from a colleague's plan (merged and superseded).

---

## 1. Scope

Add four static methods to `KioskKeyboard` that let consumers extend and
override the keyboard's translatable texts without modifying the library
package. Keep the existing `getText()` contract (synchronous, always
returns a string), keep rendering deterministic, and keep backward
compatibility when none of the new APIs are called.

New public surface:

| Method                     | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| `configureI18n(config)`    | Declare enhancement bundles + locale metadata |
| `resetI18nConfiguration()` | Restore config defaults (FLP / test cleanup)  |
| `setI18nOverrideHook(fn)`  | Register a programmatic per-key text override |
| `clearI18nOverrideHook()`  | Remove the override hook                      |

`configureI18n` returns `Promise<void>`. Enhancement bundles are
loaded asynchronously to avoid the sync `ResourceBundle.create`
deprecation (since UI5 1.135). Consumers can `await` for guaranteed
bundle availability, or fire-and-forget — the control re-renders
automatically when bundles finish loading.

No new control properties, events, or aggregations.

### 1.1 Minimum Version Constraint

The library targets **UI5 1.118** as its minimum supported version.
All APIs used in this feature must be available at 1.118 or have a
documented fallback. Key implications:

- `Localization.attachChange` / `detachChange` (since 1.120) — **not
  used**. Language change detection uses the `onLocalizationChanged`
  control lifecycle hook instead (available since earliest UI5 versions).
- `Localization.getLanguageTag()` / `getLanguage()` (since 1.120) —
  **not used** in library source. The hook context's `locale` field
  uses a version-safe utility (see section 8.8).
- Async `ResourceBundle.create({ async: true })` — available since
  well before 1.118. No version concern.

---

## 2. File Map

All paths relative to `packages/kiosk-keyboard/`.

| File                                      | Action  | Purpose                                                               |
| ----------------------------------------- | ------- | --------------------------------------------------------------------- |
| `src/types.ts`                            | modify  | Export i18n config/hook/context types                                 |
| `src/internal/i18n-registry.ts`           | **new** | Full resolution logic, config/hook storage, async loading, validation |
| `src/internal/i18n.ts`                    | modify  | Thin facade — delegates to registry                                   |
| `src/KioskKeyboard.ts`                    | modify  | Static facade methods + `onLocalizationChanged` hook                  |
| `test/qunit/i18n-registry.qunit.ts`       | **new** | Registry unit tests                                                   |
| `test/qunit/KioskKeyboard.qunit.ts`       | modify  | Integration tests for rendered labels/ARIA with i18n config           |
| `test/qunit/negative-edge-cases.qunit.ts` | modify  | Negative i18n API coverage                                            |
| `test/qunit/testsuite.qunit.ts`           | modify  | Register new test module                                              |

No new public re-export module. All API goes through `KioskKeyboard`
static methods.

---

## 3. Types

Add to `src/types.ts`. Uses a discriminated union with `never` for
compile-time `bundleName` xor `bundleUrl` enforcement, and `readonly`
on all config properties to prevent mutation after handover.

```ts
/**
 * A single enhancement bundle descriptor.
 *
 * Exactly one of `bundleName` or `bundleUrl` is required.
 * `bundleName` follows the UI5 module-path convention
 * (e.g. `"my.app.i18n.kiosk"`).
 */
export type KioskI18nEnhancement =
  | {
      readonly bundleName: string;
      readonly bundleUrl?: never;
      readonly supportedLocales?: readonly string[];
      readonly fallbackLocale?: string;
    }
  | {
      readonly bundleName?: never;
      readonly bundleUrl: string;
      readonly supportedLocales?: readonly string[];
      readonly fallbackLocale?: string;
    };

/**
 * Configuration object for {@link KioskKeyboard.configureI18n}.
 */
export interface KioskI18nConfig {
  /**
   * Locales that the enhancement bundles provide translations for.
   * Applies as default `supportedLocales` for enhancement entries
   * that do not declare their own.
   *
   * Does **not** reconfigure the base library bundle — its locale
   * list is determined by shipped `.properties` files.
   */
  readonly supportedLocales?: readonly string[];

  /**
   * Default fallback locale for enhancement entries that do not
   * declare their own.
   */
  readonly fallbackLocale?: string;

  /**
   * Additional resource bundles whose texts take precedence over
   * the base library bundle.  Evaluated in array order; the last
   * entry that provides a given key wins.
   */
  readonly enhanceWith?: readonly KioskI18nEnhancement[];
}

/**
 * Context passed to the i18n override hook.
 */
export interface KioskI18nOverrideContext {
  /** The message key (e.g. `"KIOSK_KEYBOARD_LABEL"`). */
  readonly key: string;
  /**
   * Current locale string (BCP47 format, e.g. `"de"`, `"en-US"`).
   * Derived via a version-safe utility — see implementation notes.
   */
  readonly locale: string;
  /** Hardcoded fallback passed by the call site. */
  readonly defaultText: string;
  /**
   * Text resolved through the full bundle chain
   * (base + enhancements) *before* the hook runs.
   */
  readonly resolvedText: string;
}

/**
 * Override hook signature.
 *
 * Return a string to replace `resolvedText`.
 * Return `undefined` to keep the resolved text as-is.
 */
export type KioskI18nOverrideHook = (ctx: KioskI18nOverrideContext) => string | undefined;
```

Design notes:

- `readonly` prevents accidental mutation of config after handover to
  the registry.
- The discriminated union (`bundleName` xor `bundleUrl`) catches
  misconfiguration at compile time for TS consumers. Runtime
  validation still guards JS consumers.
- `interface` for shapes (`KioskI18nConfig`, `KioskI18nOverrideContext`),
  `type` for unions and function signatures — follows TS conventions.

---

## 4. Internal Registry — `src/internal/i18n-registry.ts`

Blueprint: `internal/layout-registry.ts`. Owns all resolution logic;
`i18n.ts` becomes a thin import-stable facade.

### 4.1 State

```ts
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import Lib from "sap/ui/core/Lib";
import Log from "sap/base/Log";
import type { KioskI18nConfig, KioskI18nOverrideContext, KioskI18nOverrideHook } from "../types";

const LOG_COMPONENT = "ui5.kiosk.KioskKeyboard";

/** Validated snapshot of the last configureI18n() call. */
let activeConfig: KioskI18nConfig | null = null;

/** Loaded enhancement ResourceBundle instances (null = not yet loaded). */
let enhancementBundles: ResourceBundle[] | null = null;

/**
 * Monotonically increasing counter.  Incremented on every config
 * change or locale reload.  Prevents stale async loads from
 * overwriting newer state.
 */
let generation = 0;

/** Consumer-supplied override hook (at most one). */
let overrideHook: KioskI18nOverrideHook | null = null;
```

No `Localization` import — the registry does not depend on APIs
introduced after 1.118 (see section 1.1).

### 4.2 Exported Functions

```ts
// ── Public (delegated from KioskKeyboard static facade) ──
export function configureI18n(config: KioskI18nConfig): Promise<void>;
export function resetI18nConfiguration(): void;
export function setI18nOverrideHook(hook: KioskI18nOverrideHook): void;
export function clearI18nOverrideHook(): void;

// ── Internal (consumed by i18n.ts facade) ──
export function getText(key: string, fallback: string): string;

// ── Internal (consumed by onLocalizationChanged) ──
export function reloadBundles(): Promise<void>;
```

### 4.3 `getText` — Full Resolution Owned by Registry

The registry owns the complete lookup. `i18n.ts` delegates entirely.
`getText` is a **pure synchronous read** — it never triggers bundle
loading. It reads whatever `enhancementBundles` are available (which
may be `null` during the loading gap after `configureI18n` or a
locale change).

```ts
export function getText(key: string, fallback: string): string {
  // Base bundle (UI5 library bundle)
  const bundle = Lib.getResourceBundleFor("ui5.kiosk");
  const baseText = bundle ? (bundle.getText(key, undefined, true) ?? fallback) : fallback;

  // Short-circuit: no config and no hook → zero overhead path
  if (!activeConfig && !overrideHook) {
    return baseText;
  }

  let resolved = baseText;

  // Enhancement bundles (last entry wins) — only if already loaded
  if (enhancementBundles) {
    for (let i = enhancementBundles.length - 1; i >= 0; i--) {
      const enhanced = enhancementBundles[i].getText(key, undefined, true);
      if (enhanced != null) {
        resolved = enhanced;
        break;
      }
    }
  }

  // Override hook (final say)
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
```

Resolution order matches the proposal:

1. **Base library bundle** — `Lib.getResourceBundleFor("ui5.kiosk")`.
2. **Enhancement bundles** — iterated in reverse; first hit from the
   end wins. Skipped if bundles are still loading (`null`).
3. **Override hook** — may replace or keep the resolved text.
4. **Hardcoded fallback** — the caller's `fallback` parameter, used
   when the base bundle has no entry.

During the brief loading gap after `configureI18n()` or a locale
change, the resolution chain gracefully degrades: base bundle and
override hook remain available, only enhancement texts are temporarily
absent. Once the async load completes, the control re-renders with
the full chain.

### 4.4 `configureI18n` — Validation and Async Loading

Follow existing kiosk DX: `Log.warning` + skip for recoverable issues,
never throw.

1. `config` must be a plain object — reject `null`, arrays, primitives.
2. If `enhanceWith` is present, it must be an array.
3. Each enhancement entry must have exactly one of `bundleName` or
   `bundleUrl` (not both, not neither). Skip invalid entries.
4. `supportedLocales` / `fallbackLocale`, if present, must be
   string-array / string.

After validation, store a **shallow copy** of the config (to prevent
caller-side mutation), clear stale bundles, increment the generation
counter, and trigger async bundle loading.

```ts
export function configureI18n(config: KioskI18nConfig): Promise<void> {
  // ... validation (see above) ...

  activeConfig = { ...config }; // shallow copy
  enhancementBundles = null; // clear stale

  return loadBundles();
}
```

A deep freeze is unnecessary — `readonly` types guard TS consumers,
and the layout-registry stores definitions by reference without
freezing. Keeping the same pattern here avoids inconsistency.

#### `setI18nOverrideHook` — Validation

Validate that the argument is a `function`. If not (e.g. `null`,
`undefined`, non-function), log a warning and ignore the call. This
protects JS consumers where the TS signature is not enforced.

### 4.5 Enhancement Bundle Creation (async, eager)

Bundles are created **eagerly** in `configureI18n()` and on locale
change, using `ResourceBundle.create({ async: true })`. A monotonic
generation counter prevents stale loads from overwriting newer state.

```ts
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
    // Build config conditionally to avoid passing undefined keys
    if (entry.bundleName) {
      createParams.bundleName = entry.bundleName;
    } else {
      createParams.url = entry.bundleUrl;
    }

    return (ResourceBundle.create(createParams) as Promise<ResourceBundle>).catch((e): null => {
      Log.warning(
        `Failed to create i18n enhancement bundle` + ` (${entry.bundleName ?? entry.bundleUrl}): ${e}`,
        undefined,
        LOG_COMPONENT,
      );
      return null; // failed bundle → excluded from chain
    });
  });

  return Promise.all(promises).then((results) => {
    // Guard: discard if a newer config/reload has started
    if (loadGeneration !== generation) {
      return;
    }
    enhancementBundles = results.filter((b): b is ResourceBundle => b !== null);
  });
}
```

Design choices:

- **Async `ResourceBundle.create({ async: true })`** — avoids the
  sync deprecation (since UI5 1.135). Async `ResourceBundle.create`
  has been available since well before 1.118 — no version concern.

  For **`bundleName`** bundles that are already in the preload cache
  (typical for component-preloaded consumer bundles), the Promise
  resolves in the next microtask — the loading gap is invisible.

  For **`bundleUrl`** bundles loaded over the network, there is a
  brief gap where the control renders with base-bundle text. Once
  the load completes, the facade triggers a re-render that picks up
  the enhanced text. This is the standard async pattern for any
  resource loading.

- **Generation counter** — prevents a classic async race: if the
  consumer calls `configureI18n` twice rapidly, only the latest
  load's results are stored. Earlier loads that resolve later are
  silently discarded.

- **`Promise.all` + `catch` per entry** — one broken bundle does not
  block or break the chain. Failed entries are filtered out.

- **Conditional config object** — avoids passing `bundleName:
undefined` or `url: undefined` to `ResourceBundle.create`.

### 4.6 `resetI18nConfiguration`

Resets enhancement config only. Does **not** clear the override hook —
they are independent concerns. FLP cleanup calls both explicitly.

Increments the generation counter to invalidate any in-flight async
loads from the previous config.

```ts
export function resetI18nConfiguration(): void {
  activeConfig = null;
  enhancementBundles = null;
  generation++;
}
```

### 4.7 `reloadBundles`

Exposed internally for the `onLocalizationChanged` hook. Clears the
current enhancement cache and re-creates bundles for the new locale.

```ts
export function reloadBundles(): Promise<void> {
  enhancementBundles = null;

  if (!activeConfig?.enhanceWith?.length) {
    return Promise.resolve();
  }

  return loadBundles();
}
```

When no config is active, this is a no-op.

---

## 5. Thin Facade — `src/internal/i18n.ts`

```ts
/**
 * Resolves an i18n key from the `ui5.kiosk` library resource bundle,
 * optionally enhanced by consumer-configured bundles and override hooks.
 *
 * Falls back to `sDefault` when the key is missing from all bundles.
 */
export { getText } from "./i18n-registry";
```

The module keeps its existing path so all current callers
(`KioskKeyboard.ts`, `KioskKeyboardRenderer.ts`) continue to import
from `"./internal/i18n"` without changes. The registry owns the full
implementation.

The JSDoc on the re-export updates the description to reflect the new
behavior while preserving import-site documentation for consumers of
the internal module.

---

## 6. Static Facade on `KioskKeyboard`

Add to `src/KioskKeyboard.ts`, in a new section header block after the
layout-registry facade. All four methods invalidate live instances
via `KioskKeyboard._instances`.

```ts
// ──────────────────────────────────────────────
// Static delegates — i18n registry (see internal/i18n-registry.ts)
// ──────────────────────────────────────────────

/**
 * Configure i18n enhancement bundles and locale metadata.
 *
 * Enhancement bundles provide additional or overriding translations
 * for the keyboard's built-in text keys.  Useful for adding support
 * for locales not shipped with the library, or for tenant-specific
 * wording.
 *
 * Replaces any previous configuration (not incremental).
 *
 * Enhancement bundles are loaded asynchronously.  The returned
 * Promise resolves when all bundles are ready.  The control
 * renders immediately with base-bundle text, then re-renders
 * when enhancements are available.
 *
 * Call {@link resetI18nConfiguration} and
 * {@link clearI18nOverrideHook} in `Component.destroy()` to prevent
 * cross-app leakage in FLP scenarios.
 *
 * @param config  Enhancement bundle descriptors and locale metadata.
 * @returns Resolves when all enhancement bundles are loaded.
 * @since 1.x.0
 * @public
 * @static
 */
static configureI18n(config: KioskI18nConfig): Promise<void> {
  // Immediate invalidation — clears stale enhancement texts
  KioskKeyboard._invalidateAllInstances();

  const loaded = registryConfigureI18n(config);

  // Deferred invalidation — picks up newly loaded enhancements
  void loaded.then(() => KioskKeyboard._invalidateAllInstances());

  return loaded;
}

/**
 * Reset i18n enhancement configuration to library defaults.
 *
 * Clears all enhancement bundles and cancels any in-flight bundle
 * loads.  Does not affect the override hook — call
 * {@link clearI18nOverrideHook} separately if needed.
 *
 * @since 1.x.0
 * @public
 * @static
 */
static resetI18nConfiguration(): void {
  registryResetI18n();
  KioskKeyboard._invalidateAllInstances();
}

/**
 * Register a programmatic override hook for resolved i18n texts.
 *
 * The hook runs after the base bundle and all enhancement bundles
 * have been consulted.  Return a string to replace the resolved
 * text, or `undefined` to keep it.
 *
 * Only one hook is active at a time.  Calling this method again
 * replaces the previous hook.
 *
 * @param fn  The override function.
 * @since 1.x.0
 * @public
 * @static
 */
static setI18nOverrideHook(fn: KioskI18nOverrideHook): void {
  registrySetOverrideHook(fn);
  KioskKeyboard._invalidateAllInstances();
}

/**
 * Remove the i18n override hook.
 *
 * @since 1.x.0
 * @public
 * @static
 */
static clearI18nOverrideHook(): void {
  registryClearOverrideHook();
  KioskKeyboard._invalidateAllInstances();
}

/** Invalidate all living KioskKeyboard instances to pick up i18n changes. */
private static _invalidateAllInstances(): void {
  for (const instance of KioskKeyboard._instances) {
    instance.invalidate();
  }
}
```

Import aliases follow the existing convention:

```ts
import {
  configureI18n as registryConfigureI18n,
  resetI18nConfiguration as registryResetI18n,
  setI18nOverrideHook as registrySetOverrideHook,
  clearI18nOverrideHook as registryClearOverrideHook,
  reloadBundles as registryReloadBundles,
} from "./internal/i18n-registry";
```

### `configureI18n` — Double Invalidation

The facade performs two invalidations:

1. **Immediate** (sync) — clears stale enhancement texts from the
   previous config. The next render uses base-bundle-only text.
2. **Deferred** (after Promise) — picks up the newly loaded
   enhancements. The control re-renders with the full chain.

For `bundleName` bundles in the preload cache, the Promise resolves
in the next microtask — before the browser paints. The two
invalidations are batched by UI5 into a single render, so the
loading gap is invisible.

For `bundleUrl` bundles loaded over the network, there is a brief
flash of base text. This is acceptable and consistent with how
any async resource loading works in UI5.

---

## 7. UI5 and FLP Lifecycle

### 7.1 Language Change — `onLocalizationChanged` Hook

When UI5's language changes at runtime, enhancement bundles must be
re-created for the new locale and live controls must re-render so
labels and ARIA text update.

Strategy: implement the `onLocalizationChanged` lifecycle hook on
`KioskKeyboard`. This hook is called by the UI5 framework on every
Element/Control when `setLanguage` is invoked. It is explicitly
documented in the `Localization.setLanguage` API docs:

> _"Elements or Controls that implement the `onLocalizationChanged`
> hook"_

This hook is available since earliest UI5 versions — well before 1.118.
It does **not** require importing `sap/base/i18n/Localization`.

```ts
// In KioskKeyboard.ts — instance method

/**
 * Called by UI5 framework when the language/locale changes.
 * Re-creates enhancement bundles for the new locale and
 * triggers a re-render.
 *
 * Note: not formally typed on sap.ui.core.Control — this is
 * a convention-based lifecycle hook (duck typing).
 */
onLocalizationChanged(): void {
  // Trigger async reload of enhancement bundles.
  // reloadBundles() is a no-op when no config is active.
  void registryReloadBundles().then(() => {
    // Guard: instance may have been destroyed during async gap
    if (!this.bIsDestroyed) {
      KioskKeyboard._invalidateAllInstances();
    }
  });

  // Immediate invalidation so base-bundle text updates now
  this.invalidate();
}
```

Advantages over `Localization.attachChange`:

- **1.118 compatible** — no dependency on 1.120+ APIs.
- **Per-instance** — no static listener management, no ref-counting,
  no attach/detach in `init()`/`exit()`.
- **Idiomatic** — this is the canonical UI5 pattern for controls
  reacting to locale changes.

**Multiple instances:** If N keyboards exist, `onLocalizationChanged`
is called N times. Each call triggers `registryReloadBundles()`. The
generation counter (section 4.5) deduplicates: the first call
increments `generation` and starts loading; subsequent calls see the
same `generation` and start new loads that resolve to the same result.
Only the latest generation's result is stored.

**Behavior change note:** This is a **new behavior** — previously,
the keyboard did not react to locale changes and labels would only
update on the next natural re-render. This is a correctness
improvement (labels and ARIA text stay in sync with the active
language) but should be acknowledged in release notes.

### 7.2 FLP — Recommended Consumer Pattern

```ts
// Component.ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";

export default class Component extends UIComponent {
  async init(): Promise<void> {
    super.init();
    // Fire-and-forget is fine — the keyboard renders with base text
    // immediately, then re-renders when enhancement bundles load.
    KioskKeyboard.configureI18n({
      enhanceWith: [{ bundleName: "my.app.i18n.kiosk" }],
    });

    // Or await if guaranteed bundle availability matters:
    // await KioskKeyboard.configureI18n({
    //   enhanceWith: [{ bundleName: "my.app.i18n.kiosk" }],
    // });
  }

  destroy(): void {
    KioskKeyboard.clearI18nOverrideHook();
    KioskKeyboard.resetI18nConfiguration();
    super.destroy();
  }
}
```

### 7.3 Library-Side Safety

- `resetI18nConfiguration()` clears config only.
  `clearI18nOverrideHook()` clears the hook only.
  They are independent concerns — a consumer may want to change their
  enhancement bundles without losing their hook, or vice versa.
- Both are **idempotent** — calling either twice is harmless.
- `resetI18nConfiguration()` increments the generation counter,
  ensuring any in-flight async loads from the previous config are
  discarded when they resolve.
- Bundle cache is released on reset, allowing GC of `ResourceBundle`
  instances.
- All four API methods invalidate live instances.

### 7.4 `configureI18n` Replaces, Not Merges

Calling `configureI18n()` a second time fully replaces the previous
configuration. There is no incremental "add one more bundle" API.

Rationale:

- Keeps the mental model simple (config = current state, not a history
  of patches).
- Avoids ordering ambiguities when multiple callers configure
  independently.
- Mirrors how UI5's own `manifest.json` `i18n` section works — a
  declaration, not a delta.

If a consumer needs to build up the config incrementally, they can
maintain their own array and call `configureI18n` once with the
complete list.

---

## 8. Edge Cases and Defensive Behaviour

### 8.1 Missing Bundle Files

If an enhancement bundle URL or name does not resolve to an actual
`.properties` file, `ResourceBundle.create()` will either reject or
return a bundle that answers every key with `undefined`. Both cases
are handled:

- The `.catch()` in `loadBundles()` catches rejections. Failed
  entries are filtered out of the result array.
- `getText(key, undefined, true)` returning `null`/`undefined` is
  treated as "this bundle has no opinion" and the next bundle (or
  base) is used.

The keyboard never renders blank labels.

### 8.2 Override Hook Throws

The hook call is wrapped in `try/catch`. If the hook throws, a
warning is logged and `resolvedText` (pre-hook) is used.

### 8.3 Override Hook Returns Empty String

An empty string `""` is a valid override. The consumer might
intentionally want to suppress a label. The existing hardcoded
fallback in the renderer (`getText("KEY", "Fallback")`) runs upstream,
so `resolvedText` is already non-empty. If the hook returns `""`,
that is respected.

### 8.4 `configureI18n({})` — Empty Config

Valid. No enhancement bundles are created (`loadBundles` short-circuits
with an empty array). The resolution chain runs but only the base
bundle and a potential hook are consulted.

### 8.5 Rapid Sequential `configureI18n` Calls

Because loading is async, a consumer might call `configureI18n` twice
before the first load completes. The generation counter handles this:

1. First call: `generation` becomes 1, starts loading config A.
2. Second call: `generation` becomes 2, clears stale bundles, starts
   loading config B.
3. Config A resolves: `loadGeneration (1) !== generation (2)` → result
   is silently discarded.
4. Config B resolves: `loadGeneration (2) === generation (2)` → result
   is stored and instances are re-rendered.

The last call always wins. No locking or debouncing needed.

### 8.6 Bundle Load Failure Deduplication

`loadBundles()` logs a warning per failed bundle per load cycle.
Since loads only happen on config or locale change (not every render),
warning spam is bounded.

### 8.7 `setI18nOverrideHook(null)` / Non-Function Argument

Log a warning and ignore. Do not set `overrideHook` to a non-function
value. TS consumers are guarded by the type signature; this protects
JS consumers.

### 8.8 Locale String for Hook Context — Version-Safe Utility

The override hook context needs a `locale` string. Since
`Localization.getLanguageTag()` requires 1.120 and the library targets
1.118, use a version-safe utility:

```ts
function getCurrentLocale(): string {
  // navigator.language reflects the browser's BCP47 locale.
  // This is the same source UI5 auto-detects from when no explicit
  // sap-language is configured.
  //
  // Caveat: when the app sets sap-language=XX explicitly,
  // navigator.language won't reflect it.  For the hook context
  // this is acceptable — the locale field is informational, and
  // apps with explicit language requirements should use the hook's
  // key/resolvedText fields for decision-making, not the locale.
  return navigator.language || "en";
}
```

The caveat is consistent with the backward compat proposal for
`getLocaleLayout()`, which uses the same `navigator.language` approach.

If the backward compat work is not done and the library's effective
minimum remains 1.120+ at implementation time, `Localization
.getLanguageTag().toString()` can be used instead. The utility is
easily swapped.

### 8.9 `loadBundles` Passes Conditional Properties

When an enhancement entry uses `bundleUrl`, the config object passed
to `ResourceBundle.create` only includes `url` (not `bundleName`),
and vice versa. This is handled by conditionally building the config
object in `loadBundles()` (section 4.5).

---

## 9. Testing

### 9.1 New file: `test/qunit/i18n-registry.qunit.ts`

Structure mirrors `layout-registry.qunit.ts`.

```
i18n-registry — configureI18n validation
  ├─ Accepts valid config with enhanceWith
  ├─ Accepts config without enhanceWith (locale-only)
  ├─ Rejects non-object config (null, array, string)
  ├─ Rejects enhancement entry with neither bundleName nor bundleUrl
  ├─ Rejects enhancement entry with both bundleName and bundleUrl
  ├─ Skips invalid entries, keeps valid ones
  └─ Logs warning for invalid entries

i18n-registry — async bundle loading
  ├─ configureI18n returns a Promise that resolves after loading
  ├─ getText returns base text while bundles are loading
  ├─ getText returns enhanced text after Promise resolves
  ├─ Rapid reconfiguration: only latest generation is stored
  ├─ resetI18nConfiguration cancels in-flight loads (generation guard)
  └─ reloadBundles re-creates bundles for current locale

i18n-registry — enhancement bundle precedence
  ├─ Base bundle text used when no enhancements configured
  ├─ Single enhancement overrides base bundle text
  ├─ Last enhancement wins when multiple provide same key
  ├─ Enhancement that does not provide a key falls through to base
  └─ Enhancement bundle error does not break resolution

i18n-registry — override hook
  ├─ Hook receives correct context (key, locale, defaultText, resolvedText)
  ├─ Hook return replaces resolved text
  ├─ Hook returning undefined keeps resolved text
  ├─ Hook runs after enhancement resolution
  ├─ Hook error is caught, resolved text used
  ├─ setI18nOverrideHook replaces previous hook
  ├─ setI18nOverrideHook rejects non-function (null, string, number)
  └─ clearI18nOverrideHook removes hook

i18n-registry — resetI18nConfiguration
  ├─ Clears enhancement bundles
  ├─ Does NOT clear override hook
  ├─ Subsequent getText returns base bundle text only
  ├─ Idempotent — double reset does not error
  └─ New configureI18n after reset works correctly

i18n-registry — KioskKeyboard facade
  ├─ Static configureI18n returns Promise
  ├─ Static configureI18n performs double invalidation (immediate + deferred)
  ├─ Static resetI18nConfiguration clears config state
  ├─ Static setI18nOverrideHook / clearI18nOverrideHook round-trip
  ├─ getText reflects facade-configured enhancements (after await)
  └─ All four methods invalidate live instances

i18n-registry — onLocalizationChanged
  ├─ Triggers bundle reload
  ├─ Invalidates instance immediately
  ├─ Re-renders with enhanced text after reload completes
  └─ No-op when no config is active

i18n-registry — FLP lifecycle simulation
  ├─ Configure + hook in init, cleanup in destroy, next app sees defaults
  └─ Override hook does not leak across simulated app sessions
```

### 9.2 Integration Tests — Existing Files

**`KioskKeyboard.qunit.ts`** — add:

- Root `aria-label` and `aria-roledescription` reflect enhancement text
  after `await configureI18n(...)`.
- Special key labels (`Shift`, `Enter`, `Backspace`) reflect
  enhancement text.
- Override hook can change `KIOSK_KEYBOARD_LABEL` on a rendered
  control.
- Clearing hook restores non-overridden behaviour.
- Language switch re-renders existing control labels (not only new
  instances).

**`negative-edge-cases.qunit.ts`** — add:

- `configureI18n(null)` logs warning, no crash.
- `configureI18n("string")` logs warning, no crash.
- `configureI18n({ enhanceWith: [{}] })` skips invalid entry with
  neither `bundleName` nor `bundleUrl`.
- `configureI18n({ enhanceWith: [{ bundleName: "x", bundleUrl: "y" }] })`
  skips entry with both.
- `setI18nOverrideHook(null)` logs warning, does not set hook.
- `setI18nOverrideHook(42)` logs warning, does not set hook.
- Cleanup in `afterEach` — verify no leftover config/hook.

### 9.3 Test Helpers

Stub `ResourceBundle.create` via sinon to return Promises that resolve
with bundles providing controlled `getText()` responses. Avoids file
I/O and is reliable in CI. The layout-registry tests already use
sinon stubs for `Localization.getLanguageTag` — same pattern.

For async tests, use sinon fake timers or `await` the returned
`Promise` from `configureI18n`. The `onLocalizationChanged` tests
need to await the deferred `reloadBundles` Promise — expose it
via a test helper or resolve via `Promise.resolve().then()` chaining.

### 9.4 Backward Compatibility

Existing tests should not require changes. The `getText()` change is
backward-compatible: no config → identical code path to today.

One subtle change: the new `onLocalizationChanged` hook causes live
instances to `invalidate()` on language change. Existing tests that
call `Localization.setLanguage()` (available in test code, which
targets 1.144) would trigger it. None of the existing kiosk tests
call `setLanguage`. If any test does surface issues, the fix is to
add `resetI18nConfiguration()` + `clearI18nOverrideHook()` to
`afterEach`.

---

## 10. Phased Rollout

### Phase 1 — Types and Skeleton

- Add types to `src/types.ts`.
- Add static methods on `KioskKeyboard` with no-op internals.
- Wire empty `i18n-registry.ts` behind stable signatures.

Exit criteria: build and typecheck pass; no behaviour regressions.

### Phase 2 — Registry Core

- Implement config validation, async enhancement loading (with
  generation counter), resolution chain, hook execution.
- Make `i18n.ts` a thin re-export of the registry's `getText`.
- Add registry unit tests (including async load tests).

Exit criteria: `i18n-registry.qunit.ts` green.

### Phase 3 — Lifecycle Wiring

- Implement `onLocalizationChanged` hook on `KioskKeyboard`.
- Wire double invalidation in `configureI18n` facade (immediate +
  deferred).
- Instance invalidation on all four API calls.
- Verify docked/open controls re-render safely.

Exit criteria: integration tests for runtime language switch green.

### Phase 4 — Documentation

- Update README with i18n extension API section and FLP cleanup
  snippet.
- Update `docs/kiosk/ARCHITECTURE.md` with `i18n-registry.ts`
  module entry.

Exit criteria: docs reviewed and aligned with final API names.

### Phase 5 — Hardening

- Negative-path tests and regression sweep.
- Map-safety tests (`__proto__`, `constructor`) where relevant.
- Optional one-cycle experimental usage before marking stable.

---

## 11. What This Plan Does NOT Cover

- **Proposal promotion** — moving the proposal from `proposals/` to
  `history/implemented-proposals/` happens after merge.
- **Demo app integration** — an i18n configuration example in the demo
  app is a follow-up.
- **Read-only inspection API** (`getI18nConfiguration`) — potentially
  useful for diagnostics but out of scope for v1. Can be added later
  without breaking changes.
- **Backward compat changes** — the 1.118 backward compat work
  (replacing `Localization.getLanguageTag()`, `Element.getElementById`,
  etc.) is tracked separately in the backward compat proposal. This
  plan's 1.118 design is compatible with those changes but does not
  depend on or perform them.

---

## 12. Resolved Design Decisions

Decisions settled by comparing both plans:

| Question                                  | Resolution                                                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resetI18nConfiguration` clears hook?     | **No.** Config and hook are independent concerns. FLP cleanup calls both explicitly.                                                                                                                          |
| Invalidate live instances on API calls?   | **Yes.** All four methods call `_invalidateAllInstances()`. Labels must be visually consistent.                                                                                                               |
| `enhanceWith` order semantics?            | **Last wins.** Given `[A, B]`, B's text is used if both provide the same key. Reverse iteration, break.                                                                                                       |
| Language change mechanism?                | **`onLocalizationChanged` hook** — per-instance, 1.118 compatible, canonical UI5 control pattern. No static listener management.                                                                              |
| `getText` ownership?                      | **Registry owns full resolution.** `i18n.ts` is a thin re-export for import stability.                                                                                                                        |
| Standalone public re-export module?       | **No.** APIs live on `KioskKeyboard` only — no standalone import use case.                                                                                                                                    |
| Replace vs merge on `configureI18n`?      | **Replace.** Simple mental model, no ordering ambiguity.                                                                                                                                                      |
| Warning log component?                    | **`"ui5.kiosk.KioskKeyboard"`** — consistent with existing codebase convention.                                                                                                                               |
| Type design for enhancement source?       | **Discriminated union with `never`** + `readonly` on all config properties.                                                                                                                                   |
| Sync vs async `ResourceBundle.create`?    | **Async (`{ async: true }`).** Avoids the sync deprecation (since 1.135). Eager loading in `configureI18n`, generation counter for race safety, `getText` reads only loaded bundles.                          |
| `bundleName` + `bundleUrl` both provided? | **Rejected at our level.** UI5 silently resolves (`bundleName` wins) but our types and runtime validation enforce xor.                                                                                        |
| Locale string source?                     | **`navigator.language`** — version-safe (1.118+), consistent with backward compat proposal for `getLocaleLayout()`. Swappable to `Localization.getLanguageTag().toString()` if min version rises above 1.120. |
| Minimum UI5 version?                      | **1.118.** No dependency on `sap/base/i18n/Localization` methods (1.120+) in library source. `onLocalizationChanged` hook + `navigator.language` + async `ResourceBundle.create` all work at 1.118.           |
