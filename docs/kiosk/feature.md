# Feature: Error Handling and DX Consistency for `ui5.kiosk`

> Status: Proposal

## Why

`ui5.kiosk` currently mixes warning logs, silent fallbacks, and no-op behavior
for invalid or unsupported scenarios. The library is robust at runtime, but the
consumer experience is inconsistent: some misconfigurations are obvious, others
are easy to miss.

This document captures current behavior and proposes a consistent error-handling
policy for better developer experience (DX).

## Current State (Kiosk Source)

### 1) Throws

- No explicit `throw` in kiosk production source (`packages/kiosk-keyboard/src`).

### 2) Logs (mostly `Log.warning`)

- `packages/kiosk-keyboard/src/KioskKeyboard.ts`
  - unknown layout name in `setLayout(...)` logs warning and no-ops
  - unresolved `targetInput` / `inputIds` scenarios log warnings
  - unsupported native F-key dispatch logs warning
- `packages/kiosk-keyboard/src/internal/layout-registry.ts`
  - invalid layout names/definitions log warning and no-op
  - attempts to overwrite/remove built-ins log warning and no-op
  - invalid locale mapping and unknown mapped layout log warning

### 3) Silent fallback / defensive catch

- `packages/kiosk-keyboard/src/internal/input-operations.ts`
  - `setSelectionRange(...)` errors are swallowed (input type constraints)
- `packages/kiosk-keyboard/src/KioskKeyboard.ts`
  - `focus({ preventScroll })` fallback to plain `focus()`
- `packages/kiosk-keyboard/src/internal/grapheme.ts`
  - `Intl.Segmenter` fallback path when unavailable/failing

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
- structurally invalid custom layout definitions when registration is requested
- unsupported state transitions that indicate consumer misuse

### B) Log warning for recoverable, app-level configuration issues

Examples:

- optional feature cannot be applied now but can become valid later
- unknown-but-possibly-later-registered layout references
- non-critical integration mismatches where control still works safely

### C) Silent fallback only for browser/platform variance

Examples:

- DOM API support differences (`setSelectionRange`, `focus` options)
- environment capability gaps (`Intl.Segmenter`)

Rule: if fallback changes observable behavior in a way relevant to consumers,
emit a one-time warning.

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
