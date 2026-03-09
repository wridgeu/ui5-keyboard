# tools/

Shared build and test tooling for the monorepo. These scripts are consumed by package-level configs and root-level npm scripts.

## `check-test-hard-waits.mjs`

AST-based linter that detects flaky hard-wait patterns in test files. Auto-discovers test directories from all workspace packages.

**Rules:**

| Rule                     | Scope          | Description                                                       |
| ------------------------ | -------------- | ----------------------------------------------------------------- |
| `browser.pause()`        | All test files | Flags `browser.pause()` calls — use `browser.waitUntil()` instead |
| `await setTimeout sleep` | E2E tests only | Flags `await new Promise(r => setTimeout(r, N))` where N > 0      |

`setTimeout(resolve, 0)` (microtask flush) is intentionally allowed.

```sh
node tools/check-test-hard-waits.mjs   # or: npm run test:guardrails
```

Adding a new rule: append an entry to the `rules` array with `name`, `message`, `match(node)`, and an optional `fileFilter(filePath)`.

## `wdio-server.ts`

Shared utilities for WebdriverIO test configurations across packages. Provides three exports:

### `createServerManager(port, packageRoot, configFile?, startupTimeout?)`

Creates wdio lifecycle hooks (`onPrepare` / `onComplete`) that auto-start a UI5 dev server if the target port is not already in use, and tear it down on completion. Also implements `Symbol.asyncDispose` for use with `await using`.

```ts
const server = createServerManager(8082, PACKAGE_ROOT);

export const config: WebdriverIO.Config = {
  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
```

### `readQUnitTestIds(testsuitePath)`

Extracts test IDs from a `testsuite.qunit.ts` file using TypeScript AST parsing. Returns keys from the `tests` object in declaration order.

### `generateQUnitSpecs(testIds, outputDir, urlFn)`

Generates one `.spec.js` file per QUnit test ID so WebdriverIO can distribute them across parallel browser instances via `maxInstances`.

## `tsconfig.json`

TypeScript configuration for the tools directory. Extends the root `tsconfig.json` with Node-appropriate module settings (`NodeNext`).
