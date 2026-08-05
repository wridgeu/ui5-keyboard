# autoCompact: adversarial test-validation hypotheses

Date: 2026-08-04
Issue: #216 (custom layouts; the `autoCompact` width tier and the `ja-kana-compact` layout)

Per CLAUDE.md section 7, a green suite can lie. This change adds a width tier that swaps a
layout for its compact counterpart, driven by a `ResizeObserver` in each twin
(`AutoCompactBehavior` in kiosk, `AutoCompactController` in webc) and applied by the host
from a `requestAnimationFrame`. Its safety rests on suites that must go red on real
breakage rather than merely staying green. Below is each "how could a green run be lying?"
hypothesis and the empirically observed red that cleared it. Every injected fault is
reverted immediately after observation.

Status legend: `CLEARED` = red seen and reverted. `NOT CLEARED` = the hypothesis held; the
gap is real and is recorded rather than papered over.

Baselines the reds below are measured against: kiosk `testsuite.qunit` 46 pages, exit 0,
`KioskKeyboard-autocompact` 8/8; webc vitest 30 files / 584 tests; webc component
`317 passed, 6 failed` (the six are a pre-existing webc defect, see H3); kiosk e2e
`invariants` 6 passed; webc e2e `invariants` 8 passed.

## H1 — The `requestAnimationFrame` is claimed to break a ResizeObserver loop it does not actually break

Hypothesis: both controllers document the rAF as the guard against the #180 failure —
applying the tier inside the observation callback would re-enter observation in the same
frame through the re-render the swap triggers, producing
`ResizeObserver loop completed with undelivered notifications`. If removing the rAF does
not produce that error, then either the rAF is not load-bearing for the stated reason, or
the suites cannot see this class of failure at all.

Refutation plan: in each twin in turn, call `_applyTier()` directly from the
`ResizeObserver` callback instead of `scheduleTierUpdate()`, and record whether the loop
error appears. Whichever way it comes out, separately establish whether the harness can see
the error at all, by injecting a genuinely synchronous content-box mutation of the observed
element into the same callback.

Status: NOT CLEARED. The hypothesis was confirmed: the rAF is not load-bearing for the
reason the comments give. The suites are **not** blind to the failure; the failure does not
occur.

1. kiosk, `_applyTier()` called from the callback: full `testsuite.qunit` 46/46 pages, exit
   0, `KioskKeyboard-autocompact` 8/8, zero occurrences of `ResizeObserver loop` in the
   run. The tier assertions all still passed, so the swap genuinely did run from inside the
   callback — the path was exercised, not skipped. Reverted.
2. webc, `_applyTier()` called from the callback: component suite unchanged at
   `317 passed, 6 failed` (the six pre-existing failures of H3, no new ones), zero
   `ResizeObserver loop`. Re-run with the H3 defect temporarily patched so the baseline was
   `323 passed, 0 failed`: still `323 passed, 0 failed`, zero `ResizeObserver loop`.
   Reverted.
3. Harness visibility, kiosk: added
   `dom.style.height = dom.style.height === "300px" ? "301px" : "300px"` to the same
   callback. `KioskKeyboard-autocompact` went **0/8**, exit 127, with 66 occurrences of
   `ResizeObserver loop completed with undelivered notifications` reported against
   individual tests. Reverted.
4. Harness visibility, webc: the same height oscillation on the observed root took the
   component suite from `317 passed, 6 failed` to `315 passed, 8 failed`, with 8
   occurrences of `Error: ResizeObserver loop completed with undelivered notifications` at
   `test-runner-mocha`'s `onerror`. Reverted.

An earlier version of probe 3 oscillated `paddingTop` and stayed green: `observe()` is
called without options, so the observed box is the **content box**, which padding does not
move. That near-miss is recorded because it is exactly the shape of a probe that would have
"cleared" H1 for the wrong reason.

Cause of the negative result: the #180 controller wrote `classList` **synchronously** inside
the callback, resizing the observed element within the same delivery. The autoCompact swap
instead sets a layout, and both frameworks re-render asynchronously (UI5 `invalidate()`
queues a rendering task; UI5 Web Components queues an invalidation). No size change reaches
the observed box before the callback returns, so observation is never re-entered and the
depth limit is never approached.

Consequence: the rAF still does real work — it coalesces several observations in one frame
into one tier application, and it is what the assertion
`applies the tier from a later frame, never from the observation callback` pins (see H6) —
but the "#180 re-entrancy" justification in the two class doc-blocks is not supported by
observation. Either the comments overstate the guarantee, or the guard is defensive against
a re-render path that does not exist today and could exist tomorrow. Recorded here rather
than resolved: changing those comments is not in this task's scope, and the rAF should not
be removed on the strength of a green run alone, because this is precisely the case where
green proves the absence of a symptom rather than the absence of the hazard.

## H2 — The tier assertions are not live

Hypothesis: the threshold comparison could be inverted, or removed entirely, without a test
noticing — the suites would then be asserting that _something_ happened at a width change
rather than that the _right_ thing happened.

Refutation plan: flip `this._observedInline <= threshold` to `>=` in each twin and confirm
the tier tests go red.

Status: CLEARED. Both reds observed.

1. kiosk: `KioskKeyboard-autocompact` went **3/8**, exit 127. The five reds are the five
   tests that cross the threshold; the three survivors are the negative ones (off by
   default, no counterpart, unregistered counterpart), which is the correct scoping.
   Reverted.
2. webc: vitest went `5 failed | 579 passed`, exit 1 — including
   `tiers at the threshold itself and releases one pixel above it`, so the `<=` boundary
   itself is pinned and not just the direction. Reverted.

## H3 — The requested layout is not really preserved across a swap

Hypothesis: the swap must leave `_requestedLayout` alone, or the first narrow swap erases
the layout it has to swap back to and the keyboard would come back to the compact form (or
to the locale default) instead. A suite that only asserts "narrow shows the compact rows"
would pass with that bug present.

Refutation plan: add `this._requestedLayout = target;` to `_applyCompactTier` in each twin
and confirm the swap-back assertions go red.

Status: CLEARED on both twins, but the webc half needed a scaffold — see the note below.

1. kiosk: `KioskKeyboard-autocompact` went **5/8**, exit 127, and the reds are exactly the
   return trips: `the requested layout returned`, `the wide form returned`,
   `the room returns to the new request`. `KioskKeyboard-layout` stayed 77/77, so the
   injection is caught by the tier suite specifically. Reverted.
2. webc: with the pre-existing defect below patched (so the baseline was `323 passed, 0
failed`), the component suite went to `320 passed, 3 failed`, again exactly the return
   trips. Reverted, and the patch reverted with it.

Note on the webc baseline. Six autoCompact component tests are red on this branch before any
injection, from a defect in `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts`
`onEnterDOM`: `_requestedLayout` is seeded from `this.layout` unconditionally while
`_currentLayout` is seeded only `if (!this.layout)`, so a keyboard whose layout came from
the initial attribute fires a spurious `layout-change` with `autoDetected: true` at any
width. Their first assertion fails, so the H3 injection changes nothing observable about
them; they cannot demonstrate H3 until the defect is fixed. Two candidate fixes were tried
as temporary scaffolding, and the second is what the branch now ships (applied after this
pass, in `_applyCompactTier`); at the time of the H3 injection both were reverted:

- seeding `_currentLayout` unconditionally cleared all six but broke a different test,
  `kiosk-keyboard > i18n > rerenders mounted instances when the resolver changes`, which
  timed out at 2000ms (`322 passed, 1 failed`);
- comparing against `this._resolvedLayoutName()` instead of the raw `_currentLayout` in
  `_applyCompactTier` cleared all six with nothing else disturbed (`323 passed, 0 failed`).
  This is the fix the branch carries; the six tests are its regression guard, seen red before
  it and green after.

## H4 — The 24px e2e measurement passes without the autoCompact fixture ever tiering

Hypothesis: `autoCompact puts a 320px kana keyboard on the rows that clear 24px key
spacing` could pass because the fixture happens to render something acceptable, not because
the tier put the compact rows on screen and not because the pair-distance loop measured
anything. Two separate ways to be vacuous: the rows comparison, and the spacing loop.

Refutation plan: point the fixture at a layout that declares no compact counterpart, and
confirm the rows comparison goes red. Then, separately, narrow the fixture's box so the
compact rows themselves cannot clear the criterion, and confirm the spacing loop goes red
naming the autoCompact fixture.

Status: CLEARED. Four reds observed, two per package.

1. kiosk fixture switched to `{ layout: "ko-hangul", autoCompact: true }`: `1 failed, 5
passed`, on `the compact rows are what rendered`. Reverted.
2. kiosk fixture box narrowed from 320px to 240px: `2 failed, 4 passed`, with
   `kb-ja-kana-auto: keys 'ぬ' and 'ふ' keep 24px between their centres` — and the same for
   `kb-ja-kana-compact`, so the shared `expectKeyCentresApart` helper is live at both call
   sites. Reverted.
3. webc fixture switched to `layout="ko-hangul"`: `1 failed, 7 passed`, on
   `the compact rows are what rendered`. Reverted.
4. webc fixture box narrowed to 240px: `1 failed, 7 passed`, on
   `kb-ja-kana-auto: "ぬ" and "ふ" keep 24px between their centres`. Reverted.

Injection 1 stops at the rows comparison and never reaches the spacing loop, which is why
injection 2 exists; neither alone clears this hypothesis.

## H5 — The runners pass while executing zero tests

Hypothesis: the failure mode CLAUDE.md section 7 calls out explicitly, and which this repo
has hit before (a leftover server on port 8081, #180 H6). A new test file that is written
but never executed reports nothing and costs nothing.

Refutation plan: record test counts for every run and confirm they are non-zero, stable, and
move in the expected direction under injection. Confirm a failing assertion propagates to a
non-zero exit code. Separately, confirm that the QUnit page registration is what makes the
new file run, by removing it.

Status: CLEARED, with one masking caveat recorded.

Counts were non-zero and moved as expected throughout: `KioskKeyboard-autocompact` reported
8 tests on every run and went 8/8 → 3/8 (H2) → 5/8 (H3) → 3/8 (H7) → 7/8 (H8) → 0/8 (H1
probe), with exit 127 on every red. `test/unit/auto-compact-controller.test.ts` reported 13
tests and went 13/13 → `5 failed` (H2) → `4 failed` (H6), with exit 1. The webc component
suite totals 323 tests when the H3 defect is patched, of which
`test/component/auto-compact.test.ts` contributes 9. e2e reports 6 (kiosk) and 8 (webc)
tests, the autoCompact case named in the list output on every run.

Caveat: removing the `KioskKeyboard-autocompact` entry from `testsuite.qunit.ts` made the
run report **45 pages instead of 46 and still exit 0**. Nothing but the page count
distinguishes "the file passed" from "the file was never loaded", so the count is the only
guard on that registration and has to be read, not assumed. Reverted. (The same shape bit
the targeted `--page-filter` runs used to speed up this session: a filter matching nothing
prints `No test page found (or all filtered out)` and exits 0. The project's own
`npm run test:qunit` passes no filter, so this affects ad-hoc runs only.)

## H6 — The webc unit assertion about the frame is vacuous under a fake ResizeObserver

Hypothesis: jsdom ships no `ResizeObserver`, so the unit suite drives a `FakeResizeObserver`
of its own. `applies the tier from a later frame, never from the observation callback` could
be asserting a property of the fake rather than of the controller, in which case it would
stay green with the rAF removed — the one thing it exists to catch. This matters more than
usual given H1: after H1 the unit assertion is the _only_ thing pinning the rAF.

Refutation plan: replace `scheduleTierUpdate()` with a direct `_applyTier()` in the observer
callback and confirm that specific test goes red.

Status: CLEARED.

`4 failed | 9 passed`, exit 1: `applies the tier from a later frame, never from the
observation callback` (on `nothing applied inside the callback`),
`coalesces several observations in one frame into a single tier application`,
`drops a pending tier application when autoCompact goes off before the frame` and
`teardown drops a pending tier application and disconnects`. The frame boundary is asserted
by the controller's behaviour, not by the fake. Reverted.

## H7 — `autoDetected` is not actually distinguished from a request

Hypothesis: `layoutChange` / `layout-change` gained an `autoDetected` parameter whose whole
purpose is to let a consumer tell a width tier from a user request. A suite that only
asserts the `layout` field would pass with the flag hardcoded either way.

Refutation plan: fire the tier's event with `autoDetected: false` and confirm the event
assertions go red.

Status: CLEARED.

`KioskKeyboard-autocompact` went **3/8**, exit 127, red on `one auto-detected change`,
`the way back is auto-detected too`, `the declared counterpart took over`,
`the request applied, then the tier resolved against it`, `a width tier is auto-detected`
and `599px is narrow against a 40rem threshold`. Reverted.

## H8 — The dormancy guarantee is unguarded

Hypothesis: the property is off by default and the behaviour is documented as observing
nothing while it is off. `Off by default, and nothing is observed while it is off` counts
distinct observers of the root, which is an indirect measurement and could be satisfied for
an accidental reason (for instance if the responsive-sizing controller's observer were the
one being counted twice).

Refutation plan: drop the `!this._host.getAutoCompact()` half of the `syncObserver` early
return so the observer attaches regardless, and confirm exactly that test goes red.

Status: CLEARED.

`KioskKeyboard-autocompact` went **7/8**, exit 127, red on
`only the responsive-sizing observer watches the root` — the assertion that counts one
observer before the property is set. The `watchers() === 2` assertion after
`setAutoCompact(true)` still passed, so the test measures the transition and not merely the
presence of an observer. Reverted.

## Restoration

Every injection above was reverted and the six touched files were verified byte-identical to
their pre-injection contents (`packages/kiosk-keyboard/src/internal/auto-compact-behavior.ts`,
`packages/kiosk-keyboard/src/KioskKeyboard.ts`,
`packages/kiosk-keyboard/test/e2e/visual/init.js`,
`packages/kiosk-keyboard/test/qunit/testsuite.qunit.ts`,
`packages/kiosk-keyboard-webc/src/core/auto-compact-controller.ts`,
`packages/kiosk-keyboard-webc/src/KioskKeyboard.ts`,
`packages/kiosk-keyboard-webc/test/pages/visual.html`). The confirming runs afterwards
reproduce the baselines exactly: kiosk `testsuite.qunit` 46 pages / exit 0 / autocompact 8/8
/ zero `ResizeObserver loop`; webc vitest 30 files / 584 tests; webc component
`317 passed, 6 failed` (the six of H3); kiosk e2e `invariants` 6 passed; webc e2e
`invariants` 8 passed.

## Follow-up pass: the review defects and their regression guards

The three-reviewer pass over the finished branch confirmed four correctness defects that none
of the hypotheses above targeted, because every hypothesis tested the tier's own arithmetic
rather than its interaction with the rest of the layout state. All four are fixed in both
twins, and each fix ships with a regression test in
`packages/kiosk-keyboard/test/qunit/KioskKeyboard-autocompact.qunit.ts` that was seen red
against the reintroduced defect and green after, in the same session:

| Defect                                                                                                                                                                        | Regression test                                                         | Red seen                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------- |
| The tier promoted its own target to `_baseLayout`, so `{layout:base}` / `resetLayout()` turned the arrangement into the request and stranded the keyboard on the compact rows | `A swap does not become the base layout a {layout:base} key returns to` | yes, base-promotion reintroduced |
| Turning `autoCompact` off while swapped tore the observer down and left the compact layout applied, with nothing left to undo it                                              | `Switching autoCompact off gives the requested layout back`             | yes, restore branch removed      |
| A `keyboardType` constraint pins the rendered surface, but the tier still fired `layoutChange` naming a layout that was not on screen                                         | `A keyboardType constraint suppresses the tier`                         | yes, guard removed               |
| A zero inline size (a `display: none` ancestor, a collapsed panel) read as "narrow", so a hidden keyboard swapped and swapped back on reveal                                  | `A keyboard that loses its box does not tier`                           | yes, zero guard removed          |

The first two injections were run together and turned exactly their own two tests red
(`10/12`); the second two likewise. That the suite was 12/12 before each injection and
12/12 after each revert is what makes the four assertions load-bearing rather than decorative.

The doc blocks on both `AutoCompactBehavior` and `AutoCompactController` were also corrected:
they claimed the `requestAnimationFrame` guards against the #180 loop failure, which H1 above
disproves. They now state what the frame actually does (coalescing) and record that the
absence of the loop was measured rather than assumed.

## Second follow-up: announcement and focus

Three findings were left open after the pass above: the kiosk behaviour had no unit suite of its
own, the 24px premise was asserted in prose but measured nowhere, and a width swap was silent
while key ids are positional, so the element under focus could change identity beneath the user.

The scoping question decided the shape of the third. Focus was **already** mis-handled on the
ordinary `{layout:*}` / `setLayout` path in both twins: the restore is keyed on the grid
_position_, so qwerty `q` at (1,0) already became numeric `-` at (1,0). The swap was therefore
not a new defect class, and the fix went on the shared layout-application path (`_applyLayout`)
rather than on `autoCompact`. Nothing about the focus policy is conditioned on `autoDetected`;
the tab stop is re-seated by key **value**, falling back to the first key.

Reds observed for that pass (each injection reverted): disabling the re-seat turned 4 webc
assertions red including `expected 'ー' to equal '{backspace}'` — the identity swap itself — and
`expected null not to be null` for focus dumped to the document, plus 4 kiosk assertions;
replacing the announce call with a bare text lookup, and moving the announce to fire on every
layout change, each turned their own guard red. Writing the kiosk announcement at the tier
rather than from `onAfterRendering` turned both live-region assertions empty, which is the
empirical proof that the region's text is renderer-owned and an imperative write is clobbered by
the render the swap triggers.

One guard's red is a hang rather than an assertion diff: `leaves focus outside the keyboard
alone` never completes when the "focus was on a key" gate is loosened to accept a remembered tab
stop. Recorded as observed-red, but noted as a weaker signal than a failed assertion.

### Announcement scope, corrected after review

The review found the announcement fired on **first paint** for a keyboard that mounted already
narrow, and that the comment claiming requested switches are never announced was false. Both are
fixed by announcing only when a verdict _replaces a known previous one_ — a width the user
actually crossed. The first resolution of a keyboard that was always this narrow rearranged
nothing they had seen, and a request re-seats focus itself. A request now also drops a tier
announcement still waiting on a render, which would otherwise name the layout it just replaced.

| Defect                                                                           | Regression test                                                                | Red seen                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------- |
| A keyboard mounting already narrow announced a change the user never experienced | `A keyboard that was always narrow announces nothing on first paint`           | yes, `crossed` gate removed |
| A pending announcement survived a later request and named the superseded layout  | `A request drops a tier announcement that has not reached the live region yet` | yes, clear removed          |

The second test was rewritten after its first version passed under injection: the live region is
wiped by the re-render a request triggers, so a resize-driven version proved nothing. It now
drives `_applyCompactTier` directly to put the request in the same frame, which is the only way
to reach the defect.

## Third follow-up: the tier's inputs changing without a resize

Every hypothesis and every follow-up above drove the tier through its own input, the width.
The review pass over the finished branch asked the inverse question - what else does the tier
resolve through, and who re-opens the question when one of those moves while the box stands
still - and found two answers with no path back to `reapply()`:

- A `keyboardType` constraint suppresses the tier (the guard added in the first follow-up), so
  a keyboard that was narrow under `Numpad` recorded its verdict and swapped nothing. Releasing
  the constraint - `resetKeyboardType()`, or `autoType` detection following focus from a numeric
  field to a text one - surfaced the wide layout in a box too narrow for it, which is the exact
  outcome `autoCompact` exists to prevent, and no resize follows to correct it.
- The counterpart is resolved through the fold, so a `rows` binding delivering after first paint,
  or a `<kiosk-keyboard-custom-layout>` appended later, changed the tier's answer with no
  observation to carry it.

Both are the same defect: `reapply()` was wired only to a layout request. It is now wired to
every input the tier reads - the request, the constraint, and the fold - and made free to call
before the first observation lands, so the wiring costs no frame while `autoCompact` is off.

| Defect                                                                                              | Regression test                                                                                                                                                                    | Red seen                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| A layout surfacing from under a lifted `keyboardType` constraint kept the wide rows in a narrow box | kiosk `Lifting a keyboardType constraint re-tiers the layout that surfaces`, webc `does not tier while a keyboardType constraint pins the surface, and re-tiers when it is lifted` | yes, written red before the fix |
| A counterpart registered after first paint was never tiered to                                      | kiosk `A counterpart whose rows arrive from a model re-tiers on arrival`, webc `re-tiers when the counterpart is slotted after first paint`                                        | yes, written red before the fix |

Both webc tests were seen red against the unfixed branch before either `reapply()` call existed
(`16 passed, 1 failed`, then the second added). The kiosk pair was confirmed live by reintroducing
the defect afterwards: with all three `reapply()` calls stubbed out the autocompact page ran
`20/24`, and `24/24` on revert, so the four assertions are load-bearing.
