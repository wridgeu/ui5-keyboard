# tools/

Shared build and test tooling for the monorepo. These scripts are consumed by package-level configs and root-level npm scripts.

## `oxlint-plugin-test-guardrails.mjs`

Custom oxlint JS plugin that enforces test stability guardrails. Loaded via the `jsPlugins` field in `.oxlintrc.json` and runs as part of `npm run lint`.

**Rules:**

| Rule                           | Scope          | Description                                                                                             |
| ------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------- |
| `test-guardrails/no-hard-wait` | E2E tests only | Flags fixed sleeps: `page.waitForTimeout(N)` and `await new Promise(r => setTimeout(r, N))` where N > 0 |

`setTimeout(resolve, 0)` (microtask flush) is intentionally allowed. A genuinely
necessary settle window (e.g. a negative assertion that an action did _not_ change
state, where no event signals the absence of the change) can opt out with an inline
`// oxlint-disable-next-line test-guardrails/no-hard-wait` directive plus a rationale.

Rule scoping is configured via `overrides` in `.oxlintrc.json`:

- `no-hard-wait`: `packages/*/test/e2e/**/*.{ts,js}`

Adding a new rule: export a new rule object from the plugin and add a corresponding override entry in `.oxlintrc.json`.

## `oxlint-plugin-code-quality.mjs`

Custom oxlint JS plugin that catches AI-generated code anti-patterns. Loaded via the `jsPlugins` field in `.oxlintrc.json` and runs as part of `npm run lint`.

**Rules:**

| Rule                                       | Severity | Description                                                                              |
| ------------------------------------------ | -------- | ---------------------------------------------------------------------------------------- |
| `code-quality/no-double-type-assertion`    | error    | Flags `x as unknown as T` chains; use type guards or `in` checks                         |
| `code-quality/no-console-only-catch`       | warn     | Flags catch blocks with only a console call (error swallowed)                            |
| `code-quality/no-redundant-boolean-return` | warn     | Flags `if (x) return true; else return false;` (simplify to `return x`)                  |
| `code-quality/no-em-dash`                  | warn     | Flags em-dashes (U+2014) and en-dashes (U+2013) in strings and comments (AI text marker) |

`no-double-type-assertion` is disabled in test files (`*.test.ts`, `*.spec.ts`, `*.qunit.ts`) since test mocks legitimately use double assertions to pass invalid types.

Inspired by common AI-slop detection patterns from tools like [KarpeSlop](https://github.com/CodeDeficient/KarpeSlop) and [sloplint](https://github.com/dannote/sloplint).

Adding a new rule: export a new rule object from the plugin and add a corresponding rule entry in `.oxlintrc.json`.

## `oxlint-plugin-comment-quality.mjs`

Custom oxlint JS plugin that detects low-quality AI-generated comments via focused regex patterns over comment text. Loaded via the `jsPlugins` field in `.oxlintrc.json` and runs as part of `npm run lint`.

**Rules:**

| Rule                                         | Severity | Description                                                                                                                                                          |
| -------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `comment-quality/no-narrator-comment`        | warn     | Flags "This function/method handles..." preamble comments, in line comments and doc-blocks alike                                                                     |
| `comment-quality/no-section-divider`         | warn     | Flags decorative `// --- Helpers ---` banner comments. Box-drawing dividers (`// -- Label --` with U+2500) are the house convention and are deliberately not matched |
| `comment-quality/no-placeholder-comment`     | warn     | Flags "Replace this with your actual implementation" stub comments                                                                                                   |
| `comment-quality/no-hedging-comment`         | warn     | Flags "hopefully", "probably fine", "quick hack" uncertainty markers                                                                                                 |
| `comment-quality/no-edit-narration`          | warn     | Flags comments that narrate the edit ("renamed from", "replaces the old") instead of the current contract                                                            |
| `comment-quality/no-issue-reference-comment` | warn     | Flags issue-tracker pointers and known-limitation notes ("tracked in #187"); skips tooling directives only, so a ticket behind a `TODO` still matches                |
| `comment-quality/no-obvious-comment`         | warn     | Flags a line comment whose every word is already named by the statement below it (`// Get the user name` over `const name = user.name;`)                             |

All rules are warn-only (no auto-fix) so the developer decides whether to rewrite or remove the comment. Comments containing keeper directives (`TODO`, `FIXME`, `eslint-disable`, JSDoc tags, etc.) are always skipped.

`no-obvious-comment` is the one rule that reads the AST rather than the comment text alone: it compares the
comment's content words against the identifier and keyword tokens of the statement below it. That statement has
to occupy a single line, since a multi-line one carries the tokens of everything nested inside it and would
match words the comment never restated. Literal tokens are excluded too, so a comment annotating data (a
codepoint decoded beside its escape) is not a restatement. Doc-blocks
are not inspected at all, since a JSDoc block restating its symbol is the contract this repo wants; the
narrating preamble form is `no-narrator-comment`'s job.

Adding a new rule: export a new rule object from the plugin and add a corresponding rule entry in `.oxlintrc.json`.

## `oxlint-plugin-*.test.mjs`

Unit tests for the custom rules, using oxlint's own `RuleTester` (exported from
`oxlint/plugins-dev`) on Node's built-in test runner. No new dependency and no
test framework: `RuleTester` looks for `globalThis.describe` / `globalThis.it`
once at module load, and `node --test` installs neither, so each test file
assigns `RuleTester.describe` and `RuleTester.it` explicitly before running.

These rules gate every other lint run, so a silently broken regex or AST matcher
would disarm the whole thing. Each rule carries both valid cases (including the
`KEEPER_RE` and `EXPLAINS_WHY_RE` escapes, which are what keep the rules from
firing on legitimate comments) and invalid ones.

Run via `npm run test:lint-plugins` (also part of `check:base` and CI).

## `oxlint-plugin.d.ts`

Declares the plugin container and rule types the three plugins annotate against through JSDoc `@type`, derived from oxlint's own `RuleTester` signature and checked by `npm run typecheck:tools`.

## `check-package-smoke.mjs`

Packaging smoke check for the publishable packages.

- `npm run test:packages:smoke` runs `npm run clean && npm run build:all` first, so every package and the demo app are rebuilt from a clean tree before anything is inspected. The orchestration is npm workspaces, not a spawn helper.
- Building `packages/demo-app` exercises the `ui5-tooling-modules` `<kiosk-keyboard>` consumption path at build time against the freshly built web component (runtime consumption is covered by the e2e suites)
- The script then runs a single `npm pack --dry-run --json` across the three publishable workspaces and verifies contract-critical files are present in each tarball (for example UI5 build manifests and the WebC bundle outputs)

Requires `npm_execpath` (set by npm for every script it runs), so it must be run via `npm run test:packages:smoke` rather than with `node` directly. Without it the script fails fast with a clear message; spawning `npm.cmd` directly throws EINVAL on Windows since Node 18.20 (CVE-2024-27980 hardening), so the pack call re-invokes `npm_execpath` with the current Node binary.

### Native alternatives considered (2026-06-11)

- `check-package-smoke.mjs`: [publint](https://publint.dev/) validates `package.json` (`exports`, `files`, module formats) against the published file list, but does not rebuild the packages or assert that specific build artifacts (UI5 `build-manifest.json`, the WebC bundle) land in the tarball, which is what this script gates. [@arethetypeswrong/cli](https://github.com/arethetypeswrong/arethetypeswrong.github.io) checks type resolution only. Neither replaces the script; kept.
- Demo WebC consumption: building `packages/demo-app` against the webc output exercises the `ui5-tooling-modules` path. No maintained generic tool covers this, so it is folded into this script.

## `check-twin-drift.mjs`

Drift check for the deliberately hand-duplicated kiosk twin modules
(`packages/kiosk-keyboard/src` vs `packages/kiosk-keyboard-webc/src`).

- Compares an explicit manifest of 32 pairs (19 `layouts/*` files, 11 core
  helpers: `grapheme`, `auto-repeat`, `shift-state`, `composition-utils`,
  `key-token`, `key-action-meta`, `layout-constraint`, `latin-variants`,
  `announcement-queue`, `layout-meta`, `custom-layout-fold`, and both
  `middleware/*` modules: `hangul-compose` and `kana-dakuten`) after
  normalization: comments stripped
  (string-aware), relative `.js` import suffixes removed, the `../internal/` vs
  `../core/` helper directory a middleware module imports through equated, each
  line trimmed and blank lines dropped. Intra-line spacing is left to oxfmt.
  Nothing else is equated: a normalizer that rewrites a line also hides real
  drift on it, so the set stays limited to differences the two packaging
  conventions force. The count is pinned by `EXPECTED_PAIR_COUNT`, so the
  manifest and the number move together.
- Fails with a unified-diff-style report naming the drifted pair; a missing
  file or a shrunken manifest is a hard failure, never a silent skip.
- Intentionally divergent or framework-adapted modules (`KioskKeyboard.ts`, the
  `internal/` <-> `core/` adapters and controllers) are listed as unchecked at
  the top of the script, each with a reason. No `middleware/` module is exempt:
  `UNCHECKED_MIDDLEWARE_TWINS` is empty, because a middleware's
  framework-specific step belongs in the `input-operations` adapter
  (`commitComposition`, `insertText`), which leaves the middleware identical.
- Three completeness guards (`layouts/`, `internal/` <-> `core/`, `middleware/`)
  fail on any same-named pair that is in neither the checked nor the unchecked
  list, so a newly hand-duplicated module cannot skip the check by never being
  registered.

Adversarial validation record: `docs/specs/2026-06-11-twin-drift-check-adversarial-hypotheses.md`.

Run via `npm run test:twin-drift` (also part of `check` and CI).

## `check-style-twin-drift.mjs`

Parity check for the two hand-mirrored stylesheets
(`packages/kiosk-keyboard/src/themes/base/KioskKeyboard.less` vs
`packages/kiosk-keyboard-webc/src/themes/KioskKeyboard.css`) on the one thing that
must not diverge: the public custom-property surface.

- The twins are not compared line by line - they differ by language and by naming
  convention (`--ui5KioskKeyboard-variantHintInset` vs
  `--kiosk-keyboard-variant-hint-inset`), so names are compared as canonical
  lowercase tokens and privately-prefixed (`--_`) properties are excluded.
- Fails naming the property and which twin is missing it. A count below
  `EXPECTED_MIN_PROPERTIES` is a hard failure: two empty sets compare equal, so a
  renamed prefix or a broken pattern would otherwise pass while verifying nothing.
- Properties that legitimately exist in one twin only (the accent-variant popup
  layout, which webc owns and kiosk delegates to the UI5 static area) are listed in
  `PROPERTY_PARITY` with a reason, and an entry that no longer exists is itself a
  failure so the allowlist cannot rot.

Adversarial validation record: `docs/specs/2026-07-28-stylesheet-guards-adversarial-hypotheses.md`.

Run via `npm run test:style-twin-drift` (also part of `check:base` and CI).

## `check-dom-contract-drift.mjs`

Parity check for the two hand-mirrored DOM contracts
(`packages/kiosk-keyboard/src/internal/dom-contract.ts` vs
`packages/kiosk-keyboard-webc/src/core/dom-contract.ts`), which the e2e specs and
consumer CSS both target. `check-twin-drift.mjs` deliberately lists these modules
as unchecked, because the two differ by naming convention, so this compares them
structurally instead.

- Top-level groups are reconciled first: each group is classified `core`,
  `kioskOnly` or `webcOnly`, and an unclassified one fails. Without this the
  checks below silently cover only the groups they name, so a new group added to
  one twin would pass as being in parity with a twin that lacks it.
- `classes` and `selectors` are compared by key set, not by value: the values are
  the per-platform names (`ui5KioskKey` vs `kiosk-key`) and are expected to differ.
- `attributes` are compared by key **and** value, since a `data-*` attribute is
  the same string on both sides and is what consumer CSS and the e2e specs match on.
- A key that is in neither the core list nor the platform-only list fails, so
  adding one forces an explicit shared-vs-platform decision rather than defaulting
  to silence.

Adversarial validation record: `docs/specs/2026-07-21-dom-contract-drift-adversarial-hypotheses.md`.

Run via `npm run test:dom-contract` (also part of `check:base` and CI).

## `check-i18n-bundles.mjs`

Three invariants over `src/i18n/messagebundle*.properties` in both keyboard packages,
none of which is visible in a diff and all of which fail silently at runtime.

- **ASCII only.** Non-ASCII is written as `\uXXXX`. A raw UTF-8 value reads correctly
  in an editor and decodes to mojibake wherever the bundle is not served as UTF-8:
  the UI5 twin loads it through `Properties.create` →
  `LoaderExtensions.loadResource({dataType:"text"})`, which sets no charset. The
  damage lands in an ARIA announcement, which nothing on screen would show was wrong.
  This regressed once within a single branch (#216), which is why it is a guard.
- **Key parity.** Each locale bundle declares exactly the keys of its package's
  default bundle. A missing key silently serves the untranslated default; an orphan
  key is dead weight.
- **Call-site coverage.** Every key a package's `src/` asks for by literal exists in
  the default bundle. Key parity cannot catch this: `getText` takes a hardcoded
  fallback and `bIgnoreKeyFallback`, so a key absent from every bundle returns
  plausible text rather than failing. The scan reads literal `getText("KEY"` calls
  over `src/` and skips `generated/`; a key built from a variable is invisible to it.

Values are not compared: translations differ by definition, and the placeholder
counts that matter are already asserted by the tests over the rendered text.

Run via `npm run test:i18n-bundles` (also part of `check:base` and CI).

## `check-port-free.mjs`

Guards the QUnit ports before the suite starts. With a foreign listener already on
the port, `start-server-and-test` sees the URL respond, skips spawning its own
server, and runs the whole suite green against whatever code that listener is
serving. Each package's `test:qunit` prefixes the check: `hotkeys` on 8081,
`kiosk-keyboard` on 8082.

- The probe **connects** rather than binds. "Can I bind this port?" is a different
  question: a bind can succeed against a listener holding `SO_REUSEADDR`/
  `SO_REUSEPORT`, while a connect answers the question that actually matters -
  is something already answering here?
- Both loopback hosts are probed. `@ui5/server` binds `127.0.0.1` only, but
  `localhost` resolution order can put `::1` first, so a foreign listener bound to
  `::1` alone is hijackable while `127.0.0.1` is genuinely free.

`check-port-free.test.mjs` covers it, and is picked up by `test:lint-plugins`
(`node --test tools/*.test.mjs`).

## `trim-pages-dist.mjs`

Prunes the self-hosted GitHub Pages demo dist (`packages/demo-app/dist`) after a `ui5 build --all` with the SAPUI5 framework (`ui5-pages.yaml`). `--all` bundles the entire `sap.ushell` dependency closure (~560 MB); this trims it to the subset the keyboard launchpad actually loads (~150 MB) via three production trims:

- **Minified-only**: drop `*-dbg.js` debug duplicates, `*.js.map` source maps, and `*.less` sources (the compiled `library.css` is shipped).
- **Single theme**: keep `sap_horizon` (plus the required `base`); drop the unused `sap_hcb` / `sap_horizon_dark` / `_hcb` / `_hcw` variants.
- **Library tree-shaking**: keep only the libraries the FLP + demo load at runtime; drop the specialist `sap.ui.*` sublibraries `sap.ushell` declares but a keyboard launchpad never loads (3D viewport, charts, rich-text, cards, ...).

Run via `npm run build:pages` (through `build:demo:pages`) and the `deploy-pages` workflow. The KEEP/DROP lists are pinned to SAPUI5 1.149.0; revisit them on a framework bump.

## `tsconfig.json`

TypeScript configuration for the tools directory. Extends the root `tsconfig.json` with Node-appropriate module settings (`NodeNext`).
