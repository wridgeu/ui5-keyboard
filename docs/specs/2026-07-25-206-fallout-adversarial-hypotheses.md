# Adversarial hypotheses: #206/#205 test hardening

Date: 2026-07-25

An adversarial review of the merged #206/#205 diff (`dd117a5c`, `e6f58e53`) raised six findings. Five were test and documentation gaps and are fixed here; one was a claimed rendering regression and is falsified below.

The two tests #206 shipped could both pass while the behaviour they name was fully broken, so each hypothesis was cleared only after the suite was **seen** to fail for it.

## Results

| #   | Hypothesis                                                                                        | Verdict              | Evidence                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | The legibility test passes vacuously when the library stylesheet has not applied                  | **confirmed, fixed** | Held the `sap-ui-theme-ui5.kiosk` sheet disabled for the whole run. `scrollWidth <= clientWidth` passed as `needs 0px, has 0px` on all three keys — the exact `0 <= 0` pass. The added `has a laid-out box` guard failed on all three. Without it the test is green while measuring nothing.          |
| H2  | The test never proves the 320px narrowing took effect                                             | **confirmed, fixed** | Pinned `.ui5KioskKeyboard { width: 1000px !important }`. The added narrowing assertion failed (`73.0px → 73.0px`) and **every other assertion still passed**, so before this change a root that stopped sizing its rows would have left the suite fully green on an unexercised narrow case.          |
| H3  | The hardened test no longer catches the bug #206 actually fixed                                   | cleared              | Restored the pre-#206 `ローマ字` label and dropped its width: the ellipsis assertion fails with `needs 32px, has 17px`, reproducing the issue's reported 45px-into-a-tiny-box symptom. Re-verified against the final source, not only the intermediate one.                                           |
| H4  | Deleting webc's icon-only bump rule goes undetected                                               | **confirmed, fixed** | Deleted `KioskKeyboard.css:795-798` outright. Before: 486 vitest + 256 web-test-runner all green. After adding the guard: fails with `Shift icon is bumped above its own key font (11.2 vs 11.2px)` — the same 11.2px the kiosk twin was measured against.                                            |
| H5  | Collapsing the bump rule's two-arm selector to one arm goes undetected                            | **confirmed, fixed** | Collapsed `.kiosk-key--dual .kiosk-key__icon, .kiosk-key[data-fkey].kiosk-key--dual .kiosk-key__icon` to the first arm alone, the plausible "this reads as a duplicate" edit. The new test fails on `{fkey:Home}` while Shift still passes, isolating exactly the nav keys the second arm exists for. |
| H6  | Dropping the modifier/action exclusion from `--multi` shrinks labels that already fit (finding 2) | **falsified**        | See below. Measured at the real phone-sm geometry, the shrink is load-bearing.                                                                                                                                                                                                                        |

## H6 in full: why the claimed regression is not one

The review held that #206's third change — dropping `key.type !== "modifier" && key.type !== "action"` from the `--multi` class — shrinks short word labels that fit fine, since the clamp engages on a width-to-font ratio (content < 2.857em) and never inspects the label.

The mechanism is real, and at wide containers the cost is visible but trivial (`Fn`/`123` render at 12.4px instead of 12.8px on the 400/445px fixtures). The claim fails on the case that matters. Measured inside the phone-sm Playwright project, the `ja-kana` fixture container is **280px**, not the 320px an interactive probe against `test/e2e/visual/index.html` suggests — that page's `.keyboard-container` is fluid, so setting an explicit 320px width on it does not reproduce the profile:

| Key    | Key width | Available | Text at full 1em | Clipped at full font | Font needed to fit |
| ------ | --------- | --------- | ---------------- | -------------------- | ------------------ |
| `123`  | 20.8px    | 15px      | 18.69px          | **yes**              | 8.99px             |
| `英数` | 23.3px    | 17px      | 22.41px          | **yes**              | 8.50px             |
| `Fn`   | 20.8px    | 12px      | 12.30px          | no (marginal)        | 10.93px            |

Two of the three labels need roughly 8.5–9px to fit, so the `0.5rem` clamp floor is close to the required size rather than gratuitous. Reverting the exclusion was implemented and rejected on the evidence: it turned 59 of 274 kiosk baselines red, and the regenerated `phone-sm/kb-ja-kana` capture rendered `1...` and `英...` where the committed baseline renders `123` and `英数` legibly.

A length-aware clamp (renderer emits the label's character count; the clamp scales as available-width / chars) would shrink only as far as each label needs and would beat both the flat 0.35 factor and the exclusion. It is not implemented here — it changes both renderers and moves baselines again.

## What this change does not cover

`test:e2e:ci` runs `--project=desktop --ignore-snapshots` in both packages (`packages/kiosk-keyboard/package.json:44`, `packages/kiosk-keyboard-webc/package.json:86`), so CI still executes the visual specs without comparing pixels, and the webc bump rule only fires below the 7rem key threshold — i.e. never on the desktop project. The new webc test is a component test precisely so it runs under `test:component` in CI rather than depending on a pixel comparison that CI does not perform.
