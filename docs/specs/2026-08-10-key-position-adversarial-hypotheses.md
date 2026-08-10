# Adversarial hypotheses — the grid coordinate as persisted focus state

_Date: 2026-08-10 · Scope: `packages/kiosk-keyboard`, `packages/kiosk-keyboard-webc` · Per CLAUDE.md §7_

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
| webc component     | `npx web-test-runner test/component/kiosk-keyboard.test.ts --config web-test-runner.config.mjs`                                  |
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

## Cleared, and what remains uncovered

All seven hypotheses were seen red and reverted; all six touched production files were verified
byte-identical to their pre-injection copies afterwards, and the full gate set was re-run green.

Known residual, deliberately not addressed here: webc's variant-popup path still resolves its anchor
element by `id` (`src/core/variant-popup-controller.ts`, `src/KioskKeyboard.ts#focusKey`). That is
unchanged from `main` and outside this change's scope, but it means the rule "the element `id` is
written, never read" holds for the focus state and not yet package-wide.
