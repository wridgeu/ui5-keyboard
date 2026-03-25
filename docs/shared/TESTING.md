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

### How it works

The visual regression pipeline has three stages:

1. **Capture**: `@wdio/visual-service` takes a viewport screenshot via Chrome DevTools Protocol and crops it to the target element's bounding rectangle.
2. **Compare**: The cropped screenshot is compared pixel-by-pixel against a stored baseline image in `__baselines__/`.
3. **Report**: Comparison results are written to `output.json` files in `__screenshots__/`. The `test:e2e:report` script merges these into an interactive HTML report.

The critical limitation of stage 1: **the crop is bounded by the viewport**. If any part of the target element extends outside the viewport, that portion is silently clipped from the screenshot. This is why section isolation exists (see below).

### Section isolation (required for multi-keyboard test pages)

Visual test pages contain many keyboard sections stacked vertically. Without intervention, `scrollIntoView` may not position tall elements fully inside the viewport, causing the WDIO visual service to clip the screenshot at the viewport edge. The result is a baseline with a cropped keyboard that silently passes future comparisons (because it compares against the equally-cropped baseline).

Both packages use `isolateSection()` to prevent this. Before each snapshot, all `.section` wrappers except the active one are hidden via `display: none`. This collapses the page so the target element sits near the top and fits comfortably in any viewport size. Sections are restored in a `finally` block after the snapshot.

```ts
// Both packages expose the same pattern via matchElementSnapshotInSection:
export async function matchElementSnapshotInSection(
  element: SnapshotElement,
  name: string,
  options?: { ignoreAntialiasing?: boolean },
): Promise<void> {
  const target = await element;
  await isolateSection(target); // hide other sections
  try {
    // scroll, wait for paint, assert geometry, take snapshot
    await expect(target).toMatchElementSnapshot(name, options);
  } finally {
    await restoreSections(); // always restore
  }
}
```

The WebC variant traverses through the shadow host to reach light-DOM `.section` ancestors (shadow DOM elements cannot use `closest()` across shadow boundaries).

**If you add a new visual test file or test page, always use `matchElementSnapshotInSection` for element snapshots. Direct calls to `toMatchElementSnapshot` without section isolation will produce cropped baselines on small viewports.**

### Config files

Each package has up to three wdio configs:

| Config                | Purpose                                                                 | Server               |
| --------------------- | ----------------------------------------------------------------------- | -------------------- |
| `wdio.conf.ts`        | Desktop (1440x900)                                                      | UI5 serve / Vite     |
| `wdio-device.conf.ts` | Responsive device matrix (`phone-sm`, `phone-md`, `phone-lg`, `tablet`) | Same, different port |
| `wdio-flp.conf.ts`    | FLP sandbox (kiosk only)                                                | UI5 serve            |

Desktop configs run all `**/*.test.ts` files. Device configs run the responsive visual matrix: `visual.test.ts`, `visual-container.test.ts`, `visual-container-responsive.test.ts` (kiosk only), `visual-enhancements.test.ts`, `visual-themes.test.ts`, `rtl.test.ts`, and `accessibility-media.test.ts`. Container tests use fixed-width fixtures (400-600px) that cannot fit on viewports narrower than the fixture, so `visual-container.test.ts` is excluded from device profiles with `width < 400` at config level. The `visual-container-responsive.test.ts` file uses viewport-width fixtures and runs on all profiles.

Baselines are stored in per-profile subfolders:

```
__baselines__/              desktop baselines (1440x900, DPR 1)
__baselines__/phone-sm/     320x568, DPR 2
__baselines__/phone-md/     390x844, DPR 3
__baselines__/phone-lg/     430x932, DPR 3
__baselines__/tablet/       768x1024, DPR 2
```

### Running visual tests

```bash
# Run tests (headless, compare against baselines)
npm run test:e2e -w packages/kiosk-keyboard-webc           # desktop only
npm run test:e2e:phone-md -w packages/kiosk-keyboard-webc  # single device
npm run test:e2e:all-devices -w packages/kiosk-keyboard-webc  # all profiles in parallel

# Run tests with browser visible (for debugging)
npm run test:e2e:open -w packages/kiosk-keyboard-webc      # desktop, headed

# Run ALL e2e across both packages, all devices
npm run test:e2e:all-devices                               # parallel
npm run test:e2e:all-devices:sequential                    # sequential (lower CPU)
```

### Inspecting visual diffs locally

When a visual test fails, the WDIO visual service writes diff images to `__screenshots__/`. To inspect these as an interactive HTML report:

```bash
# 1. Run the tests (they will fail if baselines don't match)
npm run test:e2e -w packages/kiosk-keyboard-webc

# 2. Generate and open the HTML report in your browser
npm run test:e2e:report -w packages/kiosk-keyboard-webc
```

The report shows baseline, actual, and diff images side-by-side for every comparison. For device profiles, the report automatically merges results from all `__screenshots__/phone-sm/`, `phone-md/`, etc. subfolders.

Root-level shortcuts are also available:

```bash
npm run report:visual:kiosk   # kiosk-keyboard package
npm run report:visual:webc    # kiosk-keyboard-webc package
```

The report is generated by `tools/visual-report.mjs`, which runs `wdio-visual-reporter` and serves the output locally.

#### Browsing baselines

To browse baseline images without running tests:

```bash
npm run browse:baselines:kiosk   # kiosk-keyboard package
npm run browse:baselines:webc    # kiosk-keyboard-webc package
```

This opens a gallery grouped by snapshot tag with columns for each device profile. Actual/diff screenshots from the last test run are included behind a toggle button. If no test run has been executed yet, the toggle is still available but screenshot cells will be empty.

### Updating baselines

When a visual change is intentional (new feature, style update, Chrome version bump), regenerate the affected baselines:

```bash
# All devices + desktop for a single package
npm run test:kiosk:e2e:update:all-devices
npm run test:kiosk-webc:e2e:update:all-devices

# All baselines across both packages (nuclear option for Chrome bumps / theme changes)
npm run test:e2e:update:all

# Desktop only
npm run test:kiosk:e2e:update
npm run test:kiosk-webc:e2e:update

# Individual device profiles (from package directory or via -w)
npm run test:e2e:phone-sm:update -w packages/kiosk-keyboard-webc
npm run test:e2e:phone-md:update -w packages/kiosk-keyboard-webc
npm run test:e2e:phone-lg:update -w packages/kiosk-keyboard-webc
npm run test:e2e:tablet:update -w packages/kiosk-keyboard-webc
# (same pattern for kiosk-keyboard)
```

**After updating, always:**

1. Run `npm run check:baselines` to verify every snapshot tag has a baseline for desktop and all device profiles. This catches cases where a new test was added but baselines were only generated for a subset of profiles. Run with `--fix` to see the commands needed to generate any missing ones.
2. Run `git diff --stat` to verify only expected baselines changed.
3. Spot-check the updated images (open them directly or use the report).
4. Commit ALL related changes together: new baselines, deleted old baselines, and any code changes. Leaving orphaned baseline files in the repository causes confusion.

### Mismatch threshold

The default threshold is **0%** (pixel-perfect). This is appropriate because:

- Chrome version is pinned, so rendering is deterministic
- `disableCSSAnimation`, `hideScrollBars`, `waitForFontsLoaded` eliminate common jitter sources

If sub-pixel anti-aliasing causes rare false positives (e.g. 0.003% on device emulation), the matcher supports a per-assertion tolerance:

```ts
await expect(kb).toMatchElementSnapshot("kb-numpad", { ignoreAntialiasing: true });
```

Use this sparingly on specific assertions that are known to jitter, rather than raising the global bar.

### Generated assets for webc E2E

The webc package serves source entry points through Vite in its manual and visual test pages (`src/bundle.esm.ts`), so E2E scripts do not need a full prebuild.

What the webc E2E scripts do need is generated theme and i18n output. Every current `test:e2e:*` script in `packages/kiosk-keyboard-webc/package.json` runs `npm run generate` inline before starting WebdriverIO, including headed and device-profile variants.

The kiosk-keyboard (UI5) package uses `ui5 serve` with live transpile, so its E2E scripts also avoid a separate prebuild step.

### Test helpers

Each package has a `test/e2e/test-helpers.ts` that re-exports shared CDP helpers from `tools/wdio-test-helpers.ts` and adds package-specific utilities:

| Helper                            | Package | Purpose                                                       |
| --------------------------------- | ------- | ------------------------------------------------------------- |
| `openVisualPage()`                | both    | Navigate to visual test page, wait for all keyboards rendered |
| `getKeyboardRoot(id)`             | webc    | Get shadow DOM root via deep selector (`>>>.kiosk-keyboard`)  |
| `getKeyboard(id)`                 | kiosk   | Get `.ui5KioskKeyboard` inside container                      |
| `matchElementSnapshotInSection()` | both    | Isolate section, scroll, assert geometry, take snapshot       |
| `isolateSection()`                | both    | Hide all `.section` wrappers except the target's              |
| `restoreSections()`               | both    | Restore hidden sections                                       |
| `forceHoverState()`               | both    | Force `:hover` via CDP (deterministic hover testing)          |
| `clearForcedHoverState()`         | both    | Clear forced pseudo-states                                    |

`openVisualPage()` waits for every keyboard on the page to have at least one rendered key. This prevents snapshots of partially-loaded keyboards (e.g. custom layouts registered via `whenDefined`).

### Device emulation

Device tests use Chrome's `mobileEmulation` to set viewport, device pixel ratio, and touch mode. CSS media queries like `(pointer: coarse)` and `(hover: none)` evaluate correctly because the browser genuinely believes it's on a touch device.

Port allocation is managed by `DEVICE_BASE_PORTS` in `tools/wdio-device-profiles.ts`. Each device profile adds a `portOffset` to the base port so all profiles can run concurrently without collisions.

### Troubleshooting

**Cropped/clipped baseline images**: The element was not fully inside the viewport when the screenshot was taken. Ensure the test uses `matchElementSnapshotInSection()` (not a bare `toMatchElementSnapshot`) and that the test page wraps each keyboard in a `.section` div.

**"no such node" / stale element errors on device profiles**: Chrome's WebDriver BiDi protocol can intermittently lose element references during heavy DOM manipulation in mobile emulation mode. Device configs use `specFileRetries: 1` to automatically retry the failing spec file once, which handles the vast majority of these transient errors. If the error is consistent across retries, check that the element is re-queried after any page navigation.

**Baseline diffs after Chrome version bump**: Expected. Regenerate ALL baselines across both packages and all device profiles. Review the diffs visually before committing.

**Port conflicts**: Check the port map below. Kill stale processes on the conflicting port, or use `npm run test:e2e:all-devices:sequential` to avoid concurrent port pressure.

## Port Map

| Port      | Usage                                                                |
| --------- | -------------------------------------------------------------------- |
| 8081      | Hotkeys QUnit                                                        |
| 8082      | Kiosk keyboard QUnit runner                                          |
| 8083      | Kiosk FLP e2e                                                        |
| 8084      | Kiosk webc manual dev server (`npm run start:kiosk-webc`)            |
| 8085      | Kiosk keyboard E2E desktop + visual page                             |
| 8086      | Kiosk webc (Vite: E2E desktop)                                       |
| 8092-8095 | Kiosk device profiles (`phone-sm`, `phone-md`, `phone-lg`, `tablet`) |
| 8087-8090 | Webc device profiles (`phone-sm`, `phone-md`, `phone-lg`, `tablet`)  |

## Running all tests

```bash
npm test                      # Hotkeys QUnit, kiosk QUnit + desktop e2e, webc unit + component tests
npm run test:e2e:all-devices  # All E2E across both packages, all devices (parallel)
npm run test:e2e:all-devices:sequential # Same device matrix, but sequential for lower local CPU/RAM pressure
npm run test:tools            # Regression tests for custom oxlint fixers
npm run test:packages:smoke   # Build + npm pack dry-run smoke for publishable packages
npm run test:demo:webc-bundle # Demo build smoke check for the public WebC bundle path
npm run check                 # Full quality gate with smoke checks + sequential multi-device matrix
npm run check:parallel        # Same gate, but with the concurrent multi-device matrix
```

`npm run check` remains exhaustive, but it now uses the sequential device matrix to reduce peak machine load and port/contention flake. Use `npm run check:parallel` or `npm run test:e2e:all-devices` when you explicitly want the higher-pressure concurrent sweep.
