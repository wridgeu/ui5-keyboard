# Arabic keycap shaping guards: adversarial hypotheses

- Date: 2026-08-03
- Issue: #212 fallout (PR #220)
- Guards under test:
  - `packages/kiosk-keyboard-webc/test/e2e/arabic-keycap-shaping.spec.ts` (width probe)
  - `packages/kiosk-keyboard-webc/test/component/kiosk-keyboard-icon-label.test.ts`
    (computed `font-feature-settings` pin + scoping guard)
  - `packages/kiosk-keyboard/test/qunit/KioskKeyboard.qunit.ts` (the kiosk twin of the same pair)
- Declarations under guard:
  - `packages/kiosk-keyboard-webc/src/themes/KioskKeyboard.css` `[data-glyph-script="arabic"] { font-feature-settings: "isol" 0 }`
  - `packages/kiosk-keyboard/src/themes/base/KioskKeyboard.less:730`, the same declaration
- Method (CLAUDE.md §7): a green suite can lie. Each hypothesis below is a way a green
  run could be a false positive. Cleared only after SEEING the suite go red for it, then
  reverting the perturbation.

## Why the coverage is split

The e2e probe measures whether the shaper picks a different glyph with the keycap's
resolved feature settings than with `normal`. That is a question about the resolved
Arabic font, not about the stylesheet: which glyphs an `isol` lookup substitutes is a
property of the font file. The repo's own chromium answers `["ه"]` under Segoe UI and
`[]` under Tahoma or Arial, and `document.fonts.check` returns true for a bogus family,
so the probe cannot even gate on font identity. On ubuntu-latest the resolved Arabic
font has no `isol` lookup for U+0647 at all, so the probe observes nothing there.

The probe is therefore an equality-free subset assertion: no glyph other than heh may be
reshaped. A font that reshapes nothing satisfies it vacuously, which is why the
font-independent half — the declaration is present on Arabic labels and nowhere else —
lives in the component and QUnit suites, which read computed style and need no real font.

## Hypotheses

- **H1 (the declaration is live).** Both suites must fail if the declaration is deleted
  outright, on every platform. Perturbation: delete `font-feature-settings: "isol" 0`
  from the webc stylesheet, and `font-feature-settings: ~'"isol" 0'` from the LESS twin.
  **Expected:** component + QUnit red on all platforms; on Windows the e2e file red at
  `:29`, not at the subset assertion, which a shaper that reshapes nothing satisfies.
- **H2 (the scoping is live).** `font-feature-settings` inherits, so hoisting the
  declaration to `.kiosk-key__label` / `.ui5KioskKey__label`, to the keyboard root or to
  `:host` would keep every positive assertion green while turning the feature off for
  every keycap in the layout, Latin ones included. The sibling assertion — a label
  without `data-glyph-script` computes `normal` — is the guard for it. Perturbation:
  move the declaration up to the label class in both stylesheets. **Expected:**
  component + QUnit red on all platforms; the e2e probe cannot see it at all.
- **H3 (the value is pinned, not merely non-empty).** An extra feature tag added
  alongside `isol` changes what the shaper does while leaving the property set, so an
  assertion that only checked for a non-`normal` value would pass. Perturbation: add a
  second tag (`"isol" 0, "liga" 0`). **Expected:** the component and QUnit string pins
  red on all platforms; the e2e subset assertion red on Windows, where the extra tag was
  expected to reshape further glyphs.
- **H4 (the e2e probe is inert wherever the runner's Arabic font has no `isol` lookup).**
  This is not a defect to fix but the limit of what the probe can assert, recorded so a
  green e2e leg is not read as coverage of the declaration. With no `isol` lookup the
  filtered set is empty, the subset assertion holds trivially, and the sibling test at
  `:29` ("the heh keycap shows the isolated letter") compares two widths that are equal
  whether or not the stylesheet does anything. Both are Windows-only signal. H1-H3 are
  the platform-independent coverage. H3 sharpened this further: even on Windows the
  probe sees only substitutions that change an advance width in a one-character sample,
  so it is blind to a feature tag being added as well as to one being removed.

## Results

Each perturbation was reverted immediately after observing red, and the suites re-run
green afterwards.

| Hypothesis | Perturbation                               | Observed                                                                                                                                                                                                                                                  | Cleared |
| ---------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| H1         | delete the declaration (webc CSS)          | red: component 43/44, `an arabic keycap turns isol off: expected 'normal' to equal '"isol" 0'`                                                                                                                                                            | yes     |
| H1         | delete the declaration (webc CSS), e2e leg | red on Windows at `:29`: `heh keycap does not render the isolated form`, expected 9.03 received 13.53; the subset assertion stayed green, as predicted                                                                                                    | yes     |
| H1         | delete the declaration (kiosk LESS)        | red: QUnit 82/83, `an arabic keycap turns isol off`                                                                                                                                                                                                       | yes     |
| H2         | hoist to `.kiosk-key__label`               | red: component 43/44, `a label with no glyph script keeps the font default: expected '"isol" 0' to equal 'normal'`                                                                                                                                        | yes     |
| H2         | hoist to `.ui5KioskKey__label`             | red: QUnit 82/83, `a label with no glyph script keeps the font default`                                                                                                                                                                                   | yes     |
| H3         | `"isol" 0, "liga" 0` (webc CSS)            | red: component 43/44, `expected '"isol" 0, "liga" 0' to equal '"isol" 0'`. The e2e leg stayed **green** on Windows, against the prediction: `liga` has nothing to substitute in a one-character sample, so the width probe cannot see a second tag at all | yes     |
| H3         | `~'"isol" 0, "liga" 0'` (kiosk LESS)       | red: QUnit 82/83, `an arabic keycap turns isol off`                                                                                                                                                                                                       | yes     |
| H4         | none (limit, not a defect)                 | the e2e probe's `changed` set is `[]` under Tahoma / Arial and `["ه"]` under Segoe UI                                                                                                                                                                     | n/a     |

## Trap found while clearing H1

The first H1 run passed. The webc component suite loads the stylesheet through
`src/generated/`, which `ui5nps generate` rebuilds from `src/themes/*.css`; invoking
`web-test-runner` directly therefore tested a stale copy that still carried the deleted
declaration. `npm run test:component` chains `npm run generate` first, so CI and the
documented command are unaffected — but an injection run that skips it proves nothing.
Every result above was taken after a `generate`.

## Accepted residuals

- The e2e width probe stays in the suite because it is the only assertion that observes
  the rendered glyph rather than the declared property, and on Windows it is the test
  that would catch `isol 0` being the wrong lever for the defect. On Linux it runs, costs
  a page load, and asserts nothing. Deleting it would trade real Windows signal for that.
- Neither suite proves the resolved Arabic font stack is the one the stylesheet names.
  `document.fonts.check` returns true for families that are not installed, so font
  identity is not observable from the page; the `font-family` half of the same rule is
  covered by the existing light-DOM leak test, which compares against a plain span.
