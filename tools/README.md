# tools/

Shared build and test tooling for the monorepo. These scripts are consumed by package-level configs and root-level npm scripts.

## `oxlint-plugin-test-guardrails.mjs`

Custom oxlint JS plugin that enforces test stability guardrails. Loaded via the `jsPlugins` field in `.oxlintrc.json` and runs as part of `npm run lint`.

**Rules:**

| Rule                               | Scope          | Description                                                                                              |
| ---------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `test-guardrails/no-browser-pause` | All test files | Flags `page.pause()` / `browser.pause()` debug pauses; rely on web-first assertions instead              |
| `test-guardrails/no-hard-wait`     | E2E tests only | Flags fixed sleeps — `page.waitForTimeout(N)` and `await new Promise(r => setTimeout(r, N))` where N > 0 |

`setTimeout(resolve, 0)` (microtask flush) is intentionally allowed. A genuinely
necessary settle window — e.g. a negative assertion that an action did _not_ change
state, where no event signals the absence of the change — can opt out with an inline
`// oxlint-disable-next-line test-guardrails/no-hard-wait` directive plus a rationale.

Rule scoping is configured via `overrides` in `.oxlintrc.json`:

- `no-browser-pause`: `packages/*/test/**/*.ts`
- `no-hard-wait`: `packages/*/test/e2e/**/*.ts`

Adding a new rule: export a new rule object from the plugin and add a corresponding override entry in `.oxlintrc.json`.

## `oxlint-plugin-code-quality.mjs`

Custom oxlint JS plugin that catches AI-generated code anti-patterns. Loaded via the `jsPlugins` field in `.oxlintrc.json` and runs as part of `npm run lint`.

**Rules:**

| Rule                                       | Severity | Description                                                             |
| ------------------------------------------ | -------- | ----------------------------------------------------------------------- |
| `code-quality/no-double-type-assertion`    | error    | Flags `x as unknown as T` chains; use type guards or `in` checks        |
| `code-quality/no-console-only-catch`       | warn     | Flags catch blocks with only a console call (error swallowed)           |
| `code-quality/no-redundant-boolean-return` | warn     | Flags `if (x) return true; else return false;` (simplify to `return x`) |
| `code-quality/no-em-dash`                  | warn     | Flags em-dashes (U+2014) in strings and comments (AI text marker)       |

`no-double-type-assertion` is disabled in test files (`*.test.ts`, `*.spec.ts`, `*.qunit.ts`) since test mocks legitimately use double assertions to pass invalid types.

Inspired by common AI-slop detection patterns from tools like [KarpeSlop](https://github.com/CodeDeficient/KarpeSlop) and [sloplint](https://github.com/dannote/sloplint).

Adding a new rule: export a new rule object from the plugin and add a corresponding rule entry in `.oxlintrc.json`.

## `oxlint-plugin-comment-quality.mjs`

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

## `run-npm.mjs`

Utility module for running npm commands synchronously from within Node scripts.

Requires `npm_execpath` (set by npm for every script it runs): consumers must be invoked via an npm script (e.g. `npm run test:packages:smoke`), not with `node` directly. Without it the module fails fast with a clear message; the old direct `npm.cmd` spawn fallback throws EINVAL on Windows since Node 18.20 (CVE-2024-27980 hardening).

### `runNpm(args, cwd)`

Spawns `npm` with the given arguments in the specified working directory. Forwards stdout/stderr and exits the process on failure. Returns the captured stdout string.

```js
import { runNpm } from "./run-npm.mjs";
runNpm(["run", "build"], "packages/hotkeys");
```

## `check-demo-webc-bundle.mjs`

Build-time smoke check for the web component build outputs.

- Rebuilds `packages/kiosk-keyboard-webc` and asserts the standalone bundle (`dist/kiosk-keyboard.bundle.js`) exists
- Rebuilds `packages/demo-app`, exercising the `ui5-tooling-modules` `<kiosk-keyboard>` consumption path at build time

This is a build smoke test, not a runtime check: it confirms both packages build, but
does not load the demo. The runtime consumption is covered by the e2e suites.

Run via `npm run test:demo:webc-bundle`.

## `check-package-smoke.mjs`

Packaging smoke check for the publishable packages.

- Rebuilds `packages/hotkeys`, `packages/kiosk-keyboard`, and `packages/kiosk-keyboard-webc`
- Runs `npm pack --dry-run --json` in each package
- Verifies contract-critical files are actually present in the tarball (for example UI5 build manifests and the WebC bundle outputs)

Run via `npm run test:packages:smoke`.

### Native alternatives considered (2026-06-11)

- `check-package-smoke.mjs`: [publint](https://publint.dev/) validates `package.json` (`exports`, `files`, module formats) against the published file list, but does not rebuild the packages or assert that specific build artifacts (UI5 `build-manifest.json`, the WebC bundle) land in the tarball, which is what this script gates. [@arethetypeswrong/cli](https://github.com/arethetypeswrong/arethetypeswrong.github.io) checks type resolution only. Neither replaces the script; kept.
- `check-demo-webc-bundle.mjs`: a cross-package build smoke test (webc build output consumed by the demo-app's `ui5-tooling-modules` path). No maintained generic tool covers this; kept.

## `check-twin-drift.mjs`

Drift check for the deliberately hand-duplicated kiosk twin modules
(`packages/kiosk-keyboard/src` vs `packages/kiosk-keyboard-webc/src`).

- Compares an explicit manifest of 21 pairs (all 16 `layouts/*` files plus the
  `grapheme`, `auto-repeat`, `shift-state`, `action-registry`, and
  `composition-utils` core helpers) after normalization: comments stripped
  (string-aware), relative `.js` import suffixes removed, whitespace collapsed
  outside string literals, logging idioms (`Log.warning` vs `console.warn`)
  equated.
- Fails with a unified-diff-style report naming the drifted pair; a missing
  file or a shrunken manifest is a hard failure, never a silent skip.
- Intentionally divergent or framework-adapted modules (e.g.
  `middleware/kana-dakuten.ts`) are listed as unchecked at the top of the
  script, each with a reason.

Adversarial validation record: `docs/specs/2026-06-11-twin-drift-check-adversarial-hypotheses.md`.

Run via `npm run test:twin-drift` (also part of `check`, `check:parallel`, and CI).

## `copy-license.mjs`

Copies the monorepo's root `LICENSE` into the current working directory (the package being published) so `npm publish` includes it in the tarball. Each publishable package calls it from its `prepublishOnly` script (`node ../../tools/copy-license.mjs`).

## Consumers

### `oxlint-plugin-test-guardrails.mjs`

| Consumer         | Integration                                      |
| ---------------- | ------------------------------------------------ |
| `.oxlintrc.json` | `jsPlugins` entry, rule overrides per test scope |

### `oxlint-plugin-code-quality.mjs`

| Consumer         | Integration                                     |
| ---------------- | ----------------------------------------------- |
| `.oxlintrc.json` | `jsPlugins` entry, global rules + test override |

### `oxlint-plugin-comment-quality.mjs`

| Consumer         | Integration                     |
| ---------------- | ------------------------------- |
| `.oxlintrc.json` | `jsPlugins` entry, global rules |

### `run-npm.mjs`

| Consumer                     | Integration                           |
| ---------------------------- | ------------------------------------- |
| `check-demo-webc-bundle.mjs` | Runs npm build commands synchronously |
| `check-package-smoke.mjs`    | Runs npm pack commands synchronously  |

## `tsconfig.json`

TypeScript configuration for the tools directory. Extends the root `tsconfig.json` with Node-appropriate module settings (`NodeNext`).
