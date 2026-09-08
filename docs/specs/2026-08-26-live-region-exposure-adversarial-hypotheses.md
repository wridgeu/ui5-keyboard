# The live region and the variant count: adversarial validation (#247, #254)

**Date:** 2026-08-26
**Status:** Shipped. Historical record; later code changes are not folded back in.

Written before the new suites were trusted, per CLAUDE.md §7. Each hypothesis names
a way the green run could have been lying; each is cleared only against a run that
was **seen** to go red, then reverted.

Both fixes are invisible by construction. #247 changes only whether an announcement
reaches the accessibility tree — every pre-existing live-region assertion read
`textContent`, which survives both `display: none` and `visibility: hidden`, so the
whole suite was green against a region that never announced anything. #254 changes
only a string no user sees. Neither has a visible symptom a normal assertion catches.

## What shipped, and why the first fix was replaced

The kiosk control rendered its own `role="status"` span inside its root and wrote
`sapUiInvisibleText` on it — `display: none !important` in the pinned OpenUI5
(`sap/ui/core/themes/base/shared.less:313`), so nothing was ever announced.

The first fix gave the package its own screen-reader-only rule, with an extra
`visibility: visible` because `.ui5KioskKeyboard--closed` sets `visibility: hidden`
on the root and a docked keyboard renders closed. That worked, and it is not what
shipped: UI5 already answers this with `sap/ui/core/InvisibleMessage` (since 1.78),
a singleton whose `role="status" aria-live="polite"` span lives in the static area —
a `<body>`-level sibling the control's own hidden state cannot reach. Announcing
through it deletes the renderer hook, the class, the stylesheet rule, the
`liveRegion` DOM-contract key and the `_liveRegionText` re-emit, and makes the whole
bug class structurally impossible rather than merely fixed. It also clears its node
before each write, which is the one thing a same-value write cannot do on its own.

The webc twin keeps its own region: it renders outside the `aria-hidden` root and
was never affected, and it has no UI5 core to borrow the announcer from.

## What is under test

- `KioskKeyboard._setLiveRegionText`, now one call to `InvisibleMessage.announce`.
- The webc `_writeLiveRegion`, which writes the shadow-DOM node directly.
- The `ARIA_VARIANTS_OPENED` value in all eight bundles, and the two code fallbacks
  that shadow them.
- `tools/check-i18n-bundles.mjs` invariant 4, the new twin value-parity guard.

## H1 — the exposure assertions could be unfalsifiable

The region is framework-owned now. If nothing this repo controls can hide it, the
`display` / `visibility` assertions are decoration and the test only looks thorough.

**Falsified.** With `#sap-ui-static { display: none; }` added to the package
stylesheet — a rule this repo could plausibly ship:

```
KioskKeyboard accessibility ▶ the announced text lands in a node assistive tech can reach
  its container is not display:none either
```

The package stylesheet can still take the announcement out of the accessibility
tree, from the other side, and the test catches it. (The variant-popup suite goes
red too: the accent popover is a static-area Popover.)

The quoted `its container is not display:none either` assertion was dropped in a
later change; the test it belonged to no longer carries it.

## H2 — the repeat-announcement test could pass without the fix

The webc live-region text is a reactive property. The claim is that re-announcing the
text already standing there is dropped by the change guard. If the test passes
against the unfixed code, it proves nothing.

**Falsified in two rounds, and the first round is the point.** The assertion started
as "the region was emptied and refilled", read from `MutationRecord`s. Removing the
`node.textContent = ""` line left the suite **green**: assigning `textContent` at all
replaces the text node, so removals and additions appear either way. That assertion
could not tell the fix from its absence.

Rewritten to assert what the defect actually is — the repeat reaching the DOM at all —
and injected with the real pre-fix body (`this._liveRegionText = text;` alone):

```
❌ kiosk-keyboard > accessibility > re-announces a text the region is already holding
     AssertionError: the repeat reached the DOM instead of being skipped: expected [] not to be empty
```

Zero mutations, one failing test. Whether the _emptying_ specifically is what makes a
screen reader speak again is not observable from a DOM test; it follows
`InvisibleMessage`, which does the same thing for the same stated reason.

The quoted `re-announces a text the region is already holding` test was dropped in a
later change.

## H3 — the kiosk twin of that test was vacuous, and was deleted

The review that prompted this called the repeat swallow a defect in **both** twins.
For kiosk that was wrong: the old code assigned `textContent` directly, which always
wrote to the DOM, so there was never a skipped write to catch. A kiosk twin of the H2
test could only assert something that cannot fail. It is not in the suite. The kiosk
side of the concern — that a same-value write is not a text _change_ for assistive
tech — is real, unobservable from a DOM test, and now handled by the framework
announcer rather than asserted.

## H4 — the #254 tests could be asserting the in-code fallback, not the shipped bundle

Both call sites pass a literal fallback to `getText`. A test that happens to match
that literal would stay green even if no bundle were ever updated.

**Falsified.** With the four kiosk bundle values reverted and the new code fallbacks
left in place:

```
3 assertions of 4 passed, 1 failed
  the count trails the noun, so no locale needs a plural form
```

Only the count-1 case goes red; the two pre-existing count-2 announcement tests stay
green. So the assertion reads the shipped bundle, and the fallback literal is
shadowed exactly as expected.

## H5 — the fix could reach only one twin

Nothing in CI compared message _values_ across the two packages, and the drift was
not hypothetical: an early run with the webc bundle edited but
`src/generated/i18n/i18n-defaults.ts` not yet regenerated left webc resolving the old
string while kiosk was already green.

```
kiosk-keyboard - accent-variant popup > announces a single variant ...
  AssertionError: expected '1 variants for a' to equal 'Variants for a: 1'
```

`tools/check-i18n-bundles.mjs` now compares the intersection of the twins' keys,
locale by locale (invariant 4). **Verified by injection**, with one German value
edited in one twin:

```
Message-bundle check failed (1):
  - "ARIA_VARIANTS_OPENED" differs between the twins in messagebundle_de.properties: ...
    A wording change has to land in both bundles.
```

17 shared keys, four locales. Each twin's own regression test is no longer the only
thing holding the parity.

## H6 — the migrated assertions could be reading a stale or foreign region

The framework region is page-global and empties itself three seconds after a write.
Both properties can make an assertion pass or fail for reasons that have nothing to
do with the control.

**Observed rather than injected**, twice, while migrating the suites:

- Reading the node directly left `The live region announces which way each width crossing
moved the layout` red with `actual=""` — a three-second timer armed by an _earlier_ test
  in the same module wiping an identical text this one had just written.
- Recording writes but reading only the recording left `Open and close announcements
are spoken in turn` red: `MutationObserver` runs a microtask later, so a read taken
  in the same task as the announcement saw the previous entry.

`test/qunit/test-helpers.ts` therefore reads the node first (synchronous, authoritative
while populated) and falls back to the recording (survives the three-second wipe), and
arms the recorder from `placeAndWait` / `waitForAnnouncement` rather than on first read.
`resetAnnouncements()` clears both, so a silence assertion means "nothing was announced
since the reset" rather than "the shared node happens to be empty" - provided the reset
runs before the step whose silence is asserted, which is what H7 is about.

## H7 — a silence assertion could be clearing the very thing it then reads back

`resetAnnouncements()` empties the shared node and the recording, and `announcedText()`
reads exactly those two. A reset placed _between_ the step and the assertion therefore
makes the assertion true by construction, whatever the control did.

**Injected**: `onAfterRendering` announces on every paint
(`this._announceLiveRegion("INJECTED first-paint chatter")`). Every assertion that a
first paint is silent must go red.

Against the suites as first written, three stayed **green**:

- `Live region stays silent for a requested layout switch` (a11y)
- `The live region announces which way each width crossing moved the layout` (autoCompact)
- `A keyboard that was always narrow announces nothing on first paint` (autoCompact)

Each cleared the region after mounting the keyboard and before reading it back. The
first assertion of `Live region announces Shift state` was the same shape; that test
went red anyway, on its later assertions.

Cleared by moving each reset ahead of the keyboard it is about, which needs the region
to exist before the first control does — `armRecorder` now calls
`InvisibleMessage.getInstance()` itself rather than waiting for a `KioskKeyboard.init`
to bring the node into the page. With the same injection in place the three now go red
(a11y 22/29, autoCompact 20/24, against 23/29 and 22/24 before); reverted, both modules
are green again.

The same pass added a reset to `Open and close announcements are spoken in turn`: it
expects `"Virtual keyboard opened"`, which is the text the preceding test leaves
standing in the shared node, so a broken `show()` would have read as a pass.

## Where `InvisibleMessage.getInstance()` is reached from

ARIA wants a live region in the page and empty before anything is written to it, so the
singleton is taken eagerly rather than on the first announcement. `getInstance()` inserts its
spans synchronously (`ManagedObject.js:530` calls `init` inside the constructor;
`InvisibleMessage.js:151` inserts), and `announce` writes immediately after, so without an
eager call the region would be created and filled in one task - the case every practitioner
source says is unreliable. It is not normative: WAI-ARIA 1.2 and Core-AAM say nothing about it.
Treat it as "may be dropped", not "is dropped".

`sap.m.IconTabFilter` primes the same singleton for the same stated reason, with a bare call
and no announce (`IconTabFilter.js:762-767`): _"force initializing the invisible message, as the
live region should be rendered, when we announce the text"_. `sap.f.GridContainer` does the same
(`:690`, not the pinned version). That is the pattern this control follows.

**From which hook.** A later survey of the pinned 1.136.18 `sap.m` settled this, and corrected
what an earlier revision of this document claimed. No `sap.m` control primes from `init`.
`InputBase:421`, `Select:1493`, `SliderTooltip:128` and `MessageView:393` prime from
`onBeforeRendering`, caching to `this._oInvisibleMessage`; `IconTabFilter:762` primes from
`_onAfterParentRendering`; `ListBase:1664`, `SelectDialog:1226` and `TableSelectDialog` do not
prime at all and call `getInstance().announce()` at the point of use. `IconTabFilter` was cited
here and in CLAUDE.md as the precedent for preferring `init` over a rendering hook, which it is
not - it primes from a rendering hook. This control now primes from `onBeforeRendering`.

**Why the gate.** `InvisibleMessage.prototype.init` calls `StaticArea.getDomRef()` unguarded -
its own `if (!oStatic)` fallback is dead against the 1.136 `StaticArea`, which never returns a
falsy value, only throws - and `_createStaticAreaRef` opens with
`if (!bDomReady) throw new Error("DOM is not ready yet. Static UIArea cannot be created.")`.

**How wide the window really is.** Narrower than first recorded here. `StaticArea.js` is a
static dependency of `Core.js` (`Core.js:21`), so it is evaluated at the very start of core
boot, and `_ready()` resolves _synchronously_ when `document.readyState !== "loading"`
(`_ready.js:23`, `SyncPromise.js:344`). On a normally-parsing page `bDomReady` latches `true`
right there and an unguarded call can never throw for the life of that page. The window stays
open only while the parser is held after the bootstrap tag. Nothing this repo ships or documents
reaches it: every page boots through `data-sap-ui-on-init` / ComponentSupport, which runs inside
`Core._executeInitialization`, and no `new KioskKeyboard()` exists outside tests and README
snippets. The measurement below establishes reachability under a page built to expose it, not
that a consumer would write one.

**Why no gate is needed.** The reasoning above argued for a `Core.ready` gate around a call in
`init`, and it holds for that placement: `Control.prototype.placeAt` wraps its entire body in
`Core.ready` (`Control.js:660`), so UI5 guarantees `new Control(); ctrl.placeAt(...)` works before
the core is ready, and a public control whose `init` throws there breaks a contract the framework
maintains on its behalf.

The same fact removes the problem when the call moves. `placeAt` deferring to `Core.ready` means
rendering cannot begin before the core is ready, so `onBeforeRendering` is already past the sync
point that `Core.ready` waits for - the hook _is_ the gate. Priming there needs no `Core.ready`
call, no `Core` import, and leaves no throwing window to reason about. Nothing announces earlier:
`AnnouncementQueue` only flushes while `getDomRef()` is non-null, and the earliest write is the
pending tier announcement in `onAfterRendering`. It also stops an unrendered `new KioskKeyboard()`
from materialising the static area at all.

**Not test-observable.** `oInstance` is module-global in `InvisibleMessage` and never reset, so
once anything calls `getInstance()` the spans stay for the life of the page. `armRecorder` in
`test-helpers.ts` calls it directly, which is what lets a test arm before it builds a keyboard.
A test asserting "the region exists after render" would therefore pass whether or not the control
primes at all - it would be exactly the tautology class swept elsewhere in this repo. The priming
is an ARIA robustness measure, verified by reading the framework source rather than by an
assertion.

**Measured.** Framework call in isolation, then the real control: the whole library served by
`ui5 serve` and driven in a headed Chrome, parser held by a slow blocking script, keyboard built
from a `sap.ui.require` callback.

| `init` does                                        | `readyState` at `new` | outcome                                                                             |
| -------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| `InvisibleMessage.getInstance()`                   | `loading`             | **THROW** - the keyboard is never constructed, and no region exists even after load |
| `Core.ready(() => InvisibleMessage.getInstance())` | `loading`             | constructs; region present in `#sap-ui-static` once the page reaches `complete`     |

**Why a rendering hook, and what `apiVersion: 4` does and does not say.** The `apiVersion: 4` contract does say the `onBeforeRendering` and
`onAfterRendering` hooks "must not be used to manipulate or access any elements outside of the
control's own DOM structure" (`RenderManager.js:227`), and `KioskKeyboardRenderer` declares
`apiVersion: 4` - but that is **not** why a hook was rejected, and it must not be cited as a bar:

- The prerequisite is unenforced. `RenderManager.canSkipRendering` is purely structural
  (`apiVersion == 4 && !hasRenderingDelegate()`, `:2560-2576`); nothing inspects what the hooks
  do. The only consequence is that a hook silently does not run on a parent-only re-render, and
  the first render is never skipped (`:1206-1216`).
- **This control's own `onAfterRendering` already writes to the static area**, through
  `takePendingAnnouncement()` -> `_announceLiveRegion` -> `InvisibleMessage.announce`, and also
  arms a document-level listener and delegates onto other controls. Citing the clause against
  `onBeforeRendering` while the sibling hook crosses it is incoherent.
- No shipped renderer declares `apiVersion: 4` anywhere - not in the pinned libraries, not in
  `sap.f` / `sap.ui.table` / `sap.ui.mdc`, not at 1.150. The clause has no corroborating example
  either way.

So the clause is a real one to weigh and not a bar, which is what the three points above
establish. Set against it: `onBeforeRendering` clears the throwing window outright rather than
gating it, it is where the six `sap.m` controls that keep an instance prime, and the ordering
cost is nil - the first render is never skipped, and nothing in this control can announce before
it. That is the trade this control now takes. The earlier revision resolved it the other way and
justified `init` on ordering, citing `IconTabFilter`; the survey below, in this same document,
already recorded that no `sap.m` control primes from `init` and that `IconTabFilter` primes from
a rendering hook. The conclusion did not match the evidence sitting under it.

**Framework survey** (pinned 1.136.18; `sap.ui.layout` and `sap.ui.unified` have no mentions).
15 `getInstance()` call sites, all in `sap.m`: **six** create-early-and-keep, all in
`onBeforeRendering` (`InputBase.js:421`, `MessageView.js:393`, `Select.js:1493`,
`SinglePlanningCalendarGrid.js:480`, `SinglePlanningCalendarMonthGrid.js:431`,
`SliderTooltip.js:128`); **eight** create-and-announce inline at event time; **one** prime-only
(`IconTabFilter.js:767`). None from `init`. The single construction-time site is
`AccessibleMessageStrip.prototype.applySettings` (`p13n/MessageStrip.js:59`), unguarded and
announcing in the same statement; it is `@ui5-restricted` and only built inside an already-open
dialog, so neither the throw nor the same-task write bites it. `Core.ready` and
`InvisibleMessage` meet nowhere in the framework except inside `InvisibleMessage.init` itself.

**A hazard the survey turned up.** `sap.m.InputBase.exit` and `sap.m.SliderTooltip.exit` call
`destroy()` on the shared singleton (`InputBase.js:513-515`, `SliderTooltip.js:120-122`), and
`InvisibleMessage.js`'s module-level `oInstance` is not cleared by `destroy()`, so later
`getInstance()` calls hand back the destroyed object. This is why `_setLiveRegionText` calls
`getInstance()` fresh on every announcement instead of caching it the way those controls do.
Regression-tested in `KioskKeyboard-a11y.qunit.ts` ("announcements survive an Input being
destroyed").

**Not covered by the suite.** The QUnit page's document is always ready, so the failing state
cannot be produced in-suite, and the test helper arms the region itself - deleting the eager
call leaves the suite green. That stays true of the `onBeforeRendering` placement: `oInstance` is
module-global and never reset, so any earlier `getInstance()` primes the page for every test that
follows. An assertion that the region exists after render would pass with the priming deleted -
the tautology class swept elsewhere in this repo - so none was written. The placement rests on
the framework source read above, not on a test. Manual repro for the `init` throw the gate used to
cover: serve `sap-ui-core.js`, put the bootstrap and a `sap.ui.require([...])` in `<head>`, and
hold the parser with a blocking `<script src>` that responds slowly; note that the throw is no
longer reachable through this control, because it no longer touches the static area from `init`.

## H8 — a negative assertion is not a test of the thing it names

Five lenses were run over this branch, two of them paid to refute it. Four findings survived
against the code; the fixes are in this branch.

- `The announcement names no layout` (autoCompact) asserted only
  `announcedText().includes("ja-kana") === false`, and `"".includes(...)` is false, so it passed
  against a control that announced nothing at all. **Injected**: `if (crossed)` in
  `layout-state.ts:177` made dead. The test stayed green before the fix and goes red after it
  (autoCompact 20/24), alongside the three positive tests that always caught it.
- `Live region reports Caps Lock ending even when Shift takes over` (a11y) took no reset, and its
  closing expectation `"Caps Lock off"` is verbatim what the preceding test leaves standing in the
  page-global node and last in the recorder. It was one assertion away from vacuous; it now starts
  from silence.
- `KioskKeyboard-variants.qunit.ts` never imported `resetAnnouncements` at all. Its three
  announcement assertions survived only because no earlier test happens to produce their exact
  strings - a property of the built-in variant table, not of the tests. They now reset first.
- webc `does not announce a dismissal when an option commits` asserted only "not the dismissal
  text", which an empty region also satisfies. It now asserts the open announcement still stands.

The exposure test gained an `aria-hidden` ancestor check: `display`, `visibility` and
`textContent` all read as exposed while an `aria-hidden` ancestor takes the node out of the tree,
and UI5's modal `Popup` applies exactly that to the static area's `<body>` siblings. Its comment
also claimed the docked mid-close setup covered "the node and its container together"; the
container is `#sap-ui-static`, which the keyboard's state cannot reach, so the comment now says
what the setup is actually for.

**One reported finding was rejected.** `QUnit.config.reorder` is not enabled by the test starter:
`_setupAndStart.js:90` is an entry in `QUNIT_KNOWN_OPTIONS`, a URL-parameter whitelist, not a
config assignment. Each run launches a fresh browser with empty `sessionStorage`, so the
injections above and in H7 executed in declaration order, and "red, then green on revert" compares
like with like.

**The failure amplifier, fixed and measured.** Three modules emptied `#qunit-fixture` without
destroying controls, so a keyboard whose inline `destroy()` is skipped by a throwing assertion kept
an `AnnouncementQueue` drain timer writing into the now page-global node while the next tests
asserted on it - turning one real failure into a run of misleading ones. `destroyKeyboards()`
(`test-helpers.ts`) sweeps the control's own live-instance registry from `afterEach` in all three;
`destroy` ignores repeated calls (`ManagedObject.js:2967`), so it composes with the inline teardown
tests already do.

**Injected**: a `throw` after `show()`/`close()` in `Open and close announcements are spoken in
turn`, which leaves a drain pending.

| a11y module `afterEach`     | result                                                               |
| --------------------------- | -------------------------------------------------------------------- |
| empties the fixture only    | **27/29** - the injected test, plus collateral damage in a later one |
| sweeps live keyboards first | **28/29** - the injected test alone                                  |

One failure stays one failure. Reverted, 29/29.

## Not covered

- Whether a real screen reader speaks the new string, or re-speaks a repeat. The
  suites assert accessibility-tree _exposure_ and the announced text; they cannot
  assert what a screen reader does with either.
- The Arabic wording. The value is now count-last and so can no longer disagree the
  way "1 variants" did, but nobody in this repo can verify its register.
- One pre-existing webc defect, out of scope and unfixed: `_liveRegionText` survives
  teardown.
- The static-area region is shared by every control on the page. Two keyboards
  announcing at once would interleave, where each previously had its own node. That
  is the ARIA-recommended arrangement and the framework's own, but it is a behaviour
  change, not a neutral refactor.
