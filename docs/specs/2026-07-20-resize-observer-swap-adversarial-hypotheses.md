# ResizeObserver swap: adversarial test-validation hypotheses

Date: 2026-07-20
Issue: #180 (split out of #179, where the naive swap was implemented, regressed and reverted)

Per CLAUDE.md section 7, a green suite can lie. This change replaces the resize mechanism
in the kiosk `ResponsiveSizingController` and fixes two defects in its webc twin. Its
safety rests on suites that must go red on real breakage rather than merely staying green.
Below is each "how could a green run be lying?" hypothesis, written before the
implementation, and the empirically observed red that cleared it. Every red is reverted
immediately after observation.

Status legend: `CLEARED` = red seen and reverted. `NOT CLEARED` = the hypothesis held; the
gap is real and is recorded rather than papered over.

## H1 — The perf guard passes for an accidental reason

Hypothesis: `KioskKeyboard-renderer-blackbox.qunit.ts:114` ("No forced layout reads
(getComputedStyle) during shift toggle") is green on baseline only because the priming
rAF happens to be registered before the test's drain rAF, not because the shift path is
genuinely free of forced layout. If so, it would stay green after the swap for an equally
accidental reason and prove nothing.

Refutation plan: inject a deliberate `getComputedStyle` into the shift render path and
confirm the test goes red. Then confirm it also goes red for the specific regression this
issue is about, by applying the swap _without_ the guard and observing `26/27` with the
`_applyClasses` stack recorded in #180.

Status: CLEARED. Both reds observed.

1. Added `getComputedStyle(document.body).width` as the first statement of
   `KioskKeyboardRenderer.render`: `KioskKeyboard-renderer-blackbox` went `26/27` and the
   runner exited non-zero. Reverted.
2. Applied the naive swap (`ResizeObserver` + the existing rAF, i.e. exactly the #179
   shape) with no guard: `renderer-blackbox` went `26/27`, reproducing #180's regression,
   and `KioskKeyboard-responsive` went `15/16`. Reverted.

The guard is therefore load-bearing and the assertion is live, not vacuous.

## H2 — Removing the rAF silently relocates the forced layout instead of removing it

Hypothesis: reading in the ResizeObserver callback rather than a rAF is claimed to be
free because RO fires after layout and before paint. A green perf test would be
consistent with the measurement simply having moved outside the measured window rather
than having become cheap. Green here does not prove "no forced reflow", only "no
`getComputedStyle` in this window".

Refutation plan: this hypothesis cannot be cleared by the existing assertion, which is a
call counter, not a reflow counter. Clear it by direct observation instead: confirm via
the frame-timing argument in the RO spec and, empirically, that no measurement is
scheduled for a later frame (no pending rAF handle remains on the controller after a
resize settles).

Status: CLEARED, and the underlying design premise was REFUTED by it.

Applying classes synchronously inside the observation callback did turn
`renderer-blackbox` green (`27/27`) with no guard at all, which looked like the ideal
outcome. The responsive suite simultaneously went `7/16`, and eight of those failures were
`ResizeObserver loop completed with undelivered notifications` — not assertion failures.

Cause: this controller writes classes that change the size of the very element it
observes. A synchronous callback that clears the classes, measures, then re-applies them
re-enters observation within the same frame and trips the depth limit. Deferring the write
to `requestAnimationFrame` is what breaks that cycle, so the rAF is load-bearing and the
"rAF is an anti-pattern for ResizeObserver" reasoning does not hold for a controller of
this shape.

The synchronous design was therefore abandoned in favour of keeping the rAF and adding the
applied-height filter on the observation instead. Recorded here because a green perf test
alone would have endorsed a change that emits console errors in every browser.

## H3 — The rewritten responsive suite is vacuous

Hypothesis: `KioskKeyboard-responsive.qunit.ts` currently spies `ResizeHandler.register`
/`deregister` by name. Rewritten to spy `ResizeObserver.prototype.observe`/`disconnect`,
it could assert wiring that no longer drives anything, and pass regardless of whether the
controller actually reacts to observations.

Refutation plan: break the observe/disconnect wiring (skip the `observe` call) and confirm
exactly those tests go red. Separately, neuter `_applyClasses` and confirm the class-state
assertions go red, proving the suite tests behaviour and not just registration.

Status: CLEARED. Both reds observed.

1. Skipped the `observe()` call: only `Cleanup on exit() disconnects the ResizeObserver`
   went red (`the keyboard root was observed during initial render`), so the wiring
   assertion is live and correctly scoped. Reverted.
2. Made `_applyClasses` return immediately: 13 of 17 tests and 16 assertions went red,
   across the boundary, custom-threshold and constrained-container cases. Reverted.

The suite therefore asserts behaviour, not just registration.

## H4 — The webc shadow-root observation bug is invisible to the existing suite

Hypothesis: `connectedCallback` runs `renderImmediately` (ending in `onAfterRendering`)
_before_ `onEnterDOM` calls `setup()`, so the first `syncObserverTargets(root)` hits the
null-observer early return and the shadow root is never observed. Every existing webc
responsive test constrains the _host_ box, which the host observation alone catches, so
the entire suite is expected to stay green with the bug present.

Refutation plan: this is a coverage gap, not a passing test to break. Write a regression
test that changes intrinsic _content_ height without touching the host box, confirm it
fails against the current code, then fix. A test that passes before the fix does not
cover this bug.

Status: CLEARED, and the bug was confirmed real.

The ordering was verified in the framework source: `UI5Element.connectedCallback` calls
`renderImmediately(this)` at line 222 and `this.onEnterDOM()` at line 225.

Added `reacts to a style-only intrinsic height change inside a fixed host`, which pins the
host at `15rem` and raises `--kiosk-keyboard-key-height` from `1.25rem` to `3rem` without
calling `refreshResponsiveState()`. Against the unfixed controller it failed with
`cq-short applied after content grew: expected false to be true`, while asserting the host
box was unchanged. It passes after the fix, and the full component suite went from 241 to
245 passing with 0 failures.

This is load-bearing because the root is auto-height and overflows a constrained host
(`:host` is `max-height: 100%; overflow: hidden`), so the root's border box tracks content
height while the host box does not move. The host observation alone cannot see it.

## H5 — The class-free measurement invariant is not protected

Hypothesis: `_applyClasses` must read both `naturalHeight` and the host/rendered height
_after_ clearing `cqShort`/`cqTiny`, or the decision becomes dependent on prior class
state. Commit `ac3260d0` fixed exactly this oscillation. Making class writes idempotent
(to allow dropping the rAF) risks reintroducing it, and no current test is known to assert
the invariant directly.

Refutation plan: perturb the implementation to measure _before_ clearing the classes and
confirm a test goes red. If nothing goes red, the invariant is unguarded and needs a test
added before the refactor can be trusted.

Status: NOT CLEARED. The hypothesis was confirmed: the invariant is unguarded.

Perturbed `_applyClasses` to read `scrollHeight` before the `classList.remove` and use that
value as `naturalHeight`. The suite stayed `16/16`. The stubbing helper `setMeasuredHeight`
pins `scrollHeight` to a constant, so no stubbed test can express a natural height that
depends on the applied classes.

Added `Repeated recomputes converge on a stable class set`, which uses real layout and no
measurement stubs, to attack it directly. It also stayed green with the perturbation
applied: at a 15rem constraint with 4rem keys the compaction does not shrink the content
far enough to flip the constrained verdict, so no oscillation appears. Producing one
requires tuning `--ui5KioskKeyboard-keyHeight` into a narrow band where applying `cqShort`
drops `scrollHeight` below the rendered height, which is CSS- and browser-dependent and
would ship as a brittle test.

Outcome: the invariant is documented in a comment at the `classList.remove` call and is
otherwise unguarded. The convergence test is retained because it is not vacuous in general
(it goes red when class application is disabled, see H3) and it pins stability at a
realistic constraint, but it must not be read as covering this invariant. Closing the gap
properly is follow-up work, tracked as #189.

Update: CLEARED. The gap is now closed by `Natural height is measured with the tier classes
cleared, so the tier cannot oscillate`. It uses the missing tool: a class-dependent
`scrollHeight` getter that returns a shorter height while a tier class is present (which
neither the constant `setMeasuredHeight` stub nor the real-layout convergence test could
express), plus a seeded stale wrong tier. Reading before the clear then measures the shrunk
height, bails as unconstrained, and leaves the stale tier; reading after the clear corrects
it. Verified red under the read-before-clear perturbation (responsive `16/17`) and green on
the correct order.

## H6 — The suites run zero tests / the runner masks failures

Hypothesis: the QUnit runner reports success while executing zero tests, or a filtered
run silently skips the files under change (the failure mode CLAUDE.md section 7 calls out
explicitly, and which this repo has hit before via a leftover server on port 8081).

Refutation plan: record the assertion/test counts for every run and confirm they are
non-zero and stable across runs; confirm the counts change in the expected direction when
tests are added. Confirm a deliberately failing assertion propagates to a non-zero exit
code.

Status: CLEARED.

Counts were non-zero and moved in the expected direction throughout: kiosk
`KioskKeyboard-responsive` went 16 tests / 52 assertions to 17 / 56 when the convergence
test was added, and `KioskKeyboard-renderer-blackbox` held at 27 tests / 117 assertions.
The webc component suite went 241 to 245 passing when the intrinsic-height test was added.
Every injected failure in H1, H3 and H4 surfaced as a reported failure, and the H1 run
confirmed a non-zero exit code propagates out of `ui5-test-runner`.

One real masking effect was observed and worked around rather than trusted: a first webc
run reported `90 passed, 0 failed` together with `Error while running tests` and exit 1,
because browser start-up timed out partway through and the summary described only the
files that had run. The genuine failure was visible only on a re-run with the browser
contention removed. A count-only reading of that first run would have been wrong in both
directions.

## H7 — The width dimension of the applied-box filter is unguarded

Hypothesis: an adversarial review found that the filter first compared only
`borderBoxSize.blockSize`, so an observation with the same height but a different width was
dropped. That is wrong: the natural height depends on width (container queries wrap the
F-key and nav rows), so a width-only change can flip the constrained verdict and must
recompute. The `ResizeObserver` is the only width-change trigger left after the swap. The
question is whether the fix (compare `inlineSize` too) is covered.

Refutation plan: add `Observer recomputes on a width-only change but skips a repeat of the
applied box`, then revert the `inlineSize` half of the comparison and confirm exactly that
test goes red.

Status: CLEARED.

With `inlineSize` dropped, `KioskKeyboard-responsive` went `17/18` on the
"a width-only change is not treated as redundant" assertion, exit non-zero. Restored to
`18/18`. The test drives the filter through the internals-cast pattern (CLAUDE.md §3) since
a real cross-breakpoint width resize under the observer is timing-dependent.
