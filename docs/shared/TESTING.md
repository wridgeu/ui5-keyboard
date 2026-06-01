# Testing Guide

Developer reference for the test infrastructure across all packages. For consumer documentation and npm scripts, see the package-level READMEs and the [root README](../../README.md).

## Test Stack

| Layer            | Framework                       | Packages                    | Purpose                                                                  |
| ---------------- | ------------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| **Unit**         | QUnit (via ui5-test-runner)     | `kiosk-keyboard`, `hotkeys` | UI5 control logic in real browser (puppeteer backend, chromium)          |
| **Unit**         | Vitest (jsdom)                  | `kiosk-keyboard-webc`       | Pure logic (layout registry, grapheme, shift-state, etc.)                |
| **Component**    | Web Test Runner + Playwright    | `kiosk-keyboard-webc`       | DOM integration, events, attributes, accessibility                       |
| **E2E / Visual** | Playwright (`toHaveScreenshot`) | both kiosk packages         | Visual regression, focus flows, auto-type, RTL, accessibility media, FLP |

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

Visual tests use Playwright's built-in `toHaveScreenshot()` assertion. Baselines are tied to the Chromium build bundled with `@playwright/test` (pinned at the repo root); bumping that version can shift rendering, so regenerate ALL baselines across both packages when it changes.

### How it works

The pipeline is whatever Playwright does for `expect(locator).toHaveScreenshot()`:

1. **Capture**: Playwright scrolls the target locator into view and screenshots **the element**, not the viewport. Element screenshots are captured in full even when the element is larger than the viewport, so there is no viewport-clipping problem and **no section isolation is needed** (this was the main complication under the old WebdriverIO setup).
2. **Compare**: The capture is compared against the committed baseline under `test/e2e/__baselines__/<project>/`. On mismatch the test fails and Playwright writes `actual`, `expected`, and `diff` PNGs into `test-results/`.
3. **Report**: `playwright show-report` opens the HTML report with the three images side by side for every failed snapshot.

Snapshot stability options are set globally in each `playwright.config.ts`:

```ts
expect: { toHaveScreenshot: { animations: "disabled", caret: "hide" } }
```

### Config files

Each package drives Playwright from configs at its **package root** (not inside `test/e2e/`):

| Config                      | Package | Purpose                                                                  |
| --------------------------- | ------- | ------------------------------------------------------------------------ |
| `playwright.config.ts`      | both    | e2e + visual; `desktop` project plus the `phone-*`/`tablet` matrix       |
| `playwright.flp.config.ts`  | kiosk   | FLP sandbox lifecycle suite (separate `ui5 serve --config ui5-flp.yaml`) |
| `playwright.docs.config.ts` | kiosk   | On-demand README screenshot generation (`readme-screenshots.spec.ts`)    |

Within `playwright.config.ts`, projects share a single `webServer` and differ only by emulated device:

- The **`desktop`** project (1440×900) runs every spec except the ones that belong to the dedicated configs (`flp-lifecycle`, `readme-screenshots` are ignored; the webc `desktop` project ignores `component.spec.ts`, which runs under Web Test Runner).
- The **device projects** (`phone-sm` 320×568, `phone-md` 390×844, `phone-lg` 430×932, `tablet` 768×1024) set `viewport`, `deviceScaleFactor`, `isMobile`, and `hasTouch`, and are gated by a `VISUAL_SPECS` `testMatch` so they run only the visual specs — the behavioral specs (autotype, focus, i18n, inputmode, interop) are desktop-only.

Because element screenshots capture overflow, the fixed-width container fixtures no longer need per-viewport gating: they run on every profile and are captured in full.

Baselines are committed, one directory per Playwright project (via `snapshotPathTemplate: "{testDir}/__baselines__/{projectName}/{arg}{ext}"`):

```
__baselines__/desktop/      1440x900, DPR 1
__baselines__/phone-sm/     320x568,  DPR 2
__baselines__/phone-md/     390x844,  DPR 3
__baselines__/phone-lg/     430x932,  DPR 3
__baselines__/tablet/       768x1024, DPR 2
```

### Running visual tests

```bash
# Headless, compare against baselines
npm run test:e2e -w packages/kiosk-keyboard-webc              # desktop only
npm run test:e2e:phone-md -w packages/kiosk-keyboard-webc     # single device project
npm run test:e2e:all-devices -w packages/kiosk-keyboard-webc  # all projects in parallel

# Headed / interactive (debugging)
npm run test:e2e:open -w packages/kiosk-keyboard-webc         # Playwright UI mode

# All e2e across both packages, all devices
npm run test:e2e:all-devices                                  # parallel
npm run test:e2e:all-devices:sequential                       # sequential (lower CPU)
```

### Inspecting visual diffs locally

When a visual test fails, Playwright writes `actual` / `expected` / `diff` PNGs into `test-results/`. Open them as an HTML report:

```bash
# 1. Run the tests (they fail if baselines don't match)
npm run test:e2e -w packages/kiosk-keyboard-webc

# 2. Open the Playwright HTML report
npm run test:e2e:report -w packages/kiosk-keyboard-webc
```

Root-level shortcuts wrap the same `playwright show-report`:

```bash
npm run report:visual:kiosk   # kiosk-keyboard package
npm run report:visual:webc    # kiosk-keyboard-webc package
```

### Updating baselines

When a visual change is intentional (new feature, style update, Chromium bump), regenerate the affected baselines with `--update-snapshots` (wrapped by the `*:update` scripts):

```bash
# All devices + desktop for a single package
npm run test:kiosk:e2e:update:all-devices
npm run test:kiosk-webc:e2e:update:all-devices

# All baselines across both packages (nuclear option for Chromium bumps / theme changes)
npm run test:e2e:update:all

# Desktop only
npm run test:kiosk:e2e:update
npm run test:kiosk-webc:e2e:update

# Individual device projects (from package directory or via -w)
npm run test:e2e:phone-sm:update -w packages/kiosk-keyboard-webc
npm run test:e2e:phone-md:update -w packages/kiosk-keyboard-webc
npm run test:e2e:phone-lg:update -w packages/kiosk-keyboard-webc
npm run test:e2e:tablet:update -w packages/kiosk-keyboard-webc
# (same pattern for kiosk-keyboard)
```

**After updating, always:**

1. Run `git diff --stat` to verify only expected baselines changed. Playwright names a baseline `<arg>-<project>-<platform>.png` and only writes the projects you actually ran, so a partial update is visible in the diff.
2. Spot-check the updated images (open them directly or via the report).
3. Commit ALL related changes together: new baselines, deleted old baselines, and any code changes. Leaving orphaned baseline files in the repository causes confusion.

### Mismatch threshold

The default is pixel-perfect. Determinism comes from the pinned bundled Chromium plus `animations: "disabled"` and `caret: "hide"`. Where sub-pixel anti-aliasing makes an interactive snapshot jitter (e.g. shifted/active key states under device emulation), a per-assertion tolerance is applied instead of relaxing the global bar:

```ts
const SOFT = { maxDiffPixelRatio: 0.003 };
await expect(keyboardRoot(page, "kb-shift")).toHaveScreenshot("kb-shift-active.png", SOFT);
```

A few snapshots are too unstable under phone emulation to be meaningful (e.g. the docked render and the Spanish shifted layout) and are skipped on the phone projects via `test.skip(...)` with a reason, rather than carried as flaky baselines. Hover snapshots `test.skip` on profiles without `(hover: hover)`.

### Generated assets for webc E2E

The webc package serves source entry points through Vite in its manual and visual test pages (`src/bundle.esm.ts`), so E2E scripts do not need a full prebuild — but they do need generated theme and i18n output. Every `test:e2e:*` script in `packages/kiosk-keyboard-webc/package.json` runs `npm run generate` inline before invoking `playwright test`, including headed and device-project variants.

The kiosk-keyboard (UI5) package uses `ui5 serve` with live transpile, so its E2E scripts avoid a separate prebuild step entirely.

### Test helpers

Each package keeps its own minimal `test/e2e/helpers.ts` — there is no shared cross-package helper module; native Playwright APIs cover most needs (web-first assertions, `emulateMedia`, `addStyleTag`, projects for the device matrix). The helpers that remain are thin:

| Helper                                                                      | Package | Purpose                                                                                                                 |
| --------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `openPage(page, path?)`                                                     | both    | Navigate to a test page and wait for the keyboard root to attach                                                        |
| `keyboardRoot(page, id)`                                                    | both    | `Locator` for the keyboard root (light DOM for kiosk; the host for webc)                                                |
| `key(page, id, dataKey)`                                                    | both    | `Locator` for a specific key                                                                                            |
| `setDocumentDirection(page, dir)`                                           | both    | Set `dir`/`lang` for RTL snapshots                                                                                      |
| `waitForKeys` / `waitForDocked*`                                            | webc    | Await shadow-DOM render / docked open/closed/shown states                                                               |
| `injectShadowStyleOverride` / `remove…`                                     | webc    | Inject a `<style>` into the shadow root to force enhancement-fallback paths                                             |
| `CLOSED_CLASS`, `VISUAL_PAGE`, `DISABLE_TEXT_BOX_TRIM`, `DISABLE_COLOR_MIX` | varies  | Shared constants (the kiosk closed-state class, the visual page URL, CSS opt-outs for progressive-enhancement features) |

Media features are emulated with Playwright's native `page.emulateMedia({ forcedColors, reducedMotion })` rather than a custom CDP helper.

### Device emulation

Device coverage is expressed as Playwright **projects** (see Config files above) that set `viewport`, `deviceScaleFactor`, `isMobile`, and `hasTouch`. Media queries like `(pointer: coarse)` and `(hover: none)` evaluate correctly because `hasTouch`/`isMobile` make the emulated browser report as a touch device. All projects share their package's single `webServer`, so — unlike the old WebdriverIO matrix — there are no per-device ports to allocate.

### Troubleshooting

**Snapshot diff you didn't expect**: Open `npm run test:e2e:report` and compare the `actual`/`expected`/`diff` triplet. If the change is intentional, regenerate with the matching `*:update` script; if it's jitter on a known-unstable interactive snapshot, apply the `SOFT` per-assertion tolerance rather than relaxing the global threshold.

**Snapshot missing for a project**: Playwright fails a snapshot assertion if no baseline exists for the current project. Run the project's `*:update` script (or `test:e2e:update:all`) to generate it, then commit the new `__baselines__/<project>/` files.

**Baseline diffs after a Chromium bump**: Expected. Regenerate ALL baselines across both packages and all device projects, and review the diffs visually before committing.

**Port conflicts**: Check the port map below. Kill stale processes on the conflicting port, or use `npm run test:e2e:all-devices:sequential` to avoid concurrent port pressure.

## Port Map

The UI5 QUnit suites are served by `ui5 serve` (via each package's `test:qunit` script, orchestrated by `start-server-and-test` and harvested by `ui5-test-runner`); the e2e/visual suites are served by each Playwright config's `webServer`. The device matrix shares its package's server — there are no per-device ports.

| Port | Usage                                                     |
| ---- | --------------------------------------------------------- |
| 8081 | Hotkeys QUnit                                             |
| 8082 | Kiosk keyboard QUnit                                      |
| 8083 | Kiosk FLP e2e (`playwright.flp.config.ts`)                |
| 8084 | Kiosk webc manual dev server (`npm run start:kiosk-webc`) |
| 8085 | Kiosk keyboard e2e / visual / docs (all projects)         |
| 8086 | Kiosk webc e2e / visual (Vite, all projects)              |

## Running all tests

```bash
npm test                      # Hotkeys QUnit, kiosk QUnit + desktop e2e, webc unit + component tests
npm run test:e2e:all-devices  # All E2E across both packages, all devices (parallel)
npm run test:e2e:all-devices:sequential # Same device matrix, but sequential for lower local CPU/RAM pressure
npm run test:packages:smoke   # Build + npm pack dry-run smoke for publishable packages
npm run test:demo:webc-bundle # Demo build smoke check for the public WebC bundle path
npm run check                 # Full quality gate with smoke checks + sequential multi-device matrix
npm run check:parallel        # Same gate, but with the concurrent multi-device matrix
```

`npm run check` remains exhaustive, but it now uses the sequential device matrix to reduce peak machine load and port/contention flake. Use `npm run check:parallel` or `npm run test:e2e:all-devices` when you explicitly want the higher-pressure concurrent sweep.
