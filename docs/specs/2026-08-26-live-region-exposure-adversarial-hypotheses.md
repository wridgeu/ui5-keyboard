# The live region and the variant count: adversarial validation (#247, #254)

Written before the new suites were trusted, per CLAUDE.md §7. Each hypothesis
names a way the green run could have been lying; each is cleared only against a
run that was **seen** to go red, then reverted.

Both fixes are invisible by construction. #247 changes only whether a node is in
the accessibility tree — every pre-existing live-region assertion in
`KioskKeyboard-a11y.qunit.ts` reads `textContent`, which survives both
`display: none` and `visibility: hidden`, so the whole suite was green against a
region that never announced anything. #254 changes only a string that no user
ever sees. Neither has a visible symptom a normal assertion would catch.

## What is under test

- `KioskKeyboardRenderer.renderLiveRegion` and the package-owned
  `.ui5KioskKeyboard__liveRegion` rule that replaces the framework's
  `sapUiInvisibleText`.
- The `ARIA_VARIANTS_OPENED` value in all eight bundles, and the two code
  fallbacks that shadow them.

## H1 — the exposure assertions could pass because no stylesheet applied at all

`getComputedStyle` on an unstyled node reports `display: inline`, which is not
`"none"`. A cold run with the package CSS missing would satisfy every
`notStrictEqual(..., "none")` assertion while proving nothing.

**Falsified.** With the renderer reverted to `rm.class("sapUiInvisibleText")`:

```
1 assertions of 5 passed, 4 failed
  precondition: the package stylesheet applied   expected "absolute", got "static"
  not display:none                               expected NOT "none", got "none"
  docked-closed: still not display:none          expected NOT "none", got "none"
  docked-closed: still not visibility:hidden     expected NOT "hidden", got "hidden"
```

The `position === "absolute"` assertion is the canary: it fails loudly when the
stylesheet has not applied, so an unstyled run goes red rather than green.

## H2 — the docked-closed half could be decoration

The open-state assertions alone would pass under the one-word class swap
everyone reaches for first (`sapUiInvisibleText` → `sapUiPseudoInvisibleText`).
If the docked-closed case adds nothing, the extra `visibility: visible` and the
whole package-owned rule are unearned.

**Falsified.** With only `visibility: visible` deleted from the rule:

```
4 assertions of 5 passed, 1 failed
  docked-closed: still not visibility:hidden
```

Exactly one assertion, and it is the one the framework class cannot satisfy:
`.sapUiPseudoInvisibleText` declares no `visibility`, `.ui5KioskKeyboard--closed`
sets `visibility: hidden`, the live region is a child of the root, a docked
keyboard renders closed, and `close()` adds that class _before_ it announces. So
the one-word swap fixes the open case and leaves every docked announcement
inaudible. This hypothesis is why the fix owns the rule instead of borrowing one.

## H3 — the fix could be "just unhide it", leaving the region in normal flow

A rule that only escapes `display: none` would put a text node into the root's
flex column, moving every visual baseline and giving the per-key
`elementFromPoint` probes something new to land on.

**Falsified.** With the whole rule deleted and the class left on the span:

```
3 assertions of 5 passed, 2 failed
  precondition: the package stylesheet applied   expected "absolute", got "static"
  docked-closed: still not visibility:hidden
```

`display` is no longer `"none"` here — the framework class is gone — yet the
test still goes red. It distinguishes "unhidden" from "properly screen-reader
only", which is the property that keeps the region out of the layout.

## H4 — the #254 tests could be asserting the in-code fallback, not the shipped bundle

Both call sites pass a literal fallback to `getText`. A test that happens to
match that literal would stay green even if no bundle were ever updated.

**Falsified.** With the four kiosk bundle values reverted and the new code
fallbacks left in place:

```
3 assertions of 4 passed, 1 failed
  the count trails the noun, so no locale needs a plural form
```

Only the count-1 case goes red; the two pre-existing count-2 announcement tests
stay green. So the assertion reads the shipped bundle, and the fallback literal
is shadowed exactly as expected.

## H5 — the fix could reach only one twin

Nothing in CI compares message _values_ across the two packages:
`tools/check-i18n-bundles.mjs` rebuilds its expected key list per package and
compares no values, and no i18n path appears in `tools/check-twin-drift.mjs`'s
manifest. A one-twin fix would pass every guard.

**Falsified,** observed rather than injected: an early run with the webc bundle
edited but `src/generated/i18n/i18n-defaults.ts` not yet regenerated left webc
resolving the old string while kiosk was already green.

```
kiosk-keyboard - accent-variant popup > announces a single variant ...
  AssertionError: expected '1 variants for a' to equal 'Variants for a: 1'
```

Each twin's own regression test is therefore the only thing holding the parity.

## Not covered

- Whether a real screen reader speaks the new string. The suites assert
  accessibility-tree _exposure_ (computed `display` / `visibility` / `position`)
  and the announced text; they cannot assert what a screen reader does with it.
- The Arabic wording. The value is now count-last and so can no longer disagree
  the way "1 variants" did, but nobody in this repo can verify its register.
- Two pre-existing webc live-region defects, both out of scope and unfixed: an
  announcement identical to the text already held is swallowed by UI5Element's
  change guard, and `_liveRegionText` survives teardown.
