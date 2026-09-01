# `customLayouts` (#216): adversarial hypotheses

- Date: 2026-08-03
- Design under test: the `customLayouts` aggregation and the `CustomLayout` element shipped for
  [#216](https://github.com/wridgeu/ui5-keyboard/issues/216)
- Suites under test: `latin-variants.{qunit,test}.ts`, the new `custom-layout-fold.{qunit,test}.ts`,
  `custom-layouts.qunit.ts` / `custom-layouts.test.ts` (rewritten from `instance-overrides.*`),
  `customLayouts-xml.qunit.ts`, `custom-layouts-first-paint.test.ts`,
  `instance-property-types.tsd.ts`, plus the `tools/check-*.mjs` guards and the CI generate gate
- Method (CLAUDE.md §7): a green suite can lie. Each hypothesis below is a way a green run could
  be a false positive. Cleared only after SEEING the suite go red for it, then reverting the
  perturbation. Written **before** Stage 1, not after Stage 3: H1 and H12 both bite in Stage 1,
  and a hypothesis recorded after the fact is a rationalisation, not a prediction.

## Why this file exists before any code

Two of the hypotheses below are not speculative. **H1 is a confirmed live vacuity at HEAD** — the
tests named "an explicit entry beats the wildcard" assert the one case the re-layering does not
change, so they stay green through the entire change while the behaviour underneath them is
rewritten. **H13 was probed and confirmed** during the design pass: an untracked `*.gen.d.ts`
passes `git diff --exit-code`, so the CI gate is blind to exactly the file this change adds.

Two more were _refuted_ during the design's refutation pass and are recorded here so nobody
re-derives the wrong premise. See H3 and H4.

## Status legend

`open` — not yet perturbed. `red-seen` — perturbation applied, suite observed failing, perturbation
reverted. `refuted` — the hypothesis itself was wrong; recorded with what replaced it.

---

## Stage 1 — the defaults-tier re-layering

- **H1 (the wildcard coverage is vacuous).** `red-seen` — cleared 2026-08-03. _Confirmed live at HEAD, not speculative._
  `packages/kiosk-keyboard/test/qunit/latin-variants.qunit.ts:192-199` and
  `packages/kiosk-keyboard-webc/test/unit/latin-variants.test.ts:170-176` are both titled
  "an explicit entry beats the wildcard" and both pass `["qwerty", null]` — traced through the
  proposed three-tier resolver, `{replace: true, table: null}` still yields `null`, so both stay
  green no matter which resolver is underneath.
  **Red proof:** land the three-tier `resolveVariantTable` with the old test bodies untouched and
  watch both suites pass; then add the defaults-plus-named case and confirm it goes red against the
  _old_ resolver. Clearing H1 requires seeing that second red, not the first green.

  **Result.** The old resolver was restored inside the new signature (named entry short-circuits,
  else the defaults tier) and the rewritten webc suite run against it: **3 failed / 30 passed**,
  and the three reds were exactly the three §4c rows marked CHANGED — "composes with a named entry
  rather than being discarded by it", "composes with a named entry on a non-Latin layout", "a
  letter it drops stays dropped when a named entry declares others". Everything else stayed green,
  including the renamed formerly-vacuous case, which is the confirmation that it was vacuous.
  Perturbation reverted; 33/33 green.

- **H12 (the twin-drift count guard is inert).** `red-seen` — cleared 2026-08-03.
  **Red proof, both directions:** bump `EXPECTED_PAIR_COUNT` to 28 without adding
  `custom-layout-fold` to `CORE_MODULES` — must fail at `tools/check-twin-drift.mjs:220-223`; then
  add the module without bumping the count — must fail at `:262`. A guard that only fails in one
  direction cannot catch the landing order this change actually risks.

  **Result.** Both directions fired, and neither was reachable through the other. Module present,
  count untouched: _"Unregistered twin module(s) in internal/ <-> core/: custom-layout-fold."_
  Count bumped, module unregistered: _"Pair manifest has 27 entries, expected 28."_ Registered
  properly, the checker reports 28 pairs in sync.

- **H15 (the byte-comparison is not actually comparing).** `red-seen` — cleared 2026-08-03. Stage 1 edits a `CORE_MODULES`
  pair and Stage 2 adds one; both rely on the drift checker reading the files it claims to.
  **Red proof:** change one character inside a function body in `latin-variants.ts` on one twin
  only, and confirm `test:twin-drift` goes red. Comments are stripped by `normalize()`, so the
  perturbation must be inside code, not a comment — a comment-only perturbation passing is the
  _expected_ behaviour, not a failure, and must not be mistaken for an inert guard.

  **Result.** `applyVariantOverlay`'s ternary was inverted in the webc copy only
  (`overlay.replace ? null : base` -> `overlay.replace ? base : null`). The checker printed the
  two-line diff and _"1 twin pair drifted."_ Reverted; 28 pairs in sync.

## Stage 2 — the fold

- **H16 (the diagnostics suite asserts codes it never triggers).** `red-seen` — cleared 2026-08-03.
  The catalogue is ten codes and the suite claims to cover every one.
  **Red proof:** delete one `diagnostics.push` from `foldCustomLayouts` at a time; each deletion
  must turn exactly one test red. A code whose deletion turns nothing red is asserted but not
  exercised.

  **Result.** Automated over all ten codes (each `diagnostics.push({code: "X" …})` replaced with
  `undefined`, suite run, source restored). Every code turned **its own dedicated test** red, and
  no code turned zero red. Each deletion also reddened the single `describeDiagnostic` completeness
  test, which asserts the fixture triggers all ten codes — that is the guard doing its job, not a
  second accidental assertion.

- **H17 (`unknown-target` and `invalid-rows` double-report).** `red-seen` — cleared 2026-08-03. `rowsDeclared` records that a
  `rows` was _present_, not that it was accepted, specifically so one mistake yields one warning.
  **Red proof:** move `rowsDeclared.add(name)` into the valid branch only; the "a rejected `rows`
  reports `invalid-rows` alone" test must go red with two diagnostics.

  **Result.** `rowsDeclared.add(name)` moved into the `else` branch: 1 failed / 32 passed, with
  _"expected [ 'invalid-rows', 'unknown-target' ] to deeply equal [ 'invalid-rows' ]"_ — the exact
  double-report the ordering guards against. Reverted.

## Stage 3 — kiosk cutover

- **H2 (the tsd file's failure mode).** `red-seen` — cleared 2026-08-03. **Refuted premise, corrected.** An earlier revision
  claimed `instance-property-types.tsd.ts` fails with six "Unused '@ts-expect-error'" errors. It
  cannot: D2 _deletes_ the four setters, so every guarded line stays an error ("Property does not
  exist") and the directives stay consumed.
  **Red proof:** change the kiosk metadata without touching the tsd file; `typecheck:kiosk:test`
  must fail on the file's **unguarded** accepted-shapes block at `:27-36`. Then, after rewriting,
  delete one directive and confirm the positive direction also fails.

  **Result.** The file was rewritten as `custom-layout-types.tsd.ts` against the new surface and
  compiles with every `@ts-expect-error` consumed — so each guarded line really is an error.
  Positive direction: deleting the directive above `layoutRole: "base"` produced
  `error TS2769: No overload matches this call`, which is the closed enum rejecting a typo at
  compile time. Restored.

- **H3 (the locale facet is covered vacuously).** `refuted`, kept as a probe. The design once stated
  this as fact. It is false: nine kiosk tests drive layout selection purely through
  `instanceLocaleLayouts` (`instance-overrides.qunit.ts:212,240,259,281,309,389,408`;
  `KioskKeyboard-layout.qunit.ts:902,948,1145`) and `instance-overrides.test.ts:87-110` does so on
  webc.
  **Red proof:** delete the `locales` branch from `foldCustomLayouts`; at least one kiosk and one
  webc test must fail. Expect red on the first try. If it stays green, _then_ the coverage is fake
  and the original claim was accidentally right.

- **H5 (DEF-3: N folds, N diagnostic passes).** `red-seen` — cleared 2026-08-03. Observe through `sandbox.stub(Log, "warning")`
  counts, **not** a spy on `foldCustomLayouts`: the UI5 AMD transpile captures named imports into
  module-scope consts at define time, so stubbing the module never intercepts the caller's binding.
  Exporting a call counter would violate CLAUDE.md §4.
  **Red proof:** call `_getFold()` eagerly from an `addCustomLayout` override; the "one fold, one
  warning, zero `unknown-target`" test must go red.

  **Result.** An `addCustomLayout` override calling `_getFold()` turned exactly
  "Construction folds once, over the complete list" red: the fold ran over each prefix of the
  list and reported the spurious `unknown-target` for the overlay that precedes its rows-declaring
  sibling. Reverted.

- **H6 (DEF-4: a property write tears down an IME buffer).** `red-seen` — cleared 2026-08-03.
  **Red proof:** put `this._getFold()` inside `invalidate()`; the "edit an unrelated custom layout
  mid-composition" test must go red with a lost preedit.

  **Result, and the stated red proof is wrong.** `_getFold()` inside `invalidate()` leaves the
  composition untouched — the fold reads elements and writes maps, and never reaches middleware
  state — so it reddens only H5's counting test. DEF-4 is about a re-fold path that _tears down_
  the buffer, so the perturbation has to do that: `this._endComposition()` inside `invalidate()`
  turned both "Editing an unrelated custom layout mid-composition leaves the buffer alone" and
  "A swap that leaves the resolved layout's factory alone keeps the composition" red. Reverted.

- **H7 (the `layoutRole` tri-state collapses).** `red-seen` — cleared 2026-08-03.
  **Red proof:** replace `layoutRole` with `secondary: { type: "boolean", defaultValue: false }` and
  confirm the "absent inherits the built-in" test goes red — `numeric` must stay secondary when the
  custom layout declares nothing. This exercises `ManagedObject.js:1611-1614` directly.

  **Result.** Collapsed at the `toSpec()` boundary instead, which is the same observable and a
  smaller perturbation: dropping the `role !== "Inherit"` guard makes the `Inherit` case emit a
  concrete `secondary: false`, exactly what a plain boolean property would do. Exactly one test
  went red — "An omitted layoutRole inherits the built-in of the same name's role" — and its
  `Base` sibling stayed green, which is what makes the three states provably distinct. Reverted.

- **H8 (`suppress` is a no-op).** `red-seen` — cleared 2026-08-03.
  **Red proof:** make `toSpec()` drop `suppress`; both the variants-suppress and middleware-suppress
  tests must go red. The middleware one is the sharper probe, because that capability **does not
  exist at HEAD** — a green run before the feature lands means the test asserts nothing.

  **Result.** Dropping `suppress` from `toSpec()` turned four tests red, the middleware one among
  them: "suppress=Middleware disables the built-in composer for the layout",
  "suppress=Variants opts a custom layout out of the built-in table", "suppress=Variants discards
  defaultVariants too…" and "Editing a custom layout's variants re-resolves on the next render".
  Reverted.

- **H9 (the XML path is never actually parsed).** `red-seen` — cleared 2026-08-03.
  **Red proof:** rename the aggregation in `metadata` to `customLayoutsX` without touching the view
  definition; `customLayouts-xml.qunit.ts` must fail. Then break `core:require` and confirm the
  `middleware` assertion fails _specifically_, not the whole view — a view that fails to parse at
  all proves nothing about the function-property path.

  **Result.** Renaming the aggregation to `customLayoutsX` turned 6 of the suite's 7 tests red
  (the seventh asserts the view _rejects_, and it still does). The `core:require` half is covered
  standingly rather than by perturbation: the middleware assertion calls the resolved value and
  checks the module's own counter incremented, so it fails on a value that is not that factory
  even when the view parses. That assertion also caught a real fact — `resolveReference` returns a
  **bound** function, so an identity comparison against the module member would have been wrong.

- **H10 (the runner passes while running zero tests).** `red-seen` — cleared 2026-08-03. After renaming
  `instance-overrides.qunit.ts` → `custom-layouts.qunit.ts`, `testsuite.qunit.ts` must gain the new
  key.
  **Red proof:** omit the registration and confirm the QUnit total assertion count drops.
  `ui5-test-runner` exits 0 on a suite it never loads, so the exit code is not the signal — the
  count is.

  **Result, and it is worse than "not the signal".** With `custom-layouts` removed from
  `testsuite.qunit.ts`, the runner executed **44 suites instead of 45**, the suite was absent from
  `report/output.txt` entirely, and the run **exited 0**. Forty-nine tests stopped existing and
  nothing anywhere said so. The only detection is the suite count in the report — the console
  table is a live-updating view and cannot be scraped for this. Registration restored and the
  count re-verified at 45.

- **H18 (the generated interface is not actually regenerated).** `red-seen` — cleared 2026-08-03. Stage 3 commits two
  `*.gen.d.ts` files and CLAUDE.md forbids hand-editing them.
  **Red proof:** hand-edit one accessor signature in `CustomLayout.gen.d.ts`, run
  `npm run generate -w packages/kiosk-keyboard`, and confirm the edit is overwritten. If it
  survives, the file is not on the generator's output path and the CI gate is guarding a fossil.

  **Result.** `getRows(): LayoutRows` was hand-edited to `getRows(): string /* HAND EDITED */`.
  After `npm run generate -w packages/kiosk-keyboard` the marker was gone and the correct
  signature restored, so the file is genuinely on the generator's output path.

## Stage 4 — webc cutover

- **H4 (DEF-1: the first-render fold is empty).** `red-seen` — cleared 2026-08-03. **Refuted premise, corrected.** An earlier
  revision said "every case in `instance-overrides.test.ts` assigns config after `fixture()`".
  `:87-110` does the opposite deliberately, with a comment saying so; model the new test on it.
  **Red proof:** move the fold behind the `onInvalidation` slot branch only; the connect-time-children
  test must go red. If it stays green, the test is asserting after an extra microtask and is not
  testing first paint. Build the whole subtree **before** `appendChild`, wrap `onAfterRendering` to
  capture paints, and assert on `paints[0]`, not the settled state.

  **Result.** `_getFold()` was made invalidation-driven — `if (this._foldEpoch === 0) return
EMPTY_FOLD;`, so the fold only exists once `onInvalidation` has bumped the epoch, which is
  exactly the shape the defect describes. **88 of 266 component tests failed**, the first-paint
  suite among them. The blast radius is itself the finding: the lazy read is not a nicety for one
  edge case, it is what makes the slot readable at all before the first render completes.
  Reverted; 310 passed.

- **H19 (`invalidateOnChildChange` does not actually fire).** `red-seen` — cleared 2026-08-03. This is the design's one
  deviation from first-party practice (`ui5-table` uses no child-change invalidation), so it carries
  more risk than the precedented parts.
  **Red proof:** set `invalidateOnChildChange: { properties: false, slots: false }` on the slot and
  confirm the "edit a slotted custom layout's property" test goes red. If it stays green, the test is
  passing on the array-identity path and the child-property signal is untested.

  **Result.** With `{ properties: false, slots: false }` exactly the three child-property-edit
  tests failed — "a middleware swap after the first key resolves the new factory", "a middleware
  swap commits the in-progress composition instead of discarding it" and "editing a custom
  layout's variants re-resolves on the next render". Nothing else moved, so the signal is real
  and it is the only thing carrying those cases. Reverted.

- **H20 (the CEM analyzer is not running).** `refuted` — probed 2026-08-03. The premise was that the
  analyzer _throws_ on an undocumented public member, and that `test:packages:smoke` — absent from
  CI — is the only step reaching it.
  **Red proof:** remove `@default` from one public member of `CustomLayout` and confirm
  `npm run check:base` goes red locally.

  **Result: it does not go red, and neither does the sharper variant.** Dropping `@default` from
  the public `name` property built clean (exit 0); so did annotating the
  `isKioskKeyboardCustomLayout` marker `@public`, which is the design's second listed trigger (a
  public boolean initialised to `true`). The analyzer itself plainly runs — a clean rebuild emits
  both element declarations, the `customLayouts` slot and the `default-variants` attribute — but
  the _documentation_ checks the design leaned on are not active in this repo's `generateAPI`
  chain. A member with an initialiser needs no `@default` tag for the analyzer to record one,
  which accounts for the first case.

  Consequence, stated rather than buried: the `@default` / `@public` / `@since` tags on
  `CustomLayout` are house style and are load-bearing for the published manifest's contents, but
  **nothing fails the build if a future member omits them.** The `@private` on the duck-type
  marker is still load-bearing for a different reason — it keeps the marker out of the manifest's
  attribute list — which is asserted by the manifest contents, not by a thrown error.

- **H14 (a variants assertion passes because the popup never opened).** `red-seen` — cleared 2026-08-03.
  **Red proof:** flip the assertion in each suppress test once and confirm red. A test that reads an
  empty popup passes for the wrong reason.

  **Result.** Flipping the expected value in "suppress=Variants opts a custom layout out of the
  built-in table" turned exactly that test red, so the assertion reads a real rendered state.
  The structural guard is stronger than the flip, and is why the suppress tests were written this
  way: each asserts a `false` _and_ a `true` on different keys of the same rendered layout, which
  a keyboard that rendered nothing could not satisfy. Reverted.

## Cross-cutting

- **H11 (visual baselines are not actually compared).** `red-seen` — cleared 2026-08-03. The "no baseline changes" claim is
  load-bearing across Stages 3 and 4, and covers **553** PNGs (270 kiosk / 283 webc), not the
  desktop-only 118 an earlier revision counted.
  **Red proof:** corrupt one committed PNG and confirm `test:e2e` goes red — **not** `test:e2e:ci`,
  which passes `--ignore-snapshots` and would stay green. Revert. Do this once per package: the
  webc fixtures Stage 4 rewrites drive 283 of the baselines, so a kiosk-only probe leaves the larger
  half unverified.

  **Result, both halves.** Run against the committed baselines after the cutover, with no snapshot
  written: kiosk desktop **100 passed**, webc desktop **92 passed / 2 skipped**. The settings and
  markup rewrites produce identical DOM.

  **Red proof.** 400 bytes deep inside the pixel stream of a committed baseline
  (`webc-accent-variants-forced-colors.png`) were flipped: `test:e2e` reported **1 failed / 91
  passed** and exited 1, so the comparison is real. The file was restored from git and the suite
  re-run green. Note the corruption must be past the header — and note that `test:e2e:ci` passes
  `--ignore-snapshots`, so it would have stayed green throughout.

- **H13 (the CI generate gate is blind to a new file).** `red-seen` — cleared 2026-08-03 in Stage 0.
  Probed with an untracked `packages/kiosk-keyboard/src/ZZProbe.gen.d.ts` present:

  ```
  git diff --exit-code -- .../KioskKeyboard.gen.d.ts            -> exit 0, blind
  git add -A -- packages/kiosk-keyboard/src
  git diff --cached --exit-code -- ':(glob)...**/*.gen.d.ts'    -> exit 1, correct
  ```

  The old path-literal form passes a brand-new generated interface because `git diff` does not see
  untracked files. Widening the glob alone does **not** fix it; staging first is what makes the glob
  load-bearing. Both forms were run against the same probe file, and the probe was reverted.
  Remaining check once the class exists: delete `CustomLayout.gen.d.ts` from git, regenerate, and
  confirm the gate still fails.

- **H21 (`check:base` and CI are treated as interchangeable).** `red-seen` — cleared 2026-08-03 by measurement. They are not: CI
  re-implements the chain, uses the stricter `lint:ci --deny-warnings`, and omits
  `test:packages:smoke` entirely.
  **Red proof:** introduce a failure reachable only through `test:packages:smoke` (a missing
  `requiredFiles` entry) and confirm `check:base` goes red while CI stays green. This hypothesis is
  cleared by _documenting_ the divergence, not by making the suites agree — closing the gap is a
  separate decision.

  **Result.** `check:base` does propagate a mid-chain failure: a deliberately misformatted file
  made it exit 1 at the first step. It runs to `test:packages:smoke`, which builds the webc
  package and verifies the dry-run contents of all three packages — none of which CI performs.
  So the divergence is exactly as the design states, and `check:base` was run locally and green
  before this landed.

  One trap met in passing, worth recording because it is the same class of lie this file is
  about: piping a runner into `tail` reports `tail`'s exit code, not the runner's. A `check:base`
  that had failed at `fmt:check` appeared to exit 0 for exactly that reason. Capture the status
  of the command itself, never of a pipeline ending in a pager.
