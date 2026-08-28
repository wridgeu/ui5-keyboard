# The live region and the variant count: adversarial validation (#247, #254)

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

- Reading the node directly left `The live region announces which way a width moved
the layout` red with `actual=""` — a three-second timer armed by an _earlier_ test
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
- `The live region announces which way a width moved the layout` (autoCompact)
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

## Where `InvisibleMessage.getInstance()` is reached from, and why not `init`

ARIA wants a live region in the page and empty before anything is written to it, so the
singleton is taken eagerly rather than on the first announcement. The first draft took it
in `KioskKeyboard.init`. That is reachable before the document is ready, and it throws
there:

`InvisibleMessage.prototype.init` calls `StaticArea.getDomRef()` with no guard - its own
`if (!oStatic)` fallback is dead against the 1.136 `StaticArea`, which never returns a
falsy value, only throws - and `_createStaticAreaRef` opens with
`if (!bDomReady) throw new Error("DOM is not ready yet. Static UIArea cannot be created.")`.

A `sap.ui.require` callback is **not** gated on DOM readiness the way `Core.ready` and
`attachInit` are; it fires as soon as its modules resolve. A consumer building a keyboard
from one in a head script therefore reaches `init` mid-parse. Measured against the pinned
1.136.18 with a page whose parser is held by a deliberately slow blocking script, so the
module callback lands while the document is still loading:

| reached from                      | `document.readyState` | outcome                                                            |
| --------------------------------- | --------------------- | ------------------------------------------------------------------ |
| `sap.ui.require` callback         | `loading`             | **THROW** - DOM is not ready yet. Static UIArea cannot be created. |
| a `Control`'s `init`              | `loading`             | runs - so the throw above is reachable from it                     |
| a `Control`'s `onBeforeRendering` | `complete`            | runs - rendering is gated behind DOM ready                         |

`onBeforeRendering` is therefore where it is taken, which is also where `sap.m.Select`
takes it (`Select.js:1491-1494`) for the same reason. Of the seventeen core controls that
use `InvisibleMessage`, none reaches `getInstance()` from `init`; every one waits for a
render or an event.

Nothing is lost by the wait: no announcement can reach the region before the first render
either, because `AnnouncementQueue` drops whatever is raised while `getDomRef()` is null.

**Not covered by the suite.** The QUnit page's document is always ready, so the failing
state cannot be produced in-suite. Manual repro: serve `sap-ui-core.js`, put the bootstrap
and a `sap.ui.require([...])` in `<head>`, and put a blocking `<script src>` that responds
slowly in the `<body>`; the callback runs at `readyState === "loading"`.

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
