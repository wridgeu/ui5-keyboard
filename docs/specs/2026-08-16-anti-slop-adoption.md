# anti-slop adoption and full-repo deslop pass

**Date:** 2026-08-16
**Status:** Implemented
**Branch:** `chore/full-repo-deslop`, stacked on `fix/native-text-insertion` (PR #234)
**Packages:** all four, plus `tools/`

This is a working record for a pass that spans more commits than one sitting. It exists so the
work can be picked up without re-deriving the decisions. Sections 1 to 3 are settled; section 6
is the resume procedure.

## 1. What was added

The [anti-slop](https://github.com/dmmulroy/anti-slop) oxlint plugin, vendored to
`tools/oxlint/anti-slop/` and registered in `.oxlintrc.json` alongside the three house plugins.
All 15 rules run at `error`. It matches on type evidence (assertion chains, `unknown` in a
contract, dictionaries with no value type, annotations that discard inference) where the house
plugins match on comment text and statement shape.

Landed in `eec9a4cc`.

## 2. Why vendored rather than depended on

Vendoring is not a preference here, it is the only thing that works. Investigated on request and
confirmed empirically:

- The package is `private: true` and unpublished, so it could only ever be a git dependency.
  A git dependency carries no integrity hash and bypasses the `min-release-age=7` supply-chain
  gate in `.npmrc` entirely.
- Upstream pins `@oxlint/plugins@1.78.0` against this repo's `oxlint@1.74.0`, and 1.78.0 is
  younger than the 7-day cooldown, so it needs an `overrides` entry just to resolve.
- The blocker: the package ships TypeScript source with no build step
  (`"exports": "./src/index.ts"`). Node refuses to strip types from anything under
  `node_modules`:

  ```
  ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING
  ```

  It is unconditional and path-based. Verified that neither
  `NODE_OPTIONS=--experimental-strip-types` nor `--experimental-transform-types` lifts it, and
  that a bare specifier and a direct `./node_modules/.../src/index.ts` path fail identically.
  It is also not an install problem: `npm install` succeeds either way, the failure is at
  runtime when oxlint's Node process imports the plugin, so no npm flag can reach it.

Two workarounds do exist and both were verified to load the plugin and fire its rules:

| Option | Mechanism                                                                           | Cost                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A      | `NODE_OPTIONS="--import tsx"`, a loader intercepts before Node's built-in stripping | `tsx` dependency, plus a Windows-portable way to set the env var at all four oxlint entry points including `lint-staged.config.mjs` |
| B      | Stage the source out of `node_modules` at `postinstall` into a gitignored dir       | zero new dependencies, no env var, no wrapper, platform-neutral                                                                     |

A tested `tools/sync-anti-slop.mjs` for option B exists but is **not** applied. Decision pending.
Until then the vendored copy stands.

## 3. Rule scoping

One override, in `.oxlintrc.json`:

```json
{ "files": ["packages/*/test/**"], "rules": { "anti-slop/require-safety-comment-for-type-assertion": "off" } }
```

That rule produced 554 of its 673 findings in test files, where casts feed deliberately invalid
values to the code under test and so have no invariant to state. This mirrors the existing
`code-quality/no-double-type-assertion` exemption. Every other rule applies everywhere,
tests included, with no overrides: findings that cannot be fixed are reported as blocked instead.

Scoping took the repo from 933 findings to 379.

## 4. Standing decisions for this pass

Re-deciding these is the main way a resumed session wastes effort.

- **A behavior change is never an acceptable price for a lint finding.** Revert it and report the
  finding as blocked. Blocked is an honest outcome; an override is not, and a silent behavior
  delta in a shipping library is the worst of the three.
- **`interface X { [k: string]: V }` does not fix `no-known-value-widening`, it dodges it.**
  anti-slop's widening classifier
  (`tools/oxlint/anti-slop/shared/dictionary-types.ts`) resolves type aliases but never interface
  declarations, so the identical shape written as `type X = Record<string, V>` is still flagged
  while the interface form goes silent. The contract is unchanged. Confirmed by probe.
- For a constant lookup table, choose by how it is read: only literal keys means drop the
  annotation and let inference keep them (`satisfies` if the constraint is wanted); an arbitrary
  runtime string means `Map` with `.get()`, which lints clean honestly and matches the
  `new Set<string>()` idiom already in those files. Note that `Map` stops resolving a key named
  `toString`/`constructor` to a prototype member, which is a latent-bug fix worth calling out.
- **A public exported constant is exempt from the above**: keep its annotation and runtime shape,
  report the finding as blocked. Narrowing a documented-stable export is a breaking change for
  consumers and outranks any lint finding. This is why `latin-variants` keeps `: VariantTable`.
- Twin modules must land on the same choice on both sides, drift-pinned or not.

## 5. Where the pass stands

| Stage                                                            | State            |
| ---------------------------------------------------------------- | ---------------- |
| Vendor + configure + scope                                       | done, `eec9a4cc` |
| Resolve the 379 findings (13 units, each adversarially verified) | done, `1197b580` |
| Remediate the 32 problems the verifiers raised                   | done, `1197b580` |
| General deslop sweep, 377 files (34 changed, 42 edits)           | done, `1197b580` |
| Record the 44 accepted findings as inline disables with reasons  | done, `1197b580` |

Final state: `oxlint` reports nothing, including under `--deny-warnings`; `typecheck` clean;
all four drift guards in parity; 67/67 lint-plugin tests; webc 602 unit and 351 component tests;
both QUnit suites exit 0.

### How the accepted findings are recorded

An "error" the repo intends to keep would fail the pre-commit hook, `lint:ci` and `check:base`
forever, so reporting a finding as blocked is only half an answer. Each of the 44 carries an
`// oxlint-disable-next-line` preceded by its reason, which is the mechanism `tools/README.md`
already prescribes for the `test-guardrails/no-hard-wait` opt-out. This is per-site and reviewed:
a NEW violation of those rules still fails the build, and the justification sits where the next
reader will find it. No rule was weakened in `.oxlintrc.json`.

One file takes a file-level disable instead: `packages/hotkeys/test/qunit/router-integration.qunit.ts`
suppresses `no-chained-type-assertions` and `no-object-parameters` for the whole file, under one
rationale at the top. That suite exists to prove the duck-typed half of `enableRouterIntegration`'s
documented contract, so `MockRouter as unknown as Router` is the subject of the test rather than a
shortcut, and it recurs fifteen times with the identical justification. Fifteen copies of the same
two paragraphs would be worse than one statement of them.

The alternative was tried and rejected: replacing the mock with a real `Router` forces the suite
to drive `fireBeforeRouteMatched`, which UI5 marks `@ui5-protected`, and it proves only the
concrete-Router path while the JSDoc promise goes untested. It also fails `lint:ui5`, because
`ui5lint` reads `new Proxy(router, …)` as constructing a Router and reports the deprecated
`oConfig.async` default.

The adversarial verify step is what makes this trustworthy and must not be dropped on resume: it
caught a real shipping regression that a green-looking unit had introduced (a `typeof` guard in
`custom-layout-fold` rewritten to optional chaining, which turned a documented-total function into
one that throws on a non-string property arriving from plain JS, killing a whole custom layout
instead of degrading one facet). It was found by running the suite, not by reading the diff.

## 6. Decisions and residuals that live nowhere else

Recorded because a reviewer correctly pointed out they were otherwise only in a chat transcript.

- **`document as unknown as Element` in `event-dispatcher.qunit.ts`** (two sites) was rewritten as
  `const documentNode: Node = document` followed by `documentNode as Element`, and is **kept**.
  `Node` is a genuine shared supertype of `Document` and `Element`, so this is a legal upcast plus
  downcast rather than a reinterpretation through the top type. It is not held up as a pattern to
  copy: laundering a deliberately-wrong test value through an intermediate type usually is a dodge,
  and these two survive only because the intermediate is a real supertype.
- ~~**`fireBeforeRouteMatched` is `@ui5-protected`**~~ **Resolved.** The swap to real `Router`
  instances was reverted and `router-integration.qunit.ts` is back on its hand-rolled
  `MockRouter`, so the suite touches no protected framework API and keeps the duck-typed
  coverage it was always the point of. See the file-level disable noted in section 5. Original
  finding, kept because it explains that disable:
  `router-integration.qunit.ts` drove 18 call sites through it. This arrived when the
  hand-rolled `MockRouter` was replaced with real `Router` instances. The duck-typed half of
  `enableRouterIntegration`'s documented contract ("a UI5 Router or any object with
  `attachBeforeRouteMatched` / `detachBeforeRouteMatched`") lost its only coverage in that swap and
  was restored as a Proxy stand-in test that records any member read or probed outside the
  documented pair. Open residual: the suite depends on a non-public framework method, so a UI5
  upgrade can break it in a way the old plain-object mock could not.
- **`ICON_MAP` and `SPECIAL_KEY_LABELS`** in the webc element keep their `Record` annotations and
  their findings are blocked, rather than becoming `Map`. Their kiosk twin `SPECIAL_KEY_ICONS` is
  re-exported as the public static `KioskKeyboard.SPECIAL_KEY_ICONS` and is documented stable, so
  the public-export exception in section 4 applies to it, and the twins must land together.

## 7. Resuming

Nothing here depends on session-local scratch state. Regenerate rather than trust a stale list.

```bash
git -C . switch chore/full-repo-deslop

# Current findings, grouped by rule. All remaining ones should be deliberate blocks.
npx oxlint --format=json packages/ tools/ patches/ > /tmp/lint.json

# The guards that constrain edits in this repo. All must stay green.
node tools/check-twin-drift.mjs
node tools/check-style-twin-drift.mjs
node tools/check-dom-contract-drift.mjs
node tools/check-i18n-bundles.mjs

# The suites. The webc component suite is the one that caught the regression above.
npm run test:kiosk-webc && npm run test:kiosk-webc:component
npm run test:qunit
```

Recovery points, in order of preference:

- `eec9a4cc` is the last clean commit (plugin installed and configured, no product code touched).
- `refs/wip/deslop-20260816` is a snapshot of the working tree taken mid-remediation. Inspect with
  `git show refs/wip/deslop-20260816 --stat`, restore with
  `git restore --source=refs/wip/deslop-20260816 -- .`. It is a safety net for an interrupted
  session, not a commit to build on.

A caveat for any mid-flight commit: `lint-staged` runs `oxfmt` and `oxlint --fix` over staged
files, so committing while agents are still editing can rewrite files under them. Snapshot with
`git stash create` plus `git update-ref` instead, which touches neither the working tree nor the
hooks.

### Notes from an interrupted run

The remediation stage was cut in half by a session limit, so these are observed rather than
assumed:

- **An agent's file edits survive its own failure.** Seven agents died returning their results;
  their edits were already on disk. The reported outcome and the tree had diverged, so the tree
  is the authority. Re-measure with `oxlint` and the drift checks before believing any summary,
  including this document's.
- **A rising finding count can be the correct direction.** Reverting a behavior change re-raises
  the finding that motivated it. The count went 31 to 43 across the remediation stage and that
  was the intended result, not a regression.
- Re-running a resumed unit is safe: the remediation prompts are written to be re-entrant, so an
  agent that finds its problems already fixed reports them as such rather than double-applying.

### What the review found, and why the checks are worth keeping

Every stage of this pass was checked by an independent reviewer, and the reviewers caught things
no test or linter would have. Worth knowing before trusting a similar pass:

- A guard rewritten to optional chaining turned a documented-total function into one that throws,
  killing a whole custom layout instead of degrading one facet. Found by RUNNING the suite, not
  by reading the diff.
- A fix was reported as applied and had not been: the two webc icon tables were still `Map` while
  their kiosk twins had reverted, which would have made the packages disagree at runtime on a key
  named `toString` or `constructor`.
- Fourteen of the first forty-four disable rationales asserted something false. The most common
  was "`ManagedObject.validateProperty` rejects a non-string": it COERCES
  (`oValue = "" + oValue`, under the framework's own comment "Implicit casting for string only").
  Others cited a method (`_getKeyIconInfo`) and a property (`variantTable`) that do not exist.
  A confidently wrong comment is worse than none, so each was rewritten against the real source.

The lesson for a resumed session: an agent's report is a claim, not evidence. Re-measure with
`oxlint`, the drift checks and the suites, and check a rationale against the framework source
before believing it.
