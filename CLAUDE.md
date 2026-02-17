# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo with two UI5 TypeScript libraries and a demo app, using npm workspaces:

| Package                  | Namespace      | Directory                 | Port |
| ------------------------ | -------------- | ------------------------- | ---- |
| `ui5-lib-hotkeys`        | `ui5.hotkeys`  | `packages/hotkeys`        | 8081 |
| `ui5-lib-kiosk-keyboard` | `ui5.kiosk`    | `packages/kiosk-keyboard` | 8082 |
| `demo-hotkeys-app`       | `demo.hotkeys` | `packages/demo-app`       | 8080 |

Framework: OpenUI5 1.144.0 · TypeScript ~5.9.3 · Node >=22

## Commands

```bash
npm install                 # Install all workspaces
npm run check               # fmt:check + lint + typecheck (CI gate)
npm run build               # Build both libraries
npm start                   # Start demo app (port 8080)
npm run start:hotkeys       # Start hotkeys lib with test runner (port 8081)
npm run start:kiosk         # Start kiosk-keyboard lib with test runner (port 8082)
npm run lint                # oxlint packages/
npm run fmt                 # oxfmt .
npm run typecheck           # tsc -b (project references) + demo-app typecheck
```

### Running Tests

Tests use **UI5 Test Starter** with QUnit. Start the library server — the QUnit TestRunner opens automatically and executes all tests:

```bash
# Hotkeys tests (auto-starts)
npm run start -w packages/hotkeys
# → http://localhost:8081/test-resources/sap/ui/qunit/testrunner.html?testpage=...&autostart=true

# Kiosk keyboard tests (auto-starts)
npm run start -w packages/kiosk-keyboard
# → http://localhost:8082/test-resources/sap/ui/qunit/testrunner.html?testpage=...&autostart=true
```

Individual test files follow the pattern `<module>.qunit.ts` in `test/qunit/`. To run a single test, open the Test Starter overview (`testsuite.qunit.html`) and click the test name, or navigate to `Test.qunit.html?testsuite=...&test=<test-key>` (test keys are defined in `testsuite.qunit.ts` without the `.qunit` suffix — Test Starter adds it).

### Building a Single Package

```bash
npm run build -w packages/hotkeys
npm run build -w packages/kiosk-keyboard
```

## Architecture

### Hotkeys Library (`ui5.hotkeys`)

- **HotkeyManager** — Singleton (`getInstance()`/`destroy()`) extending `sap/ui/base/Object`. Document-level `keydown` listener in capture phase.
- **Two-pass matching** — Active scope checked first, then global scope. Scoped handlers always take priority over global ones.
- **Scope stack** — LIFO. Global scope at bottom, view/dialog scopes pushed/popped on top. `enableRouterIntegration(router)` auto-manages view scopes via `beforeRouteMatched`.
- **Smart `ignoreInputs: "auto"`** — Suppresses single-key hotkeys in input fields but allows Ctrl/Meta combos and Escape to fire.
- **SequenceManager** — Multi-key sequences (e.g., `g i`) with configurable timeout.
- **KeyStateTracker** — Tracks physically held keys; works around macOS modifier swallowing.
- **HotkeyRecorder** — Captures user keypresses for "press a key" UIs.

### Kiosk Keyboard Library (`ui5.kiosk`)

- **KioskKeyboard** — Pure UI5 `Control` (flat DOM, event delegation, not a wrapper). Uses `KioskKeyboardRenderer` with `apiVersion: 4`.
- **Theming** — SAP LESS with `base/` and `sap_horizon/` theme folders. `noLibraryCSS: false` (requires CSS — this is why it's a separate library from hotkeys).
- **Layouts** — QWERTY, QWERTZ-DE, numeric, numpad, special. Custom layouts supported via `LayoutDefinition` type.
- **Locale detection** — Auto-selects layout from UI5 locale via `Localization.getLanguageTag()`. Extensible via `registerLocaleLayout()`.
- **Auto-type** — When `autoType="true"`, auto-switches between Full/Numpad based on focused input metadata (UI5 type, control name, DOM inputmode, HTML type).
- **Mobile keyboard** — `mobileKeyboard` enum (`Custom`/`Native`/`Auto`) controls native keyboard suppression via `inputmode="none"`.
- **Target input** — Associated via `targetInput` association. Duck-types `setValue`/`fireLiveChange` (no `any`).
- **Instance isolation** — Static `_instances` set prevents multiple keyboards from claiming the same input during auto-show.

### Demo App (`demo.hotkeys`)

Showcases both libraries with routing (Main, Detail, Kiosk views). Depends on both libraries as workspace deps with `transpileDependencies: true`.

## UI5 TypeScript Patterns

- **ManagedObject class field trap**: `init()`/`onInit()` runs during `super()` BEFORE field initializers execute. Use `!:` declaration and initialize in `init()`/`onInit()`. This does NOT apply to `sap/ui/base/Object` subclasses (no `init()` hook).
- **Library init** uses `Lib.init()` (apiVersion 2), not the deprecated `initLibrary()`.
- **Manifest v2** (`_version: "2.0.0"`): requires `deviceTypes` and `contentDensities`. No `async` properties (async is default).
- **Router detach**: `detachBeforeRouteMatched(handler, oListener)` — `oListener` is REQUIRED (unlike attach).
- **`globalThis.Element`** to reference DOM Element when `sap/ui/core/Element` shadows it.

## Tooling Notes

- **oxfmt** for formatting, **oxlint** for linting (with TypeScript, import, unicorn plugins).
- Several unicorn rules disabled for UI5 compatibility (no-null, prefer-event-target, no-static-only-class, prefer-global-this, consistent-function-scoping, prefer-top-level-await).
- `no-explicit-any` is `error` in production code, `off` in test files.
- **husky + lint-staged** runs oxfmt and oxlint on staged `.ts` files pre-commit.
- TypeScript transpilation handled by `ui5-tooling-transpile`. Generated JS is NOT committed.

## Windows Environment

- NEVER use `> /dev/null` in Git Bash on Windows — it creates a literal `nul` file. Use `2>&1` to merge stderr into stdout.
