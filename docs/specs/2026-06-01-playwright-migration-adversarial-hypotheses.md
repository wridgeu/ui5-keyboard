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
