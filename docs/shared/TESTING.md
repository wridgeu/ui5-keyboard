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

1. **Capture**: the two packages differ here.
   - **webc** screenshots **the element** via `expect(locator).toHaveScreenshot()`. Element screenshots are captured in full even when the element is larger than the viewport, so there is no viewport-clipping problem and **no section isolation is needed**.
   - **kiosk** routes every in-flow assertion through `expectKeyboardVisualMatch` -> `expectVisualMatch` (`test/e2e/helpers.ts`), which measures a document-coordinate clip and calls `expect(page).toHaveScreenshot(name, { fullPage: true, clip })`. Its fixture page pins fixtures to 320/400/600px and so overflows horizontally, which (per #204) breaks the viewport-relative box an element screenshot uses once mobile emulation inflates the layout viewport or RTL moves the scroll origin. The `position: fixed` docked case has no document box and stays on element capture.
2. **Compare**: The capture is compared against the committed baseline under `test/e2e/__baselines__/<project>/`. On mismatch the test fails and Playwright writes `actual`, `expected`, and `diff` PNGs into `test-results/`.
3. **Report**: `playwright show-report` opens the HTML report with the three images side by side for every failed snapshot.

Snapshot stability options are set globally in each `playwright.config.ts`:

```ts
expect: { toHaveScreenshot: { animations: "disabled", caret: "hide" } }
```

### Config files

Each package drives Playwright from configs at its **package root** (not inside `test/e2e/`):

| Config                      | Package | Purpose                                                                                                                                                                          |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playwright.config.ts`      | both    | e2e + visual; `desktop` project plus the `phone-*`/`tablet` matrix                                                                                                               |
| `playwright.flp.config.ts`  | kiosk   | FLP sandbox lifecycle suite (separate `ui5 serve --config ui5-flp.yaml`)                                                                                                         |
| `playwright.docs.config.ts` | both    | On-demand README screenshot generation; kiosk runs `readme-screenshots.spec.ts` on port 8085, webc serves `test/pages/key-style-demo.html` from its own Vite server on port 8087 |

Within `playwright.config.ts`, projects share a single `webServer` and differ only by emulated device:

- The **`desktop`** project (1440×900) runs every spec except the ones owned by the dedicated configs (kiosk ignores `flp-lifecycle` and `readme-screenshots`). The webc `desktop` project also runs the behavioral `component.spec.ts`.
- The **device projects** (`phone-sm` 320×568, `phone-md` 390×844, `phone-lg` 430×932, `tablet` 768×1024) set `viewport`, `deviceScaleFactor`, `isMobile`, and `hasTouch`, and run only the visual specs; the behavioral specs (kiosk: autotype, focus, i18n, inputmode, interop; webc: `component.spec.ts`) are desktop-only. Selection uses a `testIgnore` denylist of those behavioral specs, not an allowlist, so a new visual spec joins the device matrix automatically.

On CI the device projects narrow further, to `invariants.spec.ts` alone (`CI_DEVICE_SPECS` in both configs): CI passes `--ignore-snapshots`, under which the rest of their matrix captures nothing, and the non-pixel assertions those specs carry still run through the desktop project. Both configs throw when that spec no longer exists, since a project whose `testMatch` selects nothing still exits 0. Locally every project runs every spec and compares pixels.

Both capture paths take the element in full regardless of viewport, so the fixed-width container fixtures run on every profile without per-viewport gating.

Baselines are committed, one directory per Playwright project (via `snapshotPathTemplate: "{testDir}/__baselines__/{projectName}/{arg}{ext}"`):

```
__baselines__/desktop/      1440x900, DPR 1
__baselines__/phone-sm/     320x568,  DPR 2
__baselines__/phone-md/     390x844,  DPR 3
__baselines__/phone-lg/     430x932,  DPR 3
__baselines__/tablet/       768x1024, DPR 2
```

### What a baseline is evidence for

A baseline is per-package regression evidence: it pins how that package renders against its own previous render. It is not a cross-package parity comparison, and a kiosk baseline is not the counterpart of a webc one - the files are not even named alike (`kb-*.png` vs `webc-*.png`).

The two harnesses wrap the keyboard differently: kiosk fixtures sit inside a padded `.keyboard-container` (`packages/kiosk-keyboard/test/e2e/visual/index.html`), webc fixtures sit directly in an unpadded `.section` (`packages/kiosk-keyboard-webc/test/pages/visual.html`). At the same emulated viewport the kiosk keyboard root is therefore usually the narrower of the two (`qwerty` on `phone-sm`: 240px vs 280px). The gap is not a constant: fixtures pinned to a fixed width in one page and bounded by `max-width` in the other line up at some viewports and not at others (`kb-narrow`/`webc-narrow` match on `phone-sm` and differ by 40px on `desktop`). So a layout that truncates in one package's baseline and not in the other's is a statement about container width, not about the two components disagreeing.

For cross-package parity use the drift checks: `npm run test:style-twin-drift` (`tools/check-style-twin-drift.mjs`, custom-property surface) and `npm run test:dom-contract` (`tools/check-dom-contract-drift.mjs`, class/selector/attribute contract).

### Running visual tests

```bash
# Headless, compare against baselines
npm run test:e2e -w packages/kiosk-keyboard-webc              # desktop only
npm run test:e2e:phone-md -w packages/kiosk-keyboard-webc     # single device project
npm run test:e2e:all-devices -w packages/kiosk-keyboard-webc  # this package's device projects, Playwright's default worker pool

# Headed / interactive (debugging)
npm run test:e2e:open -w packages/kiosk-keyboard-webc         # Playwright UI mode

# All e2e across both packages, all devices (one package after the other)
npm run test:e2e:all-devices                                  # default worker pool per package
npm run test:e2e:all-devices:sequential                       # --workers=1 per package (lower CPU)
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

1. Run `git diff --stat` to verify only expected baselines changed. Both configs pin `snapshotPathTemplate`, so a baseline is `test/e2e/__baselines__/<project>/<arg>.png` with no project or platform suffix in the filename, and only the projects you actually ran are written - a partial update shows up as changes confined to those project directories.
2. Spot-check the updated images (open them directly or via the report).
3. Commit ALL related changes together: new baselines, deleted old baselines, and any code changes. Leaving orphaned baseline files in the repository causes confusion.

### Mismatch threshold

The default is pixel-perfect. Determinism comes from the pinned bundled Chromium plus `animations: "disabled"` and `caret: "hide"`. Where sub-pixel anti-aliasing makes an interactive snapshot jitter (e.g. shifted/active key states under device emulation), a per-assertion tolerance is applied instead of relaxing the global bar:

```ts
const SOFT = { maxDiffPixelRatio: 0.003 };
// kiosk, through the clip helper (VisualMatchOptions = screenshot options minus fullPage/clip)
await expectKeyboardVisualMatch(page, "kb-shift", "kb-shift-active.png", SOFT);
// webc, element capture
await expect(keyboardRoot(page, "kb-shift")).toHaveScreenshot("kb-shift-active.png", SOFT);
```

A few snapshots are too unstable under phone emulation to be meaningful (e.g. the docked render and the Spanish shifted layout) and are skipped on the phone projects via `test.skip(...)` with a reason, rather than carried as flaky baselines. Hover snapshots `test.skip` on profiles without `(hover: hover)`.

### Generated assets for webc E2E

The webc package serves source entry points through Vite in its manual and visual test pages (`src/bundle.esm.ts`), so E2E scripts do not need a full prebuild, but they do need generated theme and i18n output. Every `test:e2e:*` script in `packages/kiosk-keyboard-webc/package.json` that invokes `playwright test` runs `npm run generate` inline first, including headed and device-project variants (`test:e2e:report`, which only opens the HTML report, does not).

The kiosk-keyboard (UI5) package uses `ui5 serve` with live transpile, so its E2E scripts avoid a separate prebuild step entirely.

### Test helpers

Each package keeps its own minimal `test/e2e/helpers.ts`. There is no shared cross-package helper module, and native Playwright APIs cover most needs (web-first assertions, `emulateMedia`, `addStyleTag`, projects for the device matrix). Most of the helpers that remain are thin wrappers; the kiosk clip helper is the one substantial piece of logic:

| Helper                                                 | Package | Purpose                                                                                                                  |
| ------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `openPage(page, path?)`                                | both    | Navigate to a test page and wait for the keyboard root to attach                                                         |
| `keyboardRoot(page, id)`                               | both    | `Locator` for the keyboard root (light DOM for kiosk; the host for webc)                                                 |
| `key(page, id, dataKey)`                               | both    | `Locator` for a specific key                                                                                             |
| `setDocumentDirection(page, dir)`                      | both    | Set `dir`/`lang` for RTL snapshots                                                                                       |
| `expectVisualMatch` / `expectKeyboardVisualMatch`      | kiosk   | Measure a document-coordinate clip and compare it as a full-page capture (see Capture above)                             |
| `waitForKeys` / `waitForDocked*`                       | webc    | Await shadow-DOM render / docked open/closed/shown states                                                                |
| `isCoarsePointer` / `isHoverCapable`                   | webc    | Gate pointer/hover-dependent assertions on the active device project                                                     |
| `injectShadowStyleOverride` / `remove…`                | webc    | Inject a `<style>` into the shadow root to force enhancement-fallback paths                                              |
| `CLOSED_CLASS`, `VISUAL_PAGE`, `DISABLE_TEXT_BOX_TRIM` | varies  | Shared constants (the kiosk closed-state class, the visual page URL, a CSS opt-out for progressive-enhancement features) |

Media features are emulated with Playwright's native `page.emulateMedia({ forcedColors, reducedMotion })` rather than a custom CDP helper.

### Device emulation

Device coverage is expressed as Playwright **projects** (see Config files above) that set `viewport`, `deviceScaleFactor`, `isMobile`, and `hasTouch`. Media queries like `(pointer: coarse)` and `(hover: none)` evaluate correctly because `hasTouch`/`isMobile` make the emulated browser report as a touch device. All projects share their package's single `webServer`, so there are no per-device ports to allocate.

### Troubleshooting

**Jitter on a known-unstable interactive snapshot**: Apply the `SOFT` per-assertion tolerance (see Mismatch threshold above) rather than relaxing the global threshold.

## Port Map

The UI5 QUnit suites are served by `ui5 serve` (via each package's `test:qunit` script, orchestrated by `start-server-and-test` and harvested by `ui5-test-runner`); the e2e/visual suites are served by each Playwright config's `webServer`. The device matrix shares its package's server, so there are no per-device ports.

| Port | Usage                                                     |
| ---- | --------------------------------------------------------- |
| 8081 | Hotkeys QUnit                                             |
| 8082 | Kiosk keyboard QUnit                                      |
| 8083 | Kiosk FLP e2e (`playwright.flp.config.ts`)                |
| 8084 | Kiosk webc manual dev server (`npm run start:kiosk-webc`) |
| 8085 | Kiosk keyboard e2e / visual / docs (all projects)         |
| 8086 | Kiosk webc e2e / visual (Vite, all projects)              |
| 8087 | Kiosk webc docs screenshots (`playwright.docs.config.ts`) |

## Running all tests

```bash
npm test                      # Hotkeys QUnit, kiosk QUnit + desktop e2e, webc unit + component tests
npm run test:e2e:all-devices  # All E2E across both packages, all devices (one package after the other)
npm run test:e2e:all-devices:sequential # Same device matrix, with a single Playwright worker per package
npm run test:packages:smoke   # Build + npm pack dry-run smoke for publishable packages, plus the demo WebC consumption build
npm run check                 # Full quality gate with smoke checks + sequential multi-device matrix
```

Both packages are always run one after the other: they are CPU-bound Playwright matrices, and running them at the same time oversubscribes the machine and produces nondeterministic failures unrelated to the code under test. `npm run check` goes further and pins each package to a single worker, trading wall-clock time for a stable result.

### Per-package commands

```bash
npm run test:hotkeys              # Hotkeys QUnit
npm run test:kiosk                # Kiosk QUnit + desktop e2e
npm run test:kiosk:e2e            # Kiosk desktop e2e only (no QUnit)
npm run test:kiosk:e2e:flp        # FLP lifecycle e2e (SAPUI5 sandbox)
npm run test:kiosk:e2e:docs       # Regenerate README kiosk screenshots
npm run test:kiosk-webc           # Kiosk webc unit tests (Vitest)
npm run test:kiosk-webc:component # Kiosk webc integration tests (Web Test Runner)
npm run test:kiosk-webc:e2e       # Kiosk webc e2e (Playwright)
npm run test:qunit                # All QUnit (hotkeys + kiosk)
npm run test:coverage -w packages/kiosk-keyboard-webc # Coverage (webc only)
```

## What CI runs

`.github/workflows/ci.yml` runs five jobs in parallel, so the slowest one (not their sum) sets the wall-clock:

| Job          | Covers                                                                                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `static`     | commitlint, `fmt:check`, `lint:ci`, `lint:ui5`, `typecheck`, generated-interface drift, and every Node-only check (`test:patches`, the three twin-drift checks, `test:i18n-bundles`, `test:lint-plugins`) |
| `unit-qunit` | `test:qunit` for both UI5 libraries, on puppeteer                                                                                                                                                         |
| `unit-webc`  | the web component's vitest and web-test-runner suites, on playwright chromium                                                                                                                             |
| `e2e`        | `test:e2e:ci` per package, as two matrix legs; behavioral only (`--ignore-snapshots`)                                                                                                                     |
| `smoke`      | `test:packages:smoke`: `build:all` plus an `npm pack` dry run per published package                                                                                                                       |

CI deliberately does not call `npm run check:base`; it re-implements the same chain as jobs so the legs run in parallel and report separately, and it uses the stricter `lint:ci` (`--deny-warnings`) in place of `lint`. What it does not cover is the pixel comparison: visual baselines carry no platform suffix, so `e2e` runs the visual specs as render smoke tests only. Compare baselines locally with `npm run check`.

`release.yml` gates the release on this same workflow through `workflow_call`, so nothing is release-only.
