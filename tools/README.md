# tools/

Shared build and test tooling for the monorepo. These scripts are consumed by package-level configs and root-level npm scripts.

## `eslint-plugin-test-guardrails.mjs`

Custom oxlint JS plugin that enforces test stability guardrails. Loaded via the `jsPlugins` field in `.oxlintrc.json` and runs as part of `npm run lint`.

**Rules:**

| Rule                               | Scope          | Description                                                      |
| ---------------------------------- | -------------- | ---------------------------------------------------------------- |
| `test-guardrails/no-browser-pause` | All test files | Flags `browser.pause()` calls; use `browser.waitUntil()` instead |
| `test-guardrails/no-hard-wait`     | E2E tests only | Flags `await new Promise(r => setTimeout(r, N))` where N > 0     |

`setTimeout(resolve, 0)` (microtask flush) is intentionally allowed.

Rule scoping is configured via `overrides` in `.oxlintrc.json`:

- `no-browser-pause`: `packages/*/test/**/*.ts`
- `no-hard-wait`: `packages/*/test/e2e/**/*.ts`

Adding a new rule: export a new rule object from the plugin and add a corresponding override entry in `.oxlintrc.json`.

## `eslint-plugin-code-quality.mjs`

Custom oxlint JS plugin that catches AI-generated code anti-patterns. Loaded via the `jsPlugins` field in `.oxlintrc.json` and runs as part of `npm run lint`.

**Rules:**

| Rule                                       | Severity | Description                                                             |
| ------------------------------------------ | -------- | ----------------------------------------------------------------------- |
| `code-quality/no-double-type-assertion`    | error    | Flags `x as unknown as T` chains; use type guards or `in` checks        |
| `code-quality/no-console-only-catch`       | warn     | Flags catch blocks with only a console call (error swallowed)           |
| `code-quality/no-redundant-boolean-return` | warn     | Flags `if (x) return true; else return false;` (simplify to `return x`) |
| `code-quality/no-em-dash`                  | warn     | Flags em-dashes (U+2014) in strings and comments (AI text marker)       |
| `code-quality/no-as-any-assertion`         | warn     | Flags `as any` type assertions; use typed helpers or type guards        |

`no-double-type-assertion` is disabled in test files (`*.test.ts`, `*.spec.ts`, `*.qunit.ts`) since test mocks legitimately use double assertions to pass invalid types.

Inspired by [unguard](https://github.com/anthropics/unguard)'s `no-type-assertion` / `no-inline-type-assertion` rules and common AI-slop detection patterns from tools like [KarpeSlop](https://github.com/CodeDeficient/KarpeSlop) and [sloplint](https://github.com/dannote/sloplint).

Adding a new rule: export a new rule object from the plugin and add a corresponding rule entry in `.oxlintrc.json`.

Regression coverage for the auto-fix rules lives in `tools/test/oxlint-custom-rules.test.mjs` and runs via `npm run test:tools`.

## `eslint-plugin-comment-quality.mjs`

Custom oxlint JS plugin that detects low-quality AI-generated comments. Uses AST correlation (comparing comment text against adjacent code identifiers) rather than broad regex to keep false-positive rates low. Loaded via the `jsPlugins` field in `.oxlintrc.json` and runs as part of `npm run lint`.

**Rules:**

| Rule                                     | Severity | Description                                                          |
| ---------------------------------------- | -------- | -------------------------------------------------------------------- |
| `comment-quality/no-obvious-comment`     | warn     | Flags comments that just restate adjacent code identifiers           |
| `comment-quality/no-narrator-comment`    | warn     | Flags "This function/method handles..." preamble comments            |
| `comment-quality/no-section-divider`     | warn     | Flags decorative `// --- Helpers ---` banner comments                |
| `comment-quality/no-placeholder-comment` | warn     | Flags "Replace this with your actual implementation" stub comments   |
| `comment-quality/no-hedging-comment`     | warn     | Flags "hopefully", "probably fine", "quick hack" uncertainty markers |

All rules are warn-only (no auto-fix) so the developer decides whether to rewrite or remove the comment. Comments containing keeper directives (`TODO`, `FIXME`, `eslint-disable`, JSDoc tags, etc.) are always skipped.

Adding a new rule: export a new rule object from the plugin and add a corresponding rule entry in `.oxlintrc.json`.

Warn-only comment rules currently piggyback on the same `npm run test:tools` harness only when they need explicit regression coverage; the auto-fix rules are the main priority because they can rewrite staged files during commit.

## `wdio-server.ts`

Shared utilities for WebdriverIO test configurations across packages.

### `createServerManager(port, packageRoot, configFile?, startupTimeout?, readinessPath?)`

Creates wdio lifecycle hooks (`onPrepare` / `onComplete`) that auto-start a UI5 dev server if the target port is not already in use, and tear it down on completion. `readinessPath` lets callers verify a package-specific URL instead of accepting any HTTP response on the port.

**Usage with wdio hooks (current):**

```ts
const server = createServerManager(
  8082,
  PACKAGE_ROOT,
  undefined,
  60_000,
  "/test-resources/ui5/kiosk/qunit/testsuite.qunit.html",
);

export const config: WebdriverIO.Config = {
  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
```

**Usage with `await using` (standalone scripts):**

The returned object implements `Symbol.asyncDispose`, so it can be used with explicit resource management for automatic cleanup:

```ts
await using server = createServerManager(8082, PACKAGE_ROOT);
await server.onPrepare();
// server is automatically stopped when the scope exits
```

### `createViteServerManager(port, packageRoot, startupTimeout?, readinessPath?)`

Creates wdio lifecycle hooks that start a Vite dev server for packages that use Vite for bundling (e.g. kiosk-keyboard-webc). Unlike a plain static file server, Vite resolves bare module specifiers so test pages with ES module imports work without an import map. `readinessPath` lets callers reject unrelated HTTP servers already bound to the same port.

```ts
const server = createViteServerManager(8084, PACKAGE_ROOT, 60_000, "/test/pages/index.html");

export const config: WebdriverIO.Config = {
  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
```

### `readQUnitTestIds(testsuitePath)`

Extracts test IDs from a `testsuite.qunit.ts` file using TypeScript AST parsing. Returns keys from the `tests` object in declaration order.

### `generateQUnitSpecs(testIds, outputDir, urlFn)`

Generates one `.spec.js` file per QUnit test ID so WebdriverIO can distribute them across parallel browser instances via `maxInstances`.

## `wdio-test-helpers.ts`

Shared CDP (Chrome DevTools Protocol) helpers for e2e tests. Both packages re-export these from their own `test-helpers.ts` so test files import from a single place.

### `setEmulatedMediaFeatures(features)`

Emulates CSS media features via `Emulation.setEmulatedMedia`. Used to test `forced-colors`, `prefers-reduced-motion`, etc.

```ts
await setEmulatedMediaFeatures([{ name: "forced-colors", value: "active" }]);
```

### `clearEmulatedMediaFeatures()`

Clears all previously emulated media features.

### `injectStyleOverride(css, id?)`

Injects or updates a `<style>` element in the page under test. Used by visual
regression tests to force fallback rendering paths when progressive enhancement
features such as container queries or text-box-trim would otherwise be active.

```ts
await injectStyleOverride(".example { color: red; }");
```

### `removeStyleOverride(id?)`

Removes a previously injected style override by element ID.

```ts
await removeStyleOverride();
```

### `setDocumentDirection(dir)`

Sets `dir` and `lang` attributes on the document root and waits for a layout reflow. Used by RTL visual regression tests.

```ts
await setDocumentDirection("rtl");
```

## `wdio-device-profiles.ts`

Shared device profiles, pinned Chrome version, and Chrome option builder for e2e testing.

### `CHROME_VERSION`

Pinned Chrome version used by all WDIO configs. WDIO 9 auto-downloads this exact Chrome-for-Testing build so that visual regression baselines are reproducible across machines. When updating, regenerate all visual baselines and verify the diffs visually.

### `DEVICE_BASE_PORTS`

Central registry of base ports for device-emulation test servers, keyed by package directory name. Each device profile adds its `portOffset` to the base port so profiles can run in parallel. When adding a new package or device profile, update this map to keep ranges non-overlapping.

### `deviceProfiles`

Record of named device profiles (`phone`, `tablet`) with viewport dimensions, device scale factor, and touch mode.

### `buildChromeOptions(profile, headless)`

Builds `goog:chromeOptions` for a given profile using Chrome `mobileEmulation` so that CSS media queries like `(hover: none)` and `(pointer: coarse)` evaluate correctly.

## `visual-report.mjs`

Generates a local HTML report from WDIO visual regression output and serves it.

### Usage

```bash
node tools/visual-report.mjs <screenshotDir>
```

Example:

```bash
node tools/visual-report.mjs packages/kiosk-keyboard/test/e2e/__screenshots__
```

What it does:

- finds `output.json` in the target screenshots folder and one level of device subfolders
- merges multiple JSON outputs into `output-combined.json` when needed
- runs `wdio-visual-reporter` to generate the HTML report
- serves the generated report locally with `sirv-cli`

## `check-demo-webc-bundle.mjs`

Build-time smoke check that keeps the documented UI5 bridge path honest.

- Verifies the demo still imports `kiosk-keyboard-webc/bundle`
- Rebuilds `packages/demo-app`
- Fails if the documented public bundle path stops being buildable in the demo

Run via `npm run test:demo:webc-bundle`.

## `check-package-smoke.mjs`

Packaging smoke check for the publishable packages.

- Rebuilds `packages/hotkeys`, `packages/kiosk-keyboard`, and `packages/kiosk-keyboard-webc`
- Runs `npm pack --dry-run --json` in each package
- Verifies contract-critical files are actually present in the tarball (for example UI5 build manifests and the WebC bundle outputs)

Run via `npm run test:packages:smoke`.

## Consumers

### `eslint-plugin-test-guardrails.mjs`

| Consumer         | Integration                                      |
| ---------------- | ------------------------------------------------ |
| `.oxlintrc.json` | `jsPlugins` entry, rule overrides per test scope |

### `eslint-plugin-code-quality.mjs`

| Consumer         | Integration                                     |
| ---------------- | ----------------------------------------------- |
| `.oxlintrc.json` | `jsPlugins` entry, global rules + test override |

### `eslint-plugin-comment-quality.mjs`

| Consumer         | Integration                     |
| ---------------- | ------------------------------- |
| `.oxlintrc.json` | `jsPlugins` entry, global rules |

### `wdio-server.ts`

| Consumer                                                    | Imports                                                         | Port            |
| ----------------------------------------------------------- | --------------------------------------------------------------- | --------------- |
| `packages/hotkeys/test/qunit/wdio.conf.ts`                  | `createServerManager`, `readQUnitTestIds`                       | 8081            |
| `packages/kiosk-keyboard/test/qunit/wdio.conf.ts`           | `createServerManager`, `readQUnitTestIds`, `generateQUnitSpecs` | 8082            |
| `packages/kiosk-keyboard/test/e2e/wdio.conf.ts`             | `createServerManager`                                           | 8082            |
| `packages/kiosk-keyboard/test/e2e/wdio-device.conf.ts`      | `createServerManager`                                           | 8089 + offset\* |
| `packages/kiosk-keyboard/test/e2e/wdio-flp.conf.ts`         | `createServerManager`                                           | 8083            |
| `packages/kiosk-keyboard-webc/test/e2e/wdio.conf.ts`        | `createViteServerManager`                                       | 8086            |
| `packages/kiosk-keyboard-webc/test/e2e/wdio-device.conf.ts` | `createViteServerManager`                                       | 8086 + offset\* |

\*Device configs use `BASE_PORT + profile.portOffset` to avoid port collisions across device profiles (phone: +1, tablet: +2).

### `wdio-test-helpers.ts`

| Consumer                                                | Imports (re-exported via package `test-helpers.ts`)                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `packages/kiosk-keyboard/test/e2e/test-helpers.ts`      | `setEmulatedMediaFeatures`, `clearEmulatedMediaFeatures`, `injectStyleOverride`, `removeStyleOverride`, `setDocumentDirection` |
| `packages/kiosk-keyboard-webc/test/e2e/test-helpers.ts` | `setEmulatedMediaFeatures`, `clearEmulatedMediaFeatures`, `injectStyleOverride`, `removeStyleOverride`, `setDocumentDirection` |

### `wdio-device-profiles.ts`

| Consumer                                                    | Imports                                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/hotkeys/test/qunit/wdio.conf.ts`                  | `CHROME_VERSION`, `DESKTOP_WINDOW_SIZE`                                       |
| `packages/kiosk-keyboard/test/qunit/wdio.conf.ts`           | `CHROME_VERSION`, `DESKTOP_WINDOW_SIZE`                                       |
| `packages/kiosk-keyboard/test/e2e/wdio.conf.ts`             | `CHROME_VERSION`, `DESKTOP_WINDOW_SIZE`                                       |
| `packages/kiosk-keyboard/test/e2e/wdio-device.conf.ts`      | `buildChromeOptions`, `deviceProfiles`, `CHROME_VERSION`, `DEVICE_BASE_PORTS` |
| `packages/kiosk-keyboard/test/e2e/wdio-flp.conf.ts`         | `CHROME_VERSION`, `DESKTOP_WINDOW_SIZE`                                       |
| `packages/kiosk-keyboard-webc/test/e2e/wdio.conf.ts`        | `CHROME_VERSION`, `DESKTOP_WINDOW_SIZE`                                       |
| `packages/kiosk-keyboard-webc/test/e2e/wdio-device.conf.ts` | `buildChromeOptions`, `deviceProfiles`, `CHROME_VERSION`, `DEVICE_BASE_PORTS` |

### `visual-report.mjs`

| Consumer                                    | Integration                                 |
| ------------------------------------------- | ------------------------------------------- |
| `package.json`                              | `report:visual:kiosk`, `report:visual:webc` |
| `packages/kiosk-keyboard/package.json`      | `test:e2e:report`                           |
| `packages/kiosk-keyboard-webc/package.json` | `test:e2e:report`                           |

## `tsconfig.json`

TypeScript configuration for the tools directory. Extends the root `tsconfig.json` with Node-appropriate module settings (`NodeNext`).
