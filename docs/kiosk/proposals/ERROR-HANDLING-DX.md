# Feature: Error Handling and DX Consistency for `ui5.kiosk`

> Status: **Partially Implemented** | Shipped: structured custom-layout diagnostics, the one-time-warning rule. Open: section A's throw policy, the `strictValidation` path.

## Why

`ui5.kiosk` currently mixes warning logs, silent fallbacks, and no-op behavior
for invalid or unsupported scenarios. The library is robust at runtime, but the
consumer experience is inconsistent: some misconfigurations are obvious, others
are easy to miss.

This document captures current behavior and proposes a consistent error-handling
policy for better developer experience (DX).

## Current State (Kiosk Source)

### 1) Throws

Two, neither of them a consumer-facing contract violation:

- `internal/layout-registry.ts` - invariant guard: the built-in default layout is missing from the registry.
- `internal/key-token.ts` - `assertNever` exhaustiveness guard over `KeyAction`.

### 2) Logs (mostly `Log.warning`)

Eighteen `Log.warning` call sites, all under the `ui5.kiosk.KioskKeyboard` component:

- `packages/kiosk-keyboard/src/KioskKeyboard.ts` (7)
  - a `composeLayout` source that is neither a built-in nor a contributor of rows
  - an active target already targeted by another instance
  - an active target with no textual input DOM ref
  - an active target id that resolves to nothing
  - a variant table declared while `accentVariants` is off
  - a two-way bound `layout` that `autoCompact` writes back into the model
  - an unrecognized `{...}` key token
- `packages/kiosk-keyboard/src/internal/layout-state.ts` (1)
  - a layout name no `<kiosk:CustomLayout>` declares; the request no-ops
- `packages/kiosk-keyboard/src/internal/layout-registry.ts` (2)
  - a layout **name** argument that is not a string, and one that is empty after trim. The layout and locale maps are sealed at module load with no mutation API, and locale resolution is silent: an unmatched locale falls through to `DEFAULT_LAYOUT`.
- `packages/kiosk-keyboard/src/internal/layout-fold-cache.ts` (1)
  - emits the custom-layout diagnostics, once per control per distinct complaint. The codes, their payloads and `describeDiagnostic()` belong to `internal/custom-layout-fold.ts`, which produces them; the cache only reports.
- `packages/kiosk-keyboard/src/internal/i18n-registry.ts` (2)
  - a resolver that throws, and a `setI18nResolver` argument that is neither a function nor `null`
- `packages/kiosk-keyboard/src/internal/controls-delegation-controller.ts` (1)
  - a `controls` entry naming no control, once per id
- `packages/kiosk-keyboard/src/internal/fkey-controller.ts` (1)
  - unsupported native F-key dispatch, once per key name
- `packages/kiosk-keyboard/src/internal/key-icons.ts` (1)
  - an icon URI the pool does not carry, once per URI
- `packages/kiosk-keyboard/src/internal/key-labels.ts` (1)
  - an icon-only key with no accessible name, once per key value
- `packages/kiosk-keyboard/src/internal/dom.ts` (1)
  - a custom target resolver that throws

### 3) Silent fallback / defensive catch

- `packages/kiosk-keyboard/src/internal/input-operations.ts`
  - `setSelectionRange(...)` errors are swallowed (input type constraints)
- `packages/kiosk-keyboard/src/KioskKeyboard.ts`
  - `focus({ preventScroll })` fallback to plain `focus()`

## DX Risks

- Invalid consumer input often appears as "nothing happened" unless logs are
  inspected.
- Severity is unclear: hard contract violations and benign unsupported browser
  behavior are handled similarly.
- Integrators cannot reliably decide what to catch, what to assert in tests,
  and what to ignore.

## Proposed Unification Policy

### A) Throw for programmer contract violations (fail fast)

Examples:

- invalid API argument type where recovery is impossible or ambiguous
- structurally invalid custom layout definitions in the `customLayouts` aggregation
- unsupported state transitions that indicate consumer misuse

### B) Log warning for recoverable, app-level configuration issues

Examples:

- optional feature cannot be applied now but can become valid later
- layout references naming a layout no `<kiosk:CustomLayout>` declares yet
- non-critical integration mismatches where control still works safely

### C) Silent fallback only for browser/platform variance

Examples:

- DOM API support differences (`setSelectionRange`, `focus` options)
- environment capability gaps

Rule (resolved): a fallback that changes observable behavior warns once per
distinct complaint. The pattern is a set of already-reported keys, held per
control (`layout-fold-cache.ts` `_reported`,
`controls-delegation-controller.ts` `_reportedUnresolvedIds`) or module-global
and cleared with the last instance (`fkey-controller.ts`
`_WARNED_UNSUPPORTED_NATIVE_FKEYS`, `key-icons.ts` `warnedInvalidIcons`,
`key-labels.ts` `warnedMissingLabels`).

## Suggested Decision Matrix

When adding/changing logic:

1. Is consumer action required to fix this now?
2. Is there a deterministic safe fallback?
3. Would silent fallback mask a likely bug in app code?

Outcomes:

- required + no safe fallback -> throw
- required + safe fallback but likely app bug -> warn (or throw in strict mode)
- no required action + safe fallback -> silent

## Compatibility Path

To avoid abrupt breaking changes:

1. Introduce `strictValidation` (opt-in) for APIs with currently warning-based
   validation.
2. Keep warning mode as default initially.
3. Document strict-mode migration and promote over time.

## Scope for Follow-up

- Audit each warning/no-op call site and classify it with the matrix above.
- Decide which current warnings should become throws in strict mode.
- Add tests asserting both default and strict behavior.
- Document a stable consumer contract for error handling in README/API docs.
