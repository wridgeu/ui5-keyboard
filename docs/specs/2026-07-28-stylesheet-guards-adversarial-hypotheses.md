# Stylesheet and CI-selection guards: adversarial hypotheses

- Date: 2026-07-28
- Status: Shipped. Historical record; later code changes are not folded back in.
- Guards under test:
  - `tools/check-style-twin-drift.mjs` (`npm run test:style-twin-drift`)
  - `patches/less-openui5-test.mjs` (`npm run test:patches`), which took over the
    lost-scope gate from the deleted `tools/check-css-scope.mjs`
  - the CI device-project selection in both `playwright.config.ts` files
- Method (CLAUDE.md §7): a green guard can lie. Each hypothesis below is a way a green
  run could be a false positive. Cleared only after SEEING the guard exit non-zero for
  it, then reverting the perturbation.

## Why the scope gate moved

`check-css-scope.mjs` scanned compiled stylesheets for rules that had lost their library
scope. The defect it policed is a less-openui5 behavior: `tree.Directive` gave every
at-rule block a `null` selector list and marked it as a root ruleset, so a style rule
nested inside `@supports` / `@container` / `@layer` rendered with the parent selector
dropped. Since a UI5 library stylesheet is loaded page-globally, `.ui5KioskKey {
@container (…) { &[data-has-variants]::after { … } } }` compiled to a page-global
`[data-has-variants]::after`.

That is fixed at the source in `patches/less-openui5+0.11.6.patch` instead of policed in
the output, so the gate is now a compile-time fixture that needs no build. `@media` was
never affected, because `tree.Media` already supplied the parent reference, which is why
the class of bug was invisible in the one at-rule the stylesheet used most.

**Accepted loss:** the deleted checker also asserted that _every_ rule in the built
`library.css` carries a `.ui5Kiosk*` class, which would catch a hand-written rule that
reaches into framework classes. The patch does not cover that. If it is later judged
worth guarding, guard it where a theme build already exists rather than adding one.

## Hypotheses

- **H1 (lost scope is detected).** If a conditional group rule stops resolving the parent
  selector, the fixture must fail rather than pass on the `@media` case alone.
  Perturbation: back the `directive.js` hunk out of the installed
  `node_modules/less-openui5` (restore `new tree.Ruleset(null, value)` and
  `rules[0].root = true`). Expected: red.
- **H2 (the extractor floor is live).** Two empty sets compare equal, so an extractor that
  silently matches nothing would pass while verifying nothing.
  `EXPECTED_MIN_PROPERTIES = 35` exists to catch that. Perturbation: break the kiosk
  prefix in `KIOSK_PROPERTY` at `tools/check-style-twin-drift.mjs:46`. Expected: red.
- **H3 (parity is live).** A token present in both twins must not be silently accepted as
  one-sided. Perturbation: add the symmetric `varianthintsize` to `webcOnly`. Expected: red.
- **H4 (allowlist freshness is live).** A `webcOnly` entry that no longer exists must fail
  rather than rot. Perturbation: add `totallybogustoken` to `webcOnly`. Expected: red.
- **H5 (zero test selection cannot pass).** Playwright 1.59.1 gates its "no tests found"
  check on the whole run, not per project, so a device project whose `testMatch` selects
  nothing still exits 0. Renaming the spec would turn all four device legs in both
  packages into silent no-ops while desktop still ran the renamed file and CI stayed
  green. The configs guard it with a load-time `existsSync`. Perturbation: rename
  `test/e2e/invariants.spec.ts` and list with `CI=1`. Expected: red.

  Residual, deliberately not guarded: `existsSync` proves the file is there, not that it
  still declares tests. A spec emptied in place, or one whose tests are all skipped or
  filtered out, still selects nothing per project and exits 0. Closing that needs a
  per-project test count, which Playwright exposes only through a custom reporter;
  the native guard covers the realistic accident (rename, delete) and a reporter was
  judged not worth owning for the rest.

## Results

Each perturbation was reverted immediately after observing red, and the guard re-run
green afterwards.

| Hypothesis | Perturbation                               | Observed                                                                                                          | Cleared |
| ---------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------- |
| H1         | back out the `directive.js` hunk           | red: `.scoped .nested[data-flag]::after { x4 (found 1)` + `a nested rule reached the top level unscoped` (exit 1) | yes     |
| H2         | kiosk prefix -> `ui5KioskKeyboardXX`       | red: `Only 0 public custom properties found in the kiosk stylesheet, expected at least 35` (exit 1)               | yes     |
| H3         | symmetric `varianthintsize` in `webcOnly`  | red: `one-sided "varianthintsize" now exists in both twins` (exit 1)                                              | yes     |
| H4         | `totallybogustoken` in `webcOnly`          | red: `one-sided "totallybogustoken" no longer exists in the webc stylesheet` (exit 1)                             | yes     |
| H5         | rename `invariants.spec.ts`, `CI=1 --list` | red: config threw at `loadConfig`, exit 1 (not a 0-test pass)                                                     | yes     |

H1 was additionally confirmed to hold on the nested `@ui5/cli` copy: `patches/apply-nested.mjs`
syncs the patched files, and `less-openui5-test.mjs` runs the same fixture against every
nested copy it finds, so a broken sync fails `test:patches` rather than a later theme build.

## Accepted residuals

- `EXPECTED_MIN_PROPERTIES` is 35 against real counts of 40 kiosk / 44 webc, so a
  _symmetric_ extractor regression that dropped up to five names on both sides would still
  pass. The floor only has to catch a prefix rename or a dead pattern, which take the count
  to zero.
- The less-openui5 fixture proves the compiler resolves the parent selector. It does not
  prove the kiosk stylesheet never writes a genuinely unscoped top-level rule; that is the
  coverage the deleted checker had and this does not replace.
