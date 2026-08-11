# The grid coordinate as persisted focus state: adversarial hypotheses

- Date: 2026-08-10
- Issue: #232 (arrow navigation and the roving tab stop after a host id assignment)
- Scope: `packages/kiosk-keyboard`, `packages/kiosk-keyboard-webc`, per CLAUDE.md §7

The persisted focus state became the grid coordinate `{row, col}`, resolved through
`KIOSK_KEYBOARD_DOM.selectors.keyByPosition` and scoped to the control root (kiosk) or the shadow
root (webc). The element `id` is written and never read.

Two things make a green suite worth distrusting here:

- The vitest fixture in `packages/kiosk-keyboard-webc/test/unit/key-grid-navigation.test.ts` was
  rewritten — `makeGrid` no longer writes `key.id`, it writes the two coordinate attributes, `keyAt`
  resolves through `keyByPosition`, and `tabbableIds()` became `tabbable()`. That is a
  test-infrastructure change.
- No drift tool covers any file involved. `tools/check-twin-drift.mjs` passes only the **basename
  intersection** of `internal/` and `core/`, and `dom` ≠ `dom-utils`, so those two escape even the
  completeness guard; `key-grid-navigation` sits in `UNCHECKED_CORE_TWINS`. A one-sided
  implementation produces no tool output, which is the #98/#108 failure mode.

Each hypothesis below was cleared only after the suite was **seen** red, then the fault reverted and
the suite re-run green. Faults were applied to production source, never to assertions, except where
noted in H7.

## Runners

| Suite              | Command                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| webc unit          | `npx vitest run test/unit/…` in `packages/kiosk-keyboard-webc`                                                                   |
| webc component     | `npx web-test-runner test/component/<file>.test.ts --config web-test-runner.config.mjs`                                          |
| kiosk focus module | `npx ui5-test-runner --url ".../Test.qunit.html?testsuite=…&test=KioskKeyboard-focus"` against a running `ui5 serve --port 8082` |

The kiosk module was driven directly rather than through `npm run test:qunit` so a fault could be
cleared in seconds; the full suite was run green before and after the pass.

## Hypotheses

### H1 — the fixture writes both ids and coordinates, so the suite passes whether or not the lookup migrated

Mitigation applied in the change itself: `makeGrid` writes **no** `key.id` at all. A green suite
therefore proves navigation works with no key ids in the DOM.

**Fault:** replaced the `keyByPosition` lookup in webc `key-grid-navigation.ts#onKeyDown` with
`getShadowRoot()?.getElementById(\`kb-key-${row}-${col}\`)`, the pre-change shape.

**Observed red:** `test/unit/key-grid-navigation.test.ts` — **19 failed | 15 passed (34)**. Every
movement assertion reported `getLastFocusedKey()` as `null`.

Corroborated by a permanent artifact: `KeyGridNavigation - element ids take no part in resolution`
sets a target key's `id` to garbage and asserts navigation still lands on it, and the kiosk twin has
`Arrow navigation resolves the neighbour by grid coordinate, not by element id`.

### H2 — `keyPositionOf` reads the wrong attribute

Two independent copies, one per twin, compared by no tool. Cleared separately on each side.

**H2a fault (webc):** swapped `rowIndex` / `keyIndex` in `src/core/dom-utils.ts#keyPositionOf`.
**Observed red:** `test/unit/key-grid-navigation.test.ts` + `test/unit/dom-utils.test.ts` —
**19 failed | 42 passed (61)**.

**H2b fault (kiosk):** the same swap in `src/internal/dom.ts#keyPositionOf`.
**Observed red:** `KioskKeyboard-focus` — **47/52**, failing the two landed-key tests, the two arrow
tests, and `getFocusInfo returns lastFocusedKey`.

H2b also answers the asymmetry that kiosk has no unit suite for `dom.ts`: the helper is covered
there through behavior, and the guards are genuinely exercised rather than merely present.

### H3 — the new focus-info assertions are vacuous

The migrated assertion became `assert.deepEqual(info.lastFocusedKey, {row, col})`. The one it
replaced, `info.lastFocusedKeyId!.includes("key-")`, passed for any string containing `key-`.

**Fault:** `KioskKeyboard.getFocusInfo` returns `{ id: this.getId(), lastFocusedKey: { row: 0, col: 0 } }`
unconditionally.

**Observed red:** `KioskKeyboard-focus` — **49/52**, including
`getFocusInfo returns lastFocusedKey → lastFocusedKey is the grid position of the tapped key`.

The expected value is read off the tapped key's own attributes but maps `rowIndex→row` and
`keyIndex→col` explicitly, so it is not circular: H2b's swap turns it red as well.

### H4 — resolution is not actually scoped to the control's own DOM

Key lookups moved off `document.getElementById`, where they were safe only by virtue of the
control-id prefix, onto a root-scoped `querySelector` over a prefix-free attribute selector. Two
keyboards on one page now hold the same coordinate strings.

**Fault:** `KeyGridNavigation._keyAt` resolves through `document.querySelector` instead of
`this._rootRef?.querySelector`.

**Observed red:** `KioskKeyboard-focus` — **51/52**, failing exactly
`getFocusDomRef resolves the remembered key inside the keyboard's own DOM → Second keyboard resolves its own key`.

This test cannot go red on `main` — it guards the scoping change, not a pre-existing defect.

### H5 — `_transferFocus` records the requested coordinate rather than the landed one

The row-boundary continuation and the vertical `Math.min` clamp deliberately land somewhere other
than the requested coordinate, so recording `{row, col}` would persist a lie that only shows up
after a re-render.

**Fault:** appended `this._lastFocusedKey = { row, col };` after the `_transferFocus` call in
`_move`.

**Observed red:** `KioskKeyboard-focus` — failing exactly
`Row-wrapping navigation remembers the key it landed on` and
`Column-clamping navigation remembers the key it landed on`, both assertions in each.

### H6 — the #232 regression tests would pass without the fix

**Fault:** restored `src/KioskKeyboard.ts`, `src/core/dom-utils.ts` and
`src/core/key-grid-navigation.ts` to `HEAD`, leaving the tests as written.

**Observed red:** `test/component/kiosk-keyboard.test.ts` — **151 passed, 2 failed**, and for the
defect each claims:

- Bug A: `ArrowRight focuses row 1, column 1: expected <div id="kiosk-kb-111-key-1-0" …> to equal <div id="kiosk-kb-111-key-1-1" …>` — focus never moved.
- Bug B: `the tab stop follows the key it was seated on: expected '1' to equal ','` — the tab stop reset to `(0, 0)` of `numeric`.

### H7 — the Bug B test is coordinate-degenerate, so it passes whether or not the anchor follows its key

Raised during adversarial review of the change, and it was **true as first written**. The test
anchored on `"4"`, which sits at `(0, 3)` in _both_ `qwerty` and `numeric`, so the final assertion
could not distinguish "the anchor followed its key by value" from "the old coordinate was carried
over untouched".

**Fault:** made `_reseatFocusAnchor` a no-op with respect to the tab stop, so the previous
coordinate is carried over instead of re-seated by value.

**Observed, with the original `"4"` anchor:** the Bug B test **passed** under the fault. Degenerate,
confirmed empirically rather than argued.

**Fix applied:** the test now anchors on `","`, which sits at `(4, 1)` in `qwerty` and `(2, 2)` in
`numeric`, and asserts the seated column as well as the value.

**Observed red after the fix, same fault:** `the tab stop follows the key it was seated on: expected '1' to equal ','`.
The strengthened test also remains red under H6, so it still guards #232.

A second assertion was added in the same pass: the test read the _first_ `[tabindex="0"]` key rather
than asserting there is only one, so a regression leaving a stale tab stop earlier in DOM order
would have gone unnoticed. It now asserts `tabStops.length === 1`.

### H8 — the variant-popup regression test would pass without its fix

webc's variant popup carries the same coordinate: `VariantPopupState.anchorKey` replaced
`anchorKeyId`, so opening the popover, matching a re-press against the open anchor, and restoring
focus on dismiss all resolve through `keyByPosition`. The popup's own state change is what triggers
the render that re-emits every key id under the new prefix, so the gesture loses its anchor
mid-flight — a second, independent instance of #232, not a variation of the two above.

**Fault:** restored `src/KioskKeyboard.ts`, `src/core/dom-utils.ts`, `src/core/key-grid-navigation.ts`
and `src/core/variant-popup-controller.ts` to `main`, leaving the tests as written.

**Observed red:** `test/component/variant-popup.test.ts` — **58 passed, 1 failed**, failing exactly
`opens the popup on a host that was given an id after its first render: opened in the top layer:
expected false to equal true`. The popup never opened, which is the user-visible defect.

### H9 — nothing stops a holder writing through the coordinate it was handed

The persisted state used to be a string, which no accessor could hand out editably. `getFocusInfo()`,
`KioskKeyboardRenderer.resolveFocusTarget()` and webc's `_getFocusPosition()` return the live
`_lastFocusedKey` object, so a caller could now edit the navigator's state without going through
`setLastFocusedKey`. No suite can see this: every write in either twin replaces the reference, so the
invariant holds today and only a future edit could break it. The guard has to be the type.

**Fault:** added `pos.row = 0;` to kiosk `applyFocusInfo`, inside the branch that reads the handed-out
position.

**Observed red:** `typecheck:kiosk` — `src/KioskKeyboard.ts(1651,11): error TS2540: Cannot assign to
'row' because it is a read-only property.`

`KeyPosition` declares `readonly row` / `readonly col` in both twins. That the whole repo — both
`src/`, both test suites, both e2e projects and the demo app — still typechecks clean under it is the
evidence that the invariant already held everywhere; the type now holds it.

## Cleared

All nine hypotheses were seen red and reverted; every touched production file was verified
byte-identical to its pre-injection copy afterwards, and the full gate set was re-run green.

The rule "the element `id` is written, never read" holds package-wide: no key lookup in either twin
resolves through `getElementById` or parses a coordinate back out of an id.
