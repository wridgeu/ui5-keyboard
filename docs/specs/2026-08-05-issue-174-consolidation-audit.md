# Repo-wide consolidation audit (#174)

Step 1 of #174: a ranked backlog of consolidation / bloat / native-feature opportunities, with the
evidence each claim rests on. Nothing here is a commitment; each surviving entry becomes a scoped
child issue and a small behavior-preserving PR.

Measured on `main` at `0e417ba5`.

## 0. Correcting the premises in the issue body

Three of the issue's opening signals do not survive measurement, and two of its candidate areas are
already resolved. Recording that here so they are not re-proposed.

**The god-class line counts are ~45% comment.** `Get-Content | Measure-Object -Line` skips blank
lines, which is where the "~2,190 / ~1,740" figures come from. Classified by line kind:

| File                                       | Executable | Comment | Blank | Raw   |
| ------------------------------------------ | ---------- | ------- | ----- | ----- |
| `kiosk-keyboard/src/KioskKeyboard.ts`      | 1,222      | 1,169   | 183   | 2,574 |
| `kiosk-keyboard-webc/src/KioskKeyboard.ts` | 1,091      | 854     | 204   | 2,149 |

Of the kiosk file's 1,222 executable lines, 129 are the `static metadata` block — irreducible UI5
property/aggregation/event declarations — carrying a further 306 lines of public JSDoc that feeds
the generated interface and the API reference. The real target is ~1,090 lines of behavior per
twin, not 2,190. Still worth decomposing; not the emergency the raw number suggests.

**The `internal/` and `core/` module counts are not evidence of over-splitting.** Every module in
both directories is 15–560 lines with a single stated responsibility; the median is ~95. There is no
cluster of one-function files to fold back together. Consolidation pressure is in the two god
classes, not in the leaf modules.

**Grapheme handling is already `Intl.Segmenter`.** `internal/grapheme.ts` and `core/grapheme.ts` are
built on a module-level `new Intl.Segmenter(undefined, { granularity: "grapheme" })` with an explicit
"no fallback" baseline note. The hand-rolled code the issue anticipated does not exist. The only
hand-written parts are the five `\p{Script_Extensions=...}` script-family predicates, which have no
native equivalent. **Closed.**

**Responsive sizing is already as CSS-native as the platform allows.** Width breakpoints are
`@container` queries with no JS measurement. The block axis cannot follow, and
`responsive-sizing-controller.ts` documents why in situ: a block-axis container query needs
`container-type: size`, which makes the container's block size independent of its contents and
collapses this auto-height root to zero — and the trigger is "content does not fit the box it was
granted", a comparison against intrinsic size that no size query can express. **Closed; do not
re-propose container queries for the height tiers.**

**Goal 5 (divergence guardrails) is substantially delivered.** `tools/check-twin-drift.mjs` compares
29 pairs after normalization, and its `reconcile()` completeness guard fails on any same-named
`internal/` ↔ `core/` module that is in neither the checked nor the explicitly-unchecked list — a new
hand-duplicated module cannot silently skip the check. `check-style-twin-drift.mjs` and
`check-dom-contract-drift.mjs` cover the stylesheet and DOM contract. The one uncovered surface is
the pair of `KioskKeyboard.ts` files, which the checker's header calls out as "the widest unchecked
surface". That is what item 1 below attacks.

---

## Ranked backlog

### 1. Kiosk pairs `addEventListener`/`removeEventListener` by hand; its two sibling packages use `AbortSignal`

Serves goals 3 (native platform) and 5 (twin alignment). **Recommended first slice.**

`AbortController` appears 10 times across the repo and **zero** of them are in `kiosk-keyboard`:

| Package               | `addEventListener` | `removeEventListener` | `AbortController` |
| --------------------- | ------------------ | --------------------- | ----------------- |
| `kiosk-keyboard-webc` | 18                 | 3                     | 8                 |
| `hotkeys`             | 5                  | 0                     | 2                 |
| `kiosk-keyboard`      | 7                  | 8                     | 0                 |

The webc twin's `AutoShowController.sync()` is the reference shape: one `AbortController` per armed
period, `{ capture: true, signal }` on each listener, `abort()` to detach the set. The kiosk twin of
the same behavior (`internal/auto-show-behavior.ts` `enable()`/`disable()`) hand-pairs two
`addEventListener` calls against two `removeEventListener` calls, and keeps `_boundFocusIn` /
`_boundFocusOut` fields whose only purpose is giving `removeEventListener` a matching reference.

Same pattern at three more kiosk sites: `KioskKeyboard.show()`/`close()`/`exit()` for the document
`keydown` capture listener (`_boundEscapeKeydown` exists only for removal), `_clearPressedKeyState`
for the `window` `blur` safety net (`_boundClearPressedOnBlur`, likewise), and
`internal/variant-popup-behavior.ts` (3 adds / 3 removes).

- **Replacement**: one `AbortController` per armed period; `abort()` replaces every paired
  `removeEventListener`. Deletes four `_bound*` fields that exist only for removal symmetry.
- **Parity risk**: low, and the failure mode is loud. `AbortSignal` is one-shot — a controller must
  be re-created on each re-arm, so `enable()` after `disable()` must not reuse an aborted signal
  (silently attaches nothing). `exit()` ordering is unchanged.
- **Proving test**: the existing teardown assertions already cover detach; add a re-arm case
  (`disable()` → `enable()` → the listener still fires) per twin, which is precisely the regression
  a reused aborted controller would cause.

### 2. Extract the layout state machine out of both god classes, into a checked twin pair

Serves goals 1 and 5. The largest cohesive unit still living in both `KioskKeyboard.ts` files.

Kiosk: `setLayout` (1105), `_performLayoutSwitch` (1122), `_applyCompactTier` (1158), `_applyLayout`
(1211), `getBaseLayout` (1335), `resetLayout` (1345), `_resolvedLayoutName` (1966), `_getLayoutLang`
(1980), `_getResolvedLayout` (1985), plus the `_baseLayout` / `_requestedLayout` / `_layoutSource` /
`_pendingLayoutAnnouncement` fields. ~195 executable lines with a webc counterpart of the same
shape. The `_layoutSource` field's own doc-block already says it "mirrors the webc package's
`_layoutSource` semantics" — a hand-sync obligation with no checker behind it.

- **Replacement**: `internal/layout-state.ts` ↔ `core/layout-state.ts`, host-injected like the
  existing controllers, registered in `check-twin-drift.mjs` (realistically in
  `UNCHECKED_CORE_TWINS` with a reason, since kiosk fires UI5 events and webc dispatches
  `CustomEvent`; the `reconcile()` guard still forces the pair to be declared).
- **Parity risk**: medium-high. This is the `keyboardType` × `autoCompact` × `{layout:*}` ×
  locale-detection interaction, the densest state in the control.
- **Proving test**: `KioskKeyboard-layout.qunit.ts` (1,267 lines) and `KioskKeyboard-autocompact`
  must pass untouched, plus the webc `custom-layouts` / `auto-compact` suites. If the extraction
  needs a test edited, it is not behavior-preserving.

### 3. Extract the custom-layout fold cache (same treatment, lower risk)

`_getFold` / `_sameChildren` / `_reportDiagnostics` / `invalidate` / `_resolvedDefaultVariants`,
~75 executable lines in kiosk with a webc counterpart. Pure cache-and-diagnostics logic over the
already-shared `custom-layout-fold.ts` (itself byte-checked). Lower coupling than item 2, so it is
the safer rehearsal of the same extraction shape. Covered by `custom-layouts.qunit.ts` (901 lines)
and the webc `custom-layouts.test.ts`.

### 4. Nine exported types with no reference outside their own file

Goal 2, mechanical, zero behavior surface. Each is a host/contract interface consumed only as a
parameter type in its defining module, so the `export` is an internal API surface nobody imports:

| File                                                   | Symbol                                  |
| ------------------------------------------------------ | --------------------------------------- |
| `hotkeys/src/internal/registration-index.ts`           | `ScopeRegistrationBucket`               |
| `webc/src/core/announcement-queue.ts`                  | `AnnouncementQueueHost`                 |
| `webc/src/core/backspace-repeat-controller.ts`         | `BackspaceRepeatHost`                   |
| `webc/src/core/variant-popup-controller.ts`            | `VariantPopupControllerHost`            |
| `kiosk/src/internal/controls-delegation-controller.ts` | `ControlsDelegationHost`                |
| `kiosk/src/internal/dom.ts`                            | `ParticipationHost`                     |
| `kiosk/src/internal/variant-popup-behavior.ts`         | `VariantResolution`, `VariantPopupHost` |

Excluded on inspection: `hotkeys/src/types.ts` `HotkeyCallbackDetails` — unreferenced elsewhere by
name, but it is the second parameter of the public `HotkeyCallback` signature, so consumers need it
exported. A scanner that only counts identifier occurrences flags it; it must stay.

Also in this class but weaker: `input-operations.ts` `setTargetValue` is `export`ed while its only
non-test callers are two call sites in the same module (CLAUDE.md §4 is about test-only _code_, not
test-only _visibility_, so this is a judgment call, not a violation).

- **Proving test**: `tsc --noEmit` across the three packages. Nothing else can break.

### 5. Kiosk has no live-region announcement queue; webc does

Flagged as a **behavior gap, not consolidation** — out of scope for #174 under its own "no behavior
changes" non-goal, but it belongs in the backlog.

webc's `core/announcement-queue.ts` drains queued announcements one per 120 ms because "two state
changes in the same render cycle (e.g. open + shift toggle) must each be announced; assistive tech
can elide an announcement if a single live region is rewritten too quickly". The kiosk twin's
`_announceLiveRegion` is `liveRegion.textContent = text` — a single slot with no queue, so kiosk
drops exactly the announcements webc was changed to preserve. There is no kiosk-side counterpart
module and nothing in the drift checker pairs them, which is why this went unnoticed.

Needs its own issue with a repro (open + shift toggle in one cycle, assert both announcements land)
before any code moves.

---

## What implementation changed about this plan

All five items landed. Two of them did not survive contact with the code in the shape ranked above,
and the corrections are the durable part of this document.

**Item 2 cannot converge the twins, and the divergence is load-bearing.** The plan assumed the two
layout state machines were the same logic in two dialects. They are not. Kiosk funnels every request
through one `_performLayoutSwitch` that validates against the registry up front; webc has three
entry points (the `layout` attribute, a `{layout:*}` key, the session reset) and validates _late_, in
`_resolvedLayoutName`, behind a `_currentLayout || _baseLayout || layout || _localeLayout()` fallback
chain. That is deliberate: webc's `layout` attribute can be set before `_processChildren` populates
the slot, so an early registry check would reject a name that is about to be valid. Reconciling them
would move one package's validation timing — a behavior change, and a non-goal of #174. Both twins
were extracted separately instead, and the pair is declared in `check-twin-drift.mjs` as unchecked
with that reason, so the divergence is documented rather than erased.

**Item 5 was not a port, and the fix is a rate limit rather than a queue.** The plan read kiosk's
live region as "a single slot where webc has a queue". The real difference is _ownership_:
`KioskKeyboardRenderer.renderLiveRegion` derived the text from shift/caps state on every patch, which
is why `_applyCompactTier` had to defer its announcement to `onAfterRendering` to avoid being
overwritten. Ownership moved to the queue — the renderer now re-emits a `_liveRegionText` field the
queue writes — and shift/caps announcements became imperative, matching webc.

Porting webc's queue verbatim would not have fixed anything. Its `flush` drains from
`onAfterRendering`, but kiosk's `show`/`close`/variant announcements change no rendered state, so no
render follows to drain them; draining on every `announce` instead makes each write immediate and the
queue never holds more than one entry. The interval now sits between _writes_ rather than between
drains, which gives the same spacing under either drain policy and keeps a lone announcement
synchronous. Both twins share that module byte-identically (`CORE_MODULES`, 30 pairs).

One gap this pass exposed is fixed here rather than filed: leaving Caps Lock announced nothing, so
the live region kept saying "Caps Lock on" while Caps Lock was off. Both twins now settle Caps Lock
before Shift — `isShifted` is true in both modes, so a Caps Lock exit would otherwise read as a shift
release — with `ARIA_CAPS_LOCK_OFF` declared in all eight bundles.

## What the review pass caught

An adversarial review of the branch found two defects a fully green suite could not see, both in
slice 5, and both since fixed on this branch.

**A new localizable string shipped with no resource-bundle key.** `_syncShiftState` called
`getText("ARIA_SHIFT_OFF", …)` while none of kiosk's four `.properties` bundles declared the key —
the behaviour was ported across the twins, the string was not. `getText` resolves with
`bIgnoreKeyFallback`, so a missing key returns the hardcoded English with no warning: a German user
heard "Umschalttaste ein" then "Shift off". Three separate lenses found it independently.

Nothing could have caught it. `check-i18n-bundles.mjs` compared each locale bundle against _its own
package's_ default bundle, and the key was missing from that too, so all four agreed and the check
was green; the QUnit suite runs in English, where a resolved key and a missing key are
indistinguishable. The check now carries a third invariant — every `getText("KEY"` literal under a
package's `src/` must exist in that package's default bundle — which is the shape of the miss, not
just this instance of it. Verified to go red by deleting the key.

**The queue banked announcements raised while the control had no DOM.** The `!isConnected()` branch
returned without clearing `_queue`, and its comment cited a `teardown()` precondition that is never
met while a kiosk control is alive: `teardown()` runs only from `exit()`, where webc also has
`onExitDOM`. `setVisible(false)` renders the invisible placeholder without destroying the control or
detaching its physical-key delegate, so hardware Shift kept queueing an alternating pair that
`announce`'s dedupe never collapses. The backlog was then read out ahead of whatever the user
actually did next. The old single-slot write was a no-op when detached, so this was a regression the
queue introduced. A detached host now discards rather than defers.

Both fixes ship with regression tests confirmed to fail against the defect.

---

## Assessed and rejected

- **Input mutation → native `InputEvent` / `beforeinput` / `EditContext`.** Not viable for kiosk.
  `input-operations.setTargetValue` deliberately routes through `element.setValue()` rather than
  `setProperty("value")` because `InputBase.getValue()` reads from the DOM when rendered and a
  direct property write desyncs. A native `beforeinput`-driven mutation writes the DOM behind UI5's
  back, which is strictly worse: it breaks two-way binding propagation. `document.execCommand`
  ("insertText") would preserve native undo but is deprecated and equally invisible to UI5's
  property bag. The webc twin already writes the DOM value directly, so there is nothing to gain
  there either.
- **Keycaps → native `<button>`.** Already settled in CLAUDE.md with the full cost accounting
  (`sapselect` is stricter than a native button's activation, `preventDefault()` on the surface
  kills the click chain, `disabled` breaks the roving tabindex). Not reopened.
- **Shared-core package.** Declined in #105; the issue's own hard constraints restate it.
- **Physical-key highlight → CSS `:has()`.** The mapping from `KeyboardEvent.key` to a `data-key`
  value is data-driven (`{fkey:*}` derivation, `Delete` → `{backspace}`, shift-value fallback) and
  the keyup path deliberately clears _all_ highlights because a shift-first release reports the
  unshifted key. No selector expresses that.

## Suggested order

4 → 1 → 3 → 2, with 5 filed separately as a bug. Item 4 is a warm-up with a compiler-proof
verification; 1 is a genuine native-platform win with a small blast radius; 3 rehearses the
extraction shape that 2 then applies to the hard state.
