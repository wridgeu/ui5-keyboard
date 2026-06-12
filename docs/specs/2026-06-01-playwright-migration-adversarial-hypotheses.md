# Adversarial validation of the Playwright / ui5-test-runner migration

Goal: prove the migrated suites FAIL on real regressions (no false positives),
not just that they pass today. For each hypothesis we inject a fault and confirm
the suite goes red, then revert.

## Hypotheses (how a green run could be lying)

| #   | Hypothesis (false-positive / break)                                                                                    | Adversarial check                                                                                 | Expected                        |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------- |
| H1  | A failing QUnit assertion does NOT fail `test:qunit` (exit code swallowed by start-server-and-test / ui5-test-runner). | Inject `assert.strictEqual(1, 2)` into a hotkeys QUnit module, run `test:qunit`.                  | non-zero exit, failure reported |
| H2  | `test:qunit` passes while running ZERO tests (wrong URL / blank page / browser not launched).                          | Point the runner at a bogus test name / break the server, run.                                    | fail (no test page)             |
| H3  | A Playwright behavioral spec is vacuous (assertion not live).                                                          | Flip a focus.spec expectation to the wrong state.                                                 | test fails                      |
| H4  | A Playwright visual spec does not actually compare against the committed baseline.                                     | Corrupt a committed baseline PNG, run that spec.                                                  | toHaveScreenshot fails          |
| H5  | The `SOFT` (maxDiffPixelRatio 0.01) tolerance hides a real one-key change.                                             | Inject a visible CSS change under the tolerance, run a SOFT-tagged spec.                          | fail (if tolerance is safe)     |
| H6  | The FLP spec passes without the i18n behavior (assertion not live).                                                    | Flip an FLP label expectation.                                                                    | test fails                      |
| H7  | `openPage` ATTACHED-only readiness lets a behavioral spec act before keys render.                                      | Reviewed: behavioral clicks rely on auto-retrying expect; hardened to key-render wait for parity. | n/a                             |

## Results

- **H1 CONFIRMED (no false positive).** Injected `assert.strictEqual(..., "ADVERSARIAL_FAIL")` into `constants.qunit.ts`; `npm run test:qunit -w packages/hotkeys` exited 1 with `failed: true` reported. The exit chain (QUnit -> ui5-test-runner `process.exitCode=-1` -> start-server-and-test execa reject -> npm exit 1) is fail-closed. Reverted.
- **H4 CONFIRMED (no false positive).** Overwrote the committed `desktop/kb-qwerty.png` baseline with the `kb-numpad` image; the `kb-qwerty` visual test exited 1. Visual specs genuinely compare against committed baselines (a missing baseline also fails under CI, not silently passes). Restored.
- **H3 CONFIRMED (assertion live).** Flipped the focus "opens" test to assert the closed state; it failed. Behavioral assertions are live, not vacuous. Reverted.
- **H2 / browser backend / readiness:** verified by code-trace audit (ui5-test-runner fails on `noTestPageFound`; `$/playwright.js` resolves and fail-closes on a missing browser; the `$/` literal survives cmd.exe and sh). No empirical zero-test false-pass path.
- **H6 (FLP):** assertions verified live by audit + the H3 pattern; FLP uses the same `expect`/`toHaveText` gating.

## Findings applied

- Dropped the `kb-qwerty-reduced-motion` snapshot: it was byte-identical to `kb-qwerty` across all 5 projects (the keyboard has no idle animation), so it added no regression-detection value.
- Tightened the interactive/shifted snapshot tolerance from `maxDiffPixelRatio: 0.01` to `0.003` (still absorbs device sub-pixel jitter, but ~3x less room to mask a real one-key change).

## Note: no minimum-test-count floor

ui5-test-runner fails on zero test pages, but does not assert that ALL declared modules ran (a transpile error that drops a module from the enumerated testsuite would still pass on the survivors). CI should treat any transpile warning as fatal; this is documented as a known gap.

## Independent re-validation (2026-06-01, second pass)

Re-ran the highest-value injections against the current branch HEAD to confirm the
suites are still fail-closed (not trusting the first pass's record), and closed the
empirical gap on the runners that pass empty.

- **H1 re-CONFIRMED.** Flipped `dom.qunit.ts` "input with no type" to `assert.ok(!isInputElement(el))`; `npm run test:hotkeys:qunit` exited 1 (ui5-test-runner exitCode -1 -> start-server-and-test execa reject -> `npm error code 1`). Reverted.
- **H3 re-CONFIRMED.** Set `inputmode.spec.ts` first test to expect `"ADVERSARIAL_FAIL_H3"`; `playwright test --project=desktop --ignore-snapshots inputmode.spec.ts` exited 1 (1 failed / 3 passed: 4 tests genuinely ran, so the webServer started and the suite is non-empty). Reverted.
- **H2 (zero tests) empirically CLOSED for Playwright.** `playwright test --project=desktop <nonexistent>.spec.ts` exits 1 with "No tests found"; `passWithNoTests` is set nowhere in either config. The headline runner cannot pass empty. (ui5-test-runner side remains as audited: it fail-closes on a missing target; a direct bogus-URL run also exited non-zero.)
- **H4 re-CONFIRMED.** Clean single-test run `visual.spec.ts -g 'kb-qwerty$'` passed on this platform (Windows baselines), then overwriting `desktop/kb-qwerty.png` with the numpad image made it exit 1 (ratio 0.14 differing pixels). Comparison is live. Restored.
- **H5 (SOFT tolerance) cleared analytically.** `kb-qwerty` is 320x331 (~105.9k px); `maxDiffPixelRatio: 0.003` ~= 318 px of slack. A single key cell is ~30x30 (~900 px) and the H4 layout swap differed by 59,564 px, so a real one-key/one-glyph change comfortably exceeds the tolerance.
- **Findings-applied verified present:** `kb-qwerty-reduced-motion` baseline is gone (replaced by an explanatory comment in `accessibility-media.spec.ts`); `SOFT = { maxDiffPixelRatio: 0.003 }` in `visual.spec.ts`.

### Incidental observation (not a test-integrity issue): gen.d.ts regeneration on serve

Running the kiosk Playwright e2e suite reproducibly rewrites
`packages/kiosk-keyboard/src/KioskKeyboard.gen.d.ts`, stripping ~444 lines of
getter/setter JSDoc and leaving a dirty tree (observed after every kiosk e2e run;
the hotkeys QUnit run does not touch it). The kiosk `test:e2e` script does not run
`generate`; the rewrite comes from the `ui5 serve` webServer. The committed file is
exactly what `npm run generate` (kiosk-pinned `@ui5/ts-interface-generator@0.11.1`,
the version `pretypecheck`/CI uses) produces, confirmed by a 0-diff regen, so CI
stays green and the artifact is correct. But two generator versions coexist (root
`0.10.5`, kiosk-local `0.11.1`), and a commit made after a local serve/e2e run would
strip the JSDoc. Worth the author confirming the serve path doesn't invoke a
divergent generator. Out of scope for the migration's test integrity; CI-correct today.
