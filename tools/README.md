# tools/

Shared build and test tooling for the monorepo. These scripts are consumed by package-level configs and root-level npm scripts.

## `check-test-hard-waits.mjs`

AST-based linter that detects flaky hard-wait patterns in test files. Auto-discovers test directories from all workspace packages.

**Rules:**

| Rule                     | Scope          | Description                                                      |
| ------------------------ | -------------- | ---------------------------------------------------------------- |
| `browser.pause()`        | All test files | Flags `browser.pause()` calls; use `browser.waitUntil()` instead |
| `await setTimeout sleep` | E2E tests only | Flags `await new Promise(r => setTimeout(r, N))` where N > 0     |

`setTimeout(resolve, 0)` (microtask flush) is intentionally allowed.

```sh
node tools/check-test-hard-waits.mjs   # or: npm run test:guardrails
```

Adding a new rule: append an entry to the `rules` array with `name`, `message`, `match(node)`, and an optional `fileFilter(filePath)`.

## `wdio-server.ts`

Shared utilities for WebdriverIO test configurations across packages.

### `createServerManager(port, packageRoot, configFile?, startupTimeout?)`

Creates wdio lifecycle hooks (`onPrepare` / `onComplete`) that auto-start a UI5 dev server if the target port is not already in use, and tear it down on completion.

**Usage with wdio hooks (current):**

```ts
const server = createServerManager(8082, PACKAGE_ROOT);

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

### `createViteServerManager(port, packageRoot, startupTimeout?)`

Creates wdio lifecycle hooks that start a Vite dev server for packages that use Vite for bundling (e.g. kiosk-keyboard-webc). Unlike a plain static file server, Vite resolves bare module specifiers so test pages with ES module imports work without an import map.

```ts
const server = createViteServerManager(8084, PACKAGE_ROOT);

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

## Consumers

### `check-test-hard-waits.mjs`

| Consumer            | Invocation                |
| ------------------- | ------------------------- |
| Root `package.json` | `npm run test:guardrails` |

### `wdio-server.ts`

| Consumer                                                    | Imports                                                         | Port            |
| ----------------------------------------------------------- | --------------------------------------------------------------- | --------------- |
| `packages/hotkeys/test/qunit/wdio.conf.ts`                  | `createServerManager`, `readQUnitTestIds`                       | 8081            |
| `packages/kiosk-keyboard/test/qunit/wdio.conf.ts`           | `createServerManager`, `readQUnitTestIds`, `generateQUnitSpecs` | 8084            |
| `packages/kiosk-keyboard/test/e2e/wdio.conf.ts`             | `createServerManager`                                           | 8082            |
| `packages/kiosk-keyboard/test/e2e/wdio-device.conf.ts`      | `createServerManager`                                           | 8089 + offset\* |
| `packages/kiosk-keyboard/test/e2e/wdio-flp.conf.ts`         | `createServerManager`                                           | 8083            |
| `packages/kiosk-keyboard-webc/test/e2e/wdio.conf.ts`        | `createViteServerManager`                                       | 8086            |
| `packages/kiosk-keyboard-webc/test/e2e/wdio-device.conf.ts` | `createViteServerManager`                                       | 8086 + offset\* |

\*Device configs use `BASE_PORT + profile.portOffset` to avoid port collisions across device profiles (phone: +1, tablet: +2).

### `wdio-test-helpers.ts`

| Consumer                                                | Imports (re-exported via package `test-helpers.ts`)                              |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/kiosk-keyboard/test/e2e/test-helpers.ts`      | `setEmulatedMediaFeatures`, `clearEmulatedMediaFeatures`, `setDocumentDirection` |
| `packages/kiosk-keyboard-webc/test/e2e/test-helpers.ts` | `setEmulatedMediaFeatures`, `clearEmulatedMediaFeatures`, `setDocumentDirection` |

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

## `tsconfig.json`

TypeScript configuration for the tools directory. Extends the root `tsconfig.json` with Node-appropriate module settings (`NodeNext`).
