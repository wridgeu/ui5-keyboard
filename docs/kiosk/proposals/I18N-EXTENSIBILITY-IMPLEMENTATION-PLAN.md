# i18n Extensibility Implementation Plan (`ui5.kiosk`)

## Status

- Planning document only (no implementation in this change).
- Execution gate: implementation starts only after we compare this plan with the colleague plan and agree on one merged approach.

## Scope and Intent

This document translates `docs/kiosk/proposals/I18N-EXTENSIBILITY.md` into an implementation-ready plan for:

1. i18n extension configuration (additional bundles/locales)
2. deterministic text resolution registry
3. explicit override hook API with strong TypeScript contracts

It is intentionally specific to the current codebase (`KioskKeyboard`, `KioskKeyboardRenderer`, `internal/i18n.ts`) and to UI5/FLP lifecycle behavior.

## Current Baseline (Code Reality)

- Text lookup is centralized in `packages/kiosk-keyboard/src/internal/i18n.ts` as `getText(sKey, sDefault)`.
- `getText` currently reads only `Lib.getResourceBundleFor("ui5.kiosk")` and falls back to `sDefault`.
- Callers are synchronous (`KioskKeyboard.ts`, `KioskKeyboardRenderer.ts`), so lookup must remain synchronous.
- Library already uses static registries for runtime extension (`layout-registry`) and reset APIs for FLP/test isolation.
- FLP module cache means static state survives app reopen unless explicitly reset.

## Design Principles

1. Backward-compatible by default: no behavioral change unless new API is called.
2. Synchronous renderer-safe lookup: no async in render paths.
3. Deterministic fallback chain: missing translations never break rendering.
4. API ergonomics for app teams: simple defaults, explicit cleanup, clear precedence.
5. Type-safe contracts: strict TS types, no `any`, runtime guards for JS consumers.
6. UI5 lifecycle correctness: language change invalidation and cleanup guidance for FLP.

## Proposed Public API Contract

### 1) Public Types (add to `ui5/kiosk/types`)

```ts
export type KioskI18nEnhancementSource =
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

export interface KioskI18nConfiguration {
  readonly supportedLocales?: readonly string[];
  readonly fallbackLocale?: string;
  readonly enhanceWith?: readonly KioskI18nEnhancementSource[];
}

export interface KioskI18nOverrideContext {
  readonly key: string;
  readonly locale: string;
  readonly defaultText: string;
  readonly resolvedText: string;
}

export type KioskI18nOverrideHook = (context: KioskI18nOverrideContext) => string | undefined;
```

Type notes:

- `readonly` avoids accidental mutation after config handover.
- Enhancement source is a discriminated union (`bundleName` xor `bundleUrl`) for compile-time safety.
- `undefined` from hook means "no override"; empty string is a valid explicit override.

### 2) Static API on `KioskKeyboard`

```ts
static configureI18n(config: KioskI18nConfiguration): void;
static resetI18nConfiguration(): void;

static setI18nOverrideHook(hook: KioskI18nOverrideHook): void;
static clearI18nOverrideHook(): void;
```

Behavioral contract:

- `configureI18n` is replace semantics (last call wins), not incremental merge across calls.
- `resetI18nConfiguration` resets config to library defaults (no enhancement bundles).
- `resetI18nConfiguration` does not clear the override hook (that remains explicit via `clearI18nOverrideHook`).
- All four APIs trigger cache invalidation and control invalidation for live instances.

## Resolution Semantics (Final Precedence)

For each key lookup (`getText(key, fallback)`):

1. Resolve base text from `ui5.kiosk` library bundle.
2. Apply configured enhancement bundles in order; later bundles win.
3. Call override hook with `{ key, locale, defaultText, resolvedText }`.
4. If hook returns `undefined`, keep resolved text; if it returns string, use it.
5. If anything is missing or invalid, fall back to caller-provided `fallback`.

This keeps rendering deterministic and compatible with existing call sites.

## Internal Architecture Plan

### 1) New Internal Registry Module

Create `packages/kiosk-keyboard/src/internal/i18n-registry.ts`.

Responsibilities:

- hold normalized i18n config
- hold optional override hook
- create/cache enhancement bundles per locale
- resolve text with precedence chain
- clear runtime caches on config/language changes

Recommended internal API:

```ts
export function configureI18n(config: KioskI18nConfiguration): void;
export function resetI18nConfiguration(): void;

export function setI18nOverrideHook(hook: KioskI18nOverrideHook): void;
export function clearI18nOverrideHook(): void;

export function getText(key: string, fallback: string): string;

export function clearI18nRuntimeCaches(): void;
```

### 2) Keep `internal/i18n.ts` as Thin Facade

- Keep import path stability for current callers.
- Delegate to `internal/i18n-registry.ts`.
- Avoid direct `Lib.getResourceBundleFor` calls outside registry after migration.

### 3) Cache Model

Use explicit cache layers to avoid repeated bundle construction in render loops:

- `bundleCacheByLocale`: enhancement bundle instances per locale + source descriptor
- `resolvedTextCache`: base+enhancement resolved text per `(locale, key, configGeneration)`
- hook result should not be globally cached (hook may depend on app state)

Config/hook/language changes increment generation or clear caches.

### 4) Validation and Logging Rules

Follow existing kiosk DX pattern (`Log.warning`, no throws for recoverable config issues):

- invalid config shape -> warning + ignore invalid fragment
- invalid locale arrays (non-string/empty) -> warning + drop value
- invalid enhancement source (missing both `bundleName` and `bundleUrl`) -> warning + skip
- bundle load failure -> warning once per source/locale combo + continue chain
- hook throws -> catch, warning, keep non-hook resolved text

All warnings should use component `"ui5.kiosk.KioskKeyboard"` for consistency.

## UI5 and FLP Lifecycle Integration

### UI5 Language Lifecycle

- Hook UI5 language change via `Localization.attachChange` (one static listener).
- On change:
  - clear i18n runtime caches
  - invalidate all living `KioskKeyboard` instances so ARIA/key labels rerender

Attach/detach strategy:

- attach when first `KioskKeyboard` instance is initialized
- detach when last instance exits

This avoids long-lived listeners in tests and keeps behavior explicit.

### Control Lifecycle

- Reuse existing `KioskKeyboard._instances` registry for invalidation fan-out.
- On i18n API calls (`configure`, `reset`, `setHook`, `clearHook`), invalidate living instances.
- Keep invalidation framework-native (`invalidate()`), no manual DOM patching.

### FLP Module Cache Lifecycle

Document app-level cleanup in `Component.destroy()`:

```ts
KioskKeyboard.clearI18nOverrideHook();
KioskKeyboard.resetI18nConfiguration();
```

Rationale:

- static registry state otherwise survives app reopen in FLP
- explicit cleanup prevents cross-app tenant wording leakage

## File-by-File Implementation Map

### A) Source

- `packages/kiosk-keyboard/src/types.ts`
  - add i18n config/hook/context types
- `packages/kiosk-keyboard/src/internal/i18n-registry.ts` (new)
  - full registry + resolution + caching + validation
- `packages/kiosk-keyboard/src/internal/i18n.ts`
  - convert to facade over registry
- `packages/kiosk-keyboard/src/KioskKeyboard.ts`
  - add static i18n APIs
  - add static invalidation helper for all instances
  - add language-change listener attach/detach in lifecycle

### B) Tests

- `packages/kiosk-keyboard/test/qunit/i18n-registry.qunit.ts` (new)
  - registry precedence, validation, and hook behavior
- `packages/kiosk-keyboard/test/qunit/KioskKeyboard.qunit.ts`
  - integration checks for rendered labels/ARIA changes
  - API facade checks on `KioskKeyboard`
- `packages/kiosk-keyboard/test/qunit/negative-edge-cases.qunit.ts`
  - add cleanup and negative i18n API coverage
- `packages/kiosk-keyboard/test/qunit/testsuite.qunit.ts`
  - register new `i18n-registry` test module

### C) Documentation

- `packages/kiosk-keyboard/README.md`
  - new i18n extension API section and FLP cleanup snippet
- `docs/kiosk/ARCHITECTURE.md`
  - module overview update (`internal/i18n-registry.ts`)
- `docs/kiosk/proposals/I18N-EXTENSIBILITY.md`
  - link to this implementation plan

## Test Plan (Detailed)

### 1) Registry Unit Tests

Minimum matrix:

- no config -> existing base behavior unchanged
- enhancement precedence (later source wins)
- missing key in enhancement falls back to prior source/base/default
- invalid source skipped with warning
- hook precedence over enhancements
- hook `undefined` retains resolved text
- hook throw is swallowed with warning
- cache invalidates on `configureI18n`, `resetI18nConfiguration`, and language change
- map safety for formerly dangerous keys (`__proto__`, `constructor`, etc.) where relevant

### 2) Control Integration Tests

- root `aria-label` and `aria-roledescription` reflect enhancement text
- special key labels (`Shift`, `Enter`, `Backspace`) reflect enhancement text
- override hook can change `KIOSK_KEYBOARD_LABEL`
- clearing hook restores non-overridden behavior
- language switch rerenders existing control labels (not only new instances)

### 3) FLP/Isolation Tests

- simulate app A config -> app A destroy cleanup -> app B default behavior
- verify no leftover hook/config after reset APIs in `afterEach`

## Rollout Plan (Phased)

### Phase 0 - Cross-Plan Alignment (Mandatory Hold Point)

- compare this plan with colleague plan
- resolve API semantics diffs (replace-vs-merge, reset semantics, listener ownership)
- produce one final merged plan before coding

### Phase 1 - API and Types Skeleton

- add types and static methods with no behavior change yet
- wire no-op internals behind stable signatures

Exit criteria: build and typecheck pass; no behavior regressions.

### Phase 2 - Registry Core

- implement normalized config, enhancement loading, resolution order, hook execution
- add cache + warning dedupe

Exit criteria: registry unit tests green.

### Phase 3 - Lifecycle Wiring

- wire language change handling + instance invalidation
- verify open/docked controls rerender safely

Exit criteria: integration tests for runtime updates green.

### Phase 4 - Docs + FLP Guidance

- update README and architecture docs
- include cleanup guidance in FLP section

Exit criteria: docs reviewed and aligned with final API names.

### Phase 5 - Hardening

- negative-path tests and regression sweep
- optional one-cycle experimental usage before marking stable in docs

## Open Decisions to Settle During Plan Merge

1. Should we expose a standalone public `ui5/kiosk/i18n-registry` facade, or keep i18n APIs only on `KioskKeyboard`?
2. Should `configureI18n` fully replace config (recommended) or deep-merge with previous config?
3. Should we keep warning-based validation only, or introduce optional strict mode later?
4. Do we want a read-only inspection API (`getI18nConfiguration`) for diagnostics, or keep write-only APIs for minimal surface?

## Non-Goals for First Iteration

- no async text resolution path
- no change to control metadata properties/events
- no replacement of UI5 core language resolution
- no breaking change to existing `getText` call sites
