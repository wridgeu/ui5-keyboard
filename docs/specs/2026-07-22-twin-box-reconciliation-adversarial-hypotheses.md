# Twin box reconciliation: adversarial test-validation hypotheses

Date: 2026-07-22
Issue: #190 (fixed within PR #188 rather than deferred)

Per CLAUDE.md section 7, a green suite can lie. This change reconciles the two
`ResponsiveSizingController` twins to measure the height constraint in the same space
(untransformed layout pixels, border excluded): the kiosk twin moves from the transformed
`getBoundingClientRect().height` border box to `clientHeight`, and its observation guard
records the box from `getComputedStyle` used values (untransformed) instead of the
transformed rect, so it keeps matching the entries' `borderBoxSize` under a CSS transform. Below is each "how could
a green run be lying?" hypothesis, written before the implementation, and the empirically
observed red that cleared it. Every red is reverted immediately after observation.

Status legend: `CLEARED` = red seen and reverted. `NOT CLEARED` = the hypothesis held; the
gap is real and is recorded rather than papered over.

## H1 — The kiosk transform test is not actually sensitive to the measurement source

Hypothesis: the new `Breakpoints measure layout pixels` test (keyboard at 15rem layout
height inside a `transform: scale(0.5)` wrapper, expecting `cqShort` and not `cqTiny`)
could pass against the rect-based measurement too, e.g. because the wrapper transform does
not affect the fixture's rect the way the analysis assumes, proving nothing about the
reconciliation.

Refutation plan: run the test against the unchanged rect-based controller first (test-first
red). The rect-based measurement reads the 7.5rem visual height, which is under the 12rem
tiny threshold, so both assertions must go red with `cqTiny` applied.

Status: CLEARED. Against the rect-based controller, `KioskKeyboard-responsive` went
`18/19` with exactly this test's two assertions red (`cqShort applied from the 15rem
layout height`, `the 7.5rem visual height does not trigger cqTiny`) and a non-zero exit.
After the fix: `19/19`.

## H2 — The rewritten measurement stub no longer feeds the implementation

Hypothesis: `setMeasuredHeight` switches from stubbing `getBoundingClientRect` to stubbing
`clientHeight`. If the implementation did not actually read `clientHeight`, every
stub-driven boundary and threshold test would exercise real layout instead of the stubbed
values and could stay green for accidental reasons (or assert nothing about the stub).

Refutation plan: with the fix in place, disable the `clientHeight` stub (leave the
`scrollHeight` stub) and confirm the stub-driven boundary/threshold tests go red, proving
the stub is load-bearing for exactly those tests.

Status: CLEARED. With the stub disabled, `KioskKeyboard-responsive` went `13/19`: the
intrinsic growth/shrink tests, the constraint-transition test and both custom-threshold
tests went red, i.e. exactly the stub-driven set. Reverted.

## H3 — The guard's redundancy verdict is not live

Hypothesis: the width-filter test fabricates `ResizeObserverEntry` arrays, so a
`_reportsAppliedBox` that stopped consulting the entry (or always returned false after the
recorded-side switch) could leave the suite green while the guard silently drops nothing.

Refutation plan: short-circuit `_reportsAppliedBox` to `return false` and confirm the
"the applied box is treated as redundant" assertion goes red.

Status: CLEARED. With the short-circuit in place, that assertion went red and
`KioskKeyboard-renderer-blackbox` went `26/27` on the perf pin in the same run. Reverted.

An unplanned red also cleared the end-to-end half of this hypothesis. The first
implementation draft recorded content boxes and compared `contentBoxSize`, which does not
match for a `box-sizing: border-box` element (`getComputedStyle` used values denote the
border box there, confirmed with a standalone probe in the runner's own Chrome: computed
`240.688px` vs `borderBoxSize` `240.6875` vs `contentBoxSize` `214.09375`). With that
mismatched pair the guard silently dropped nothing and
`KioskKeyboard-renderer-blackbox` went `26/27` on the #180 perf pin. The pin therefore
catches a guard that fails to match, not just a guard that is absent.

## H4 — The webc transform pin is vacuous

Hypothesis: the webc twin already measures untransformed layout pixels via `clientHeight`,
so its new transform-scale test is green from day one. A pin that cannot go red is not a
pin; it must be shown to fail if the webc measurement ever drifts to a transformed source.

Refutation plan: temporarily switch `_getHostContentHeight` to
`getBoundingClientRect().height` and confirm exactly the new test goes red.

Status: CLEARED. With the transformed source, the component suite went `245/246` with
exactly the new test red (`cq-short from the 15rem layout height: expected false to be
true`) and a non-zero exit. Reverted.

## H5 — The runners mask failures or run zero tests

Hypothesis: the QUnit runner or the webc component runner reports success while executing
zero tests, or a partial run summarises only the files that ran (both failure modes have
been observed in this repo before).

Refutation plan: record test counts for every run, confirm they are non-zero and move in
the expected direction when tests are added, and confirm the injected reds of H1-H4
propagate to non-zero exit codes.

Status: CLEARED. `KioskKeyboard-responsive` went 18 to 19 tests when the transform test
was added, the webc component suite 245 to 246, and every injected red in H1-H4 surfaced
as a reported failure with a non-zero exit. One masking effect was observed and fixed in
the harness usage rather than trusted: piping the runner output through `tail` swallowed
the exit code (a crashed zero-test run initially reported success), so all subsequent runs
captured the exit code explicitly before any filtering.

## H6 — (addendum) The webc border dead zone is invisible to the existing suite

Hypothesis: webc's `naturalHeight` (`root.scrollHeight`) excludes the root's own border,
while the granted host content box must fit the root's border box, so a clip of up to
borderY pixels (2px at the default 1px border, scaling with the public
`--kiosk-keyboard-border` override) goes undetected and the keyboard renders visibly
clipped with no compaction class. Every existing test clips by far more than borderY, so
the suite is expected to stay green with the defect present. The kiosk twin has no such
zone: it compares `scrollHeight` against `clientHeight` on the same element, so its border
cancels.

Refutation plan: coverage gap, not a passing test to break. Write two dead-zone tests
(default border, host height = natural border-box height minus 2px; a 4px border override,
clip 6px), confirm both fail against the uncorrected controller, then fix by adding the
root's computed vertical border to `naturalHeight` and confirm green.

Status: CLEARED. Against the uncorrected controller both tests failed (cq-short never
applied, 2 failed of 248, non-zero exit); with the border term added the component suite
went 248 passing, 0 failed.

## H7 — (addendum) The kiosk threshold border term is untested / breaks the stub harness silently

Hypothesis (#193): the kiosk tier comparison used `clientHeight` (padding box) while the
webc twin compares its host content box, i.e. the granted box the root's border box must
fit. The two twins therefore chose different tiers for container heights within the root's
vertical border of a threshold (2px at the default border, scaling with
`--ui5KioskKeyboard-border`). The fix tiers on `clientHeight + border`. Two ways a green run
could lie: (a) the stub helper `setMeasuredHeight` stubs `clientHeight`, so the border term
could be silently a no-op under it (the fixture may carry no theme border, making
`rootBorderY === 0`); (b) shifting the tier input by the border could break the existing
boundary tests without any new test noticing.

Refutation plan: the new test sets its own `border: 8px solid` (independent of the theme),
tiers the granted box exactly at 16rem (expect cqShort) and 4px over it (expect no cqShort).
Perturb the border term to zero (`0 * rootBorderY`) and confirm ONLY the over-threshold
assertion goes red; confirm the boundary tests stay green because the helper now stubs
`clientHeight = height - border` so `height` keeps meaning the granted box.

Status: CLEARED. With the border term zeroed, `KioskKeyboard-responsive` went 19/20 on the
"granted box over 16rem drops cqShort" assertion; the granted-box-at-16rem assertion and all
boundary tests stayed green, proving the helper change preserved their semantics. Restoring
the term is verified green in the full `check:base` run.

## H8 — (addendum) The webc cq-tier attribute is not actually resilient / the contract refactor is untested

Hypothesis (#192): the webc twin moves its height tier from self-applied host classes
(`kiosk-keyboard--cq-short` / `--cq-tiny`) to a reflected `cq-tier` attribute, whose whole
rationale is that a `class` is consumer-owned and can be wiped by framework `className`
reconciliation while an attribute the component owns is not. A green suite could lie two
ways: (a) the ~12 converted assertions could pass while the attribute is never actually set
(e.g. a vacuous `hasCqTier` helper); (b) the resilience claim could be false, the attribute
wiped as easily as the class was.

Refutation plan: (a) is covered because every converted assertion reads
`el.getAttribute("cq-tier")`, so the whole responsive suite goes red if the controller stops
setting it (equivalent to H3's `_applyClasses` neutering, already observed). (b) add a
dedicated test that reassigns `el.className` after the tier is applied and asserts the tier
survives; under the old class approach that reassignment wiped the class, so the assertion
is only satisfiable by the attribute.

Status: CLEARED for (a) by the suite's dependence on the attribute; the `className`-survival
test passes on the attribute and is inexpressible (would fail) against the prior class
approach, which is the capability #192 adds.

## Known bounded risk, recorded rather than tested

The guard compares border boxes with a 0.1px tolerance because the pass reads the box from
`getComputedStyle` used values while the entry carries the browser's internal double; the
two serialise differently in the last decimals (`240.688px` vs `240.6875` above). The tolerance can in principle drop a real
sub-0.1px observation. This is bounded: the constrained verdict carries its own +1px
tolerance, breakpoint inputs are integer `clientHeight`, and any dropped sub-pixel drift is
corrected by the next real observation. The de-dup test pins both directions: a 40px delta
is never treated as redundant, and the tolerance boundary itself is pinned (a sub-0.1px
delta is absorbed as redundant while a delta past 0.1px is not), so the constant cannot
silently drift.
