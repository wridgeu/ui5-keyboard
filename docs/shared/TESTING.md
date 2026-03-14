# Testing Guide

Developer reference for the test infrastructure across all packages. For consumer documentation and npm scripts, see the package-level READMEs and the [root README](../../README.md).

## Test Stack

| Layer            | Framework                          | Packages                    | Purpose                                                             |
| ---------------- | ---------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| **Unit**         | QUnit (via wdio-qunit-service)     | `kiosk-keyboard`, `hotkeys` | UI5 control logic in real browser                                   |
| **Unit**         | Vitest (jsdom)                     | `kiosk-keyboard-webc`       | Pure logic (layout registry, grapheme, shift-state, etc.)           |
| **Component**    | Web Test Runner + Playwright       | `kiosk-keyboard-webc`       | DOM integration, events, attributes, accessibility                  |
| **E2E / Visual** | WebdriverIO + @wdio/visual-service | both kiosk packages         | Visual regression, focus flows, auto-type, RTL, accessibility media |

## Component Tests (`kiosk-keyboard-webc`)

Uses `@open-wc/testing` fixtures backed by Playwright via `@web/test-runner-playwright`.

### Fixture lifecycle

`fixture()` creates a wrapper `<div>`, appends it to `document.body`, and registers it for automatic cleanup after each test (via an internal `afterEach`). Important rules:

- **Never call `document.body.appendChild(wrapper)` before passing `wrapper` as `{ parentNode }` to `fixture()`.** `fixture` already handles the append. Doing both causes `fixtureCleanup` to throw `NotFoundError` if you later call `wrapper.remove()`.
- **If `fixture({ parentNode: wrapper })` is used, do NOT call `wrapper.remove()` in a `finally` block.** The fixture system owns the wrapper lifecycle.
- **Tests that call `el.remove()`** (e.g. to verify `onExitDOM` behavior) are safe. `el` is a child of the wrapper, and the wrapper itself stays in `document.body`. `fixtureCleanup` removes the wrapper, not the inner element.
- **`nextRender()`** (alias for `renderFinished` from `@ui5/webcomponents-base`) must be awaited after any property change that triggers a UI5 Web Components render cycle.

### Pattern: custom-sized containers

```ts
// Correct: let fixture manage the wrapper
const wrapper = document.createElement("div");
wrapper.style.width = "320px";

const el = await fixture<KioskKeyboard>(html`<kiosk-keyboard layout="qwerty"></kiosk-keyboard>`, {
  parentNode: wrapper,
});
await nextRender();
// wrapper is cleaned up automatically, do NOT call wrapper.remove()
```

```ts
// WRONG: double-managing wrapper lifecycle
const wrapper = document.createElement("div");
document.body.appendChild(wrapper); // ← fixture does this already
const el = await fixture(html`...`, { parentNode: wrapper });
// ...
wrapper.remove(); // ← fixtureCleanup will fail
```

## Visual Regression Tests

Visual tests use `@wdio/visual-service` with pinned Chrome-for-Testing (`CHROME_VERSION` in `tools/wdio-device-profiles.ts`). Baselines are tied to this exact Chrome version. Changing it requires regenerating ALL baselines across both packages.

### Config files

Each package has three wdio configs:

| Config                | Purpose                             | Server               |
| --------------------- | ----------------------------------- | -------------------- |
| `wdio.conf.ts`        | Desktop (1440x900)                  | UI5 serve / Vite     |
| `wdio-device.conf.ts` | Phone (360x800) / Tablet (768x1024) | Same, different port |
| `wdio-flp.conf.ts`    | FLP sandbox (kiosk only)            | UI5 serve            |

Device configs write screenshots and baselines to per-device subfolders (`__baselines__/{phone,tablet}`, `__screenshots__/{phone,tablet}`).

### Baseline management

```bash
# Update desktop baselines
npm run test:e2e:update -w packages/kiosk-keyboard
npm run test:e2e:update -w packages/kiosk-keyboard-webc

# Update device baselines
npm run test:e2e:phone:update -w packages/kiosk-keyboard
npm run test:e2e:tablet:update -w packages/kiosk-keyboard-webc
# etc.
```

Always review diffs visually after updating. The `test:e2e:report` script generates an interactive HTML report:

```bash
npm run test:e2e:report -w packages/kiosk-keyboard
npm run test:e2e:report -w packages/kiosk-keyboard-webc
```

This finds all `output.json` files (including per-device subfolders) and merges them into a combined report.

### Mismatch threshold

The default threshold is **0%** (pixel-perfect). This is appropriate because:

- Chrome version is pinned, so rendering is deterministic
- `disableCSSAnimation`, `hideScrollBars`, `waitForFontsLoaded` eliminate common jitter sources

If sub-pixel anti-aliasing causes rare false positives (e.g. 0.003% on device emulation), the matcher supports a per-assertion tolerance:

```ts
await expect(kb).toMatchElementSnapshot("kb-numpad", 0.01);
//                                                    ^^^^ 0.01% tolerance
```

Use this sparingly on specific assertions that are known to jitter, rather than raising the global bar.

### Generated assets for webc E2E

The webc package serves source entry points through Vite in its manual and visual test pages (`src/bundle.esm.ts`), so E2E scripts do not need a full prebuild.

What the webc E2E scripts do need is generated theme and i18n output. Every current `test:e2e:*` script in `packages/kiosk-keyboard-webc/package.json` runs `npm run generate` inline before starting WebdriverIO, including headed and device-profile variants.

The kiosk-keyboard (UI5) package uses `ui5 serve` with live transpile, so its E2E scripts also avoid a separate prebuild step.

### Test helpers

Each package has a `test/e2e/test-helpers.ts` that re-exports shared CDP helpers from `tools/wdio-test-helpers.ts` and adds package-specific utilities:

| Helper                     | Package | Purpose                                                   |
| -------------------------- | ------- | --------------------------------------------------------- |
| `openVisualPage()`         | webc    | Navigate to visual.html, wait for ALL keyboards to render |
| `getKeyboardRoot(id)`      | webc    | Get shadow DOM root via deep selector                     |
| `forceHoverState(id, sel)` | webc    | Force `:hover` via CDP (headless Chrome workaround)       |
| `openVisualPage()`         | kiosk   | Navigate to visual test page, inject UI5                  |

`openVisualPage()` waits for every `<kiosk-keyboard>` on the page to have at least one rendered key. This prevents snapshots of partially-loaded keyboards (e.g. custom layouts registered via `whenDefined`).

### Device emulation

Device tests use Chrome's `mobileEmulation` to set viewport, device pixel ratio, and touch mode. CSS media queries like `(pointer: coarse)` and `(hover: none)` evaluate correctly because the browser genuinely believes it's on a touch device.

Port allocation is managed by `DEVICE_BASE_PORTS` in `tools/wdio-device-profiles.ts`. Each device profile adds a `portOffset` to the base port so all profiles can run concurrently without collisions.

## Port Map

| Port  | Usage                                                              |
| ----- | ------------------------------------------------------------------ |
| 8081  | Hotkeys QUnit                                                      |
| 8082  | Kiosk keyboard (UI5 serve: QUnit runner, E2E desktop, visual page) |
| 8083  | Kiosk FLP e2e                                                      |
| 8082  | Kiosk keyboard UI5 server (QUnit + desktop E2E reuse this port)    |
| 8086  | Kiosk webc (Vite: E2E desktop)                                     |
| 8089+ | Kiosk device profiles (phone: +1, tablet: +2)                      |
| 8086+ | Webc device profiles (phone: +1, tablet: +2)                       |

## Running all tests

```bash
npm test                      # Hotkeys QUnit, kiosk QUnit + desktop e2e, webc unit + component tests
npm run test:e2e:all-devices  # All E2E across both packages, all devices (parallel)
npm run test:e2e:all-devices:sequential # Same device matrix, but sequential and more stable
npm run check                 # Full quality gate (fmt + lint + typecheck + guardrails + test + e2e)
```

`npm run check` is the CI gate. It runs everything sequentially, including the device matrix. Use `npm run test:e2e:all-devices` when you want the faster concurrent desktop/phone/tablet sweep, and `npm run test:e2e:all-devices:sequential` when you prefer lower-flake verification on busy machines.
