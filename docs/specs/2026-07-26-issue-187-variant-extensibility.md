# Issue #187: accent-variant extensibility, hint, a11y, target size

Date: 2026-07-26. Branch: `feat/187-accent-variant-extensibility`.

Four phases, one PR. Decisions taken with the maintainer up front:

- **Scope:** all four phases, one PR, Phase 1 first (Phase 2 depends on it).
- **Hint shape:** corner triangle (open-Q3).
- **Hint contrast (Horizon):** neutral grey `--sapContent_LabelColor` at 0.71 opacity, meets SC 1.4.11 3:1 (open-Q2).
- **Non-Latin exclusion set:** shipped in this PR (open-Q5). `ja-romaji`, `ja-kana`,
  `arabic`, `ko-hangul` resolve their built-in variant tier to `null`. Consequence:
  Phase 1 is **not** output-identical for existing `accentVariants` users on those four
  layouts, so their (semantically wrong) variant popups disappear. Output stays identical
  for every Latin layout.
- **Overflow beyond the gap reduction (open-Q7):** closed in review. The issue claimed the
  24px floor + gap reduction "covers every built-in layout". It does not, and the shortfall
  is wider than first measured: the default **11-element `qwerty` digit row** clips at the
  320px phone-sm width too, not only the 12-key `ja-kana` / `ko-hangul` rows. A
  `justify-content: center` row that overflows is clipped at **both** edges, so it is the
  outermost keys that are lost. Resolution shipped: **reachability outranks the target-size
  floor at the narrowest tier.** `min-inline-size` is lifted to `0` inside the existing
  `@container keyboard (max-width: 20rem)` block, so keys shrink to fit and every key stays
  on screen; SC 2.5.8 is met at every width above that tier and documented as not met below
  it. Measured at phone-sm after the change: `qwerty`, `ja-kana` and `ko-hangul` all render
  with zero clipped keys and a fully visible `{shift}`, so the two phone-sm shifted
  interaction skips were removed rather than kept.

  The narrowest tier is arithmetic, not preference. At the 320px phone-sm profile the
  keyboard root is 280px wide, and the `0.75rem` container padding on each side leaves 256px
  of content. The `qwerty` digit row is 11 keys but 12 units of width (ten digits plus a
  double-width `{backspace}`), and SC 2.5.8's Spacing exception requires a 24px-diameter
  circle centred on each target not to intersect a neighbour's, i.e. at least 24px
  centre-to-centre, so the row needs 12 x 24 = 288px. That exceeds the 256px available and
  still exceeds the 280px root at zero padding, so no combination of key width and gap makes
  that row conform at 320px - not the floor, not the gap reduction, not trimming the
  container padding. Single-width `{backspace}` does not close it either (11 units = 264px).
  The only conforming routes are structural: at most 10 units in the row (moving
  `{backspace}` off it below the tier), or horizontal-scroll overflow.

The issue body's line numbers predate `main` advancing; anchor every edit to the symbol,
not to a line number.

## Design: Phase 1 resolution

`resolveVariantTable(layoutName, instanceVariants?)` in `latin-variants.ts` (both packages,
byte-identical modulo the `.js` import suffix, drift-guarded):

1. built-in tier: `null` when `layoutName` is in the non-Latin exclusion set, else
   `LATIN_DIACRITIC_VARIANTS`.
2. instance entry for `layoutName`, else the instance `*` wildcard entry. An explicit `null`
   at either level opts the layout out and returns immediately.
3. otherwise the entry is merged onto the built-in tier per base letter: a letter the entry
   names takes the entry's list, a letter mapped to `[]` is dropped, and every other built-in
   letter survives. The merged table has a null prototype, so an entry keyed `__proto__`
   contributes an own property. With no entry at all the built-in tier is returned by
   identity, uncopied.

`null` return ⇒ `_getResolvedLayout` returns `base` unchanged ⇒ no `data-has-variants` ⇒
the pointer gates and the hint see nothing. A `VariantTable` return ⇒ `applyVariantDefaults`.

`applyVariantDefaults` gains a key-type filter: after the `key.variants !== undefined`
early return (authored intent, incl. `[]` suppression, always wins), a key whose `type` is
`action` / `modifier` / `space` skips table application. No-op on built-in data (table keys
are lone lowercase letters; those key types never carry such values), load-bearing for
custom instance tables keyed `{enter}` etc.

Per-package plumbing diverges (god-classes, not drift-guarded, so mirror by hand):

- kiosk: `instanceVariants` UI5 metadata property, hand-written `setInstanceVariants`,
  static `_toVariantMap` (warn+skip invalid, store `null` as opt-out), `_instanceVariantsMap`
  cache, `init()` reset, fed at `_getResolvedLayout`. `library.ts` re-exports
  `LATIN_DIACRITIC_VARIANTS` + `VariantTable`. `gen.d.ts` regenerated via `npm run generate`.
- webc: `instanceVariants` `@property({ type: Object })`, `_variantsView` `MemoMapView`, fed at
  `_getResolvedLayout`. Real `./variants` export in `package.json`. No `noAttribute`: it is a
  no-op on an `Object` property (`UI5ElementMetadata.hasAttribute` short-circuits on the type)
  and SAP reserves it for private ones.

## Adversarial hypotheses (CLAUDE.md §7)

A green suite can lie. Each hypothesis below is cleared only after the suite is SEEN red for
it, then reverted. Test-infra risk is real here: Phase 4 rewrites committed visual baselines,
and CI runs `test:e2e:ci` with `--ignore-snapshots` (never compares pixels), so a green CI
proves nothing about the triangle or the floor; the visual pass runs locally.

- **H1 (vacuous instanceVariants test):** an `instanceVariants` integration test could pass
  with the feature unwired if it asserts on a layout the built-in table already covers.
  Clear by: a custom table adding variants to a base the built-in table does NOT carry
  (e.g. `{ b: ["ḃ"] }`), and a `{ "layout": null }` opt-out that must REMOVE a
  `data-has-variants` the built-in table would otherwise set. Flip the wiring off → red.
- **H2 (key-type filter no-op unproven):** a filter test could agree with itself if the
  chosen key value also misses the table. Clear by a custom table keyed to an action token
  value AND a plain letter; the action key stays bare, the letter arms. Remove the filter →
  the action key arms → red.
- **H3 (exclusion set not actually applied):** assert a `ko-hangul` / `arabic` key that is a
  Latin base letter in ASCII romaji contexts gets NO variants under `accentVariants`, and a
  qwerty key of the same value DOES. Remove the exclusion → red on the excluded layout.
- **H4 (author/suppression regression):** the existing `variants: []` and authored-variants
  tests must stay green through the filter and resolveVariantTable rewrite. A reorder that
  puts the filter before the authored check → red on the `{backspace}` authored-variants test.
- **H5 (visual baseline blind):** corrupt one committed 320px baseline (kb-narrow) and confirm
  the local visual runner (NOT `--ignore-snapshots`) goes red; confirm the triangle actually
  renders by deleting the `::after` and re-running. Revert.
- **H6 (Phase 4 overflow masked):** confirm the 24px floor without the gap reduction produces
  a red row-overflow visual, proving the two are coupled, before landing them together.
- **H7 (aria not reflected):** assert `aria-haspopup="dialog"` present on a variant key and
  ABSENT on a bare key, and that a variant key carries NO `aria-expanded` (a type-on-activate
  key is not an expand/collapse control; see the review decision below). Drop the haspopup gate
  → red on the present-on-variant-key assertion.

### Results

| Hypothesis | Perturbation                                                      | Observed                                                                                              | Cleared |
| ---------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| H1         | `resolveVariantTable(layoutName)`, dropping the instance map      | red: 4 failures in `instance-overrides.test.ts`, incl. the mixed-case entry and the `[]` suppression  | yes     |
| H2         | delete the action/modifier/space filter in `applyVariantDefaults` | red: `skips table application on action, modifier, and space keys`                                    | yes     |
| H3         | empty `NON_LATIN_VARIANT_LAYOUTS`                                 | red: 3 failures, incl. `returns null for the built-in non-Latin layouts`                              | yes     |
| H4         | swap the authored-variants check and the key-type filter          | green: both branches `return key` unchanged, so the order is unobservable. Not a live risk; see below | n/a     |
| H5         | corrupt the committed `webc-narrow.png` baseline                  | red: `expect(locator).toHaveScreenshot(expected) failed` under the local visual runner                | yes     |
| H6         | delete both width-driven row-gap tiers                            | green on all four device profiles (20 invariants assertions). The premise no longer holds; see below  | n/a     |
| H7         | drop the `aria-haspopup` gate in the template                     | red: `variant keys advertise the popup via aria-haspopup, without aria-expanded`                      | yes     |
| H8         | restore the `max-inline-size: 1.5rem` hint suppression            | red: the hint `display` assertions on the narrow-key case                                             | yes     |

**H4 is not clearable as written.**
Both guards in `applyVariantDefaults` return the key unchanged, so reordering them produces
identical output and no test can distinguish the two orders. The substantive half of the
hypothesis does hold: the authored-variants and `variants: []` suppression tests stay green
through the filter and the `resolveVariantTable` rewrite.

**H6's premise was superseded.**
It assumed the 24px floor and the gap reduction were coupled, so that holding the floor
without the reduction would overflow a row. The open-Q7 resolution above lifts
`min-inline-size` to `0` below the 20rem tier, which removes that coupling: keys shrink to
fit there whatever the gap. Removing both gap tiers leaves every containment assertion green,
so the tiers now serve density rather than containment. This was measured on the four device
profiles the invariants spec runs; it does not prove the 20rem-to-22rem band is exercised.

### Second review round (2026-07-31)

The per-layout merge semantics, the validator hardening and the two diagnostics added in the
second review round carry their own guards, each seen red against the pre-fix code:

| Hypothesis                                                  | Perturbation                                 | Observed                                                                                        | Cleared |
| ----------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| H9 (merge is really replace)                                | restore the replacing `resolveVariantTable`  | red in both twins: the built-in letter survives, `[]` suppression, and the null-prototype merge | yes     |
| H10 (`_isValidVariantTable` accepts table-shaped impostors) | restore the `Object.values` validator        | red: `[]`, `Map`, `Date` and `{}` all logged as valid                                           | yes     |
| H11 (non-lowercase base letters silently arm nothing)       | restore the `Object.values` validator        | red: `"A"` and `"a "` accepted, shadowing the built-in for that layout                          | yes     |
| H12 (webc resolves the table against the unresolved name)   | restore `resolveVariantTable(layoutName, …)` | red: an unregistered `layout` took a different layout's table than the surface rendered         | yes     |
| H13 (the disarmed gate is silent)                           | remove `_warnDisarmedVariants`               | red in both twins: no diagnostic when `instanceVariants` is set and `accentVariants` is off     | yes     |

**Post-review corrections (2026-07-27), hint suppression and the target-size floor.** Phase 2
shipped a `@container (max-inline-size: 1.5rem)` rule suppressing the hint on "sub-target-size"
keys. It could never do that: a size container query evaluates the query container's _content_
box while `min-inline-size` floors its _border_ box, so the rule fired up to a ~34px key (~30px
in the xs padding tier) and never at 24px, where the floor made the state unreachable anyway.
Measured effect: zero hint pixels on all three phone profiles, the touch form factors where
long-press is the only route to the popup. The rule is removed rather than recalibrated; the
hint is painted at every width, since it occupies a corner of a key that keeps its full height
and so never competes with the centered glyph. **H8 (hint suppressed rather than painted):**
`content` and `clip-path` both survive `display: none`, so the original assertions could not
see this; both twins now assert `display` and add a narrow-key case. Seen red by restoring the
suppression rule.

Phase 4's floor is now `min-inline-size` **and** `min-block-size` (SC 2.5.8 is 24x24; the block
axis was previously unconstrained and fell to whatever `--*-keyHeight` was set to).

**Post-review correction (2026-07-27).** Phase 3 originally emitted `aria-expanded` on variant
keys. It was removed: the key's own Enter/Space types the glyph rather than toggling the popup,
so per MDN (avoid `aria-expanded` on elements that do not control the expanded state) and the
WAI-ARIA APG modal-dialog trigger (no `aria-expanded`), the key advertises only
`aria-haspopup="dialog"`. The keyboard open-path is the context-menu gesture (Menu key /
Shift+F10 → `oncontextmenu`).
