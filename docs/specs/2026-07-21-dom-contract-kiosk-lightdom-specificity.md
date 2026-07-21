# DOM-contract: kiosk light-DOM specificity reconsideration (issue #173 follow-up)

- Date: 2026-07-21
- Status: **Option B implemented** (principled partial revert). See section 6.
- Trigger: an adversarial review of the Proposal A refactor (class families to data attributes) found that the migration regressed the **kiosk** (light-DOM) twin. The **webc** (shadow-DOM) twin is unaffected.
- Companion: `2026-07-21-dom-contract-modernization-design.md` (the refactor this revisits)

## 1. The problem

Proposal A replaced several CSS-class families with data attributes on both twins. On the webc twin this is clean: the shadow root scopes every selector for free, so `[data-key-type="modifier"]` is both scoped and specificity `(0,1,0)`, exactly like the class it replaced.

On the kiosk twin it is not clean. Kiosk renders into the **light DOM** (a shared page). A namespaced BEM class such as `.ui5KioskKey--modifier` is uniquely convenient there: the namespace lives inside the class token, so a single class is **both** scoped to the keyboard **and** specificity `(0,1,0)`. A data attribute has no namespace, so in the light DOM you must pick one of two lossy encodings:

- **Scope it** by compounding with a keyboard selector: `.ui5KioskKey[data-key-type="modifier"]` is safe but `(0,2,0)`.
- **Keep it `(0,1,0)`** by writing it bare: `[data-key-type="modifier"]` is `(0,1,0)` but matches any element on the host page.

The refactor made both choices in different places, and each choice broke something.

## 2. Verified regressions (kiosk only)

| #   | Symptom                                                          | Mechanism (file:line)                                                                                                                                                           | Baseline behavior                                                                        | Severity                                                          |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | **Caps-lock ring is invisible** (at rest, no interaction)        | `.ui5KioskKey[data-key-type="modifier"]` `(0,2,0)` sets `modifierShadow` (`KioskKeyboard.less:446,450`) and now dominates `.ui5KioskKey--capsLock` `(0,1,0)` ring (`:518,519`). | Old both `(0,1,0)`; the ring won by source order.                                        | High: an accessibility state indicator is lost.                   |
| 2   | **Pressed modifier keeps its drop-shadow** instead of flattening | `(0,2,0)` `modifierShadow` beats `.ui5KioskKey:active` `(0,1,1)` `box-shadow: none` (`:313,320`).                                                                               | Old `.ui5KioskKey--modifier` `(0,1,0)` lost to `:active`, so it flattened.               | Cosmetic; also a new cross-twin divergence (webc still flattens). |
| 3   | **Glyph font-override leaks in the light DOM**                   | Bare, unscoped `[data-glyph-script="cjk"]` inside `@layer kiosk-keyboard` (`:589,627` and siblings), not nested under any keyboard selector.                                    | Old `.ui5KioskKey__label--glyphCjk` was namespaced and could only match keyboard labels. | Low probability, but a real scoping-discipline violation.         |

None is caught by the test suite (it asserts class/attribute **presence**, never computed `box-shadow` or `font-family`) nor by the drift guard (it compares the contract modules, never the stylesheets). `check:base` is green regardless. The visual e2e that would catch #1 and #2 is the "pending local" run.

`data-key-span` (width) and `data-fkey` are **not** regressed: both are scoped under `.ui5KioskKey`, and neither has interactive state layered on top of it, so their `(0,2,0)` weight competes with nothing. `data-fkey` sets only `flex-direction`/`gap`/`font-size`; `data-key-span` sets only `flex`.

## 3. Why webc is unaffected

In the shadow DOM every rule is auto-scoped, so webc kept every migrated selector bare at `(0,1,0)`: `[data-key-type="modifier"]` ties `.kiosk-key--caps-lock` and loses to `.kiosk-key:active` exactly as the old classes did, and `[data-glyph-script="cjk"]` cannot leak past the shadow boundary. **webc should keep the attributes.** The decision below is about kiosk only.

## 4. The principle that separates the families

A family is safe as a light-DOM attribute only if it is **inert**: purely per-key layout data with no interactive or indicator state layered onto it in the cascade. A family must stay a namespaced class if the stylesheet layers state onto it, because only a namespaced class is both scoped and `(0,1,0)`.

| Family                            | Layered state?                                                       | Verdict for kiosk                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `data-key-span` (width)           | none (inert flex)                                                    | Safe as attribute. Keeps the genuine win: verbatim token, no `keyWidthClass` munging.                                                     |
| `data-fkey`                       | none (inert layout)                                                  | Safe as attribute.                                                                                                                        |
| `data-glyph-script`               | none, but currently **unscoped**                                     | Attribute is acceptable **if scoped** under `.ui5KioskKey__label`; otherwise revert to the class.                                         |
| `data-key-type` (modifier/action) | `:active`, `--pressed`, `--highlight`, `--capsLock`, `--shiftActive` | Must revert to a namespaced class on kiosk. This is the family the light DOM cannot express as an attribute without breaking the cascade. |

## 5. Options

### Option A: full revert of kiosk to classes

Restore `keyModifier`, `keyAction`, `keyFkey`, the glyph classes, the width classes, and the `keyWidthClass()` helper on kiosk. webc keeps all attributes.

- Pro: exact original cascade, zero leak, lowest risk, kiosk uses its idiomatic `sapM*`-style namespaced BEM throughout.
- Con: throws away the one genuine win the review credited (verbatim `data-key-span`, no diverged `keyWidthClass`); re-widens the twin contract gap for every family, not just the unsafe ones.

### Option B: principled partial revert (recommended)

Keep as attributes on both twins the inert families (`data-key-span`, `data-fkey`). On kiosk, revert `data-key-type` to a namespaced class (`keyModifier`/`keyAction`), and either scope `data-glyph-script` under `.ui5KioskKey__label` or revert it to the glyph class. webc keeps all attributes.

- Pro: fixes all three regressions; keeps the real wins; the split is a stated, defensible rule (inert data as attributes, style-state as namespaced classes) rather than an accident.
- Con: a mixed model on kiosk (some attributes, some classes) needs one paragraph of documentation; `data-key-type` re-diverges (kiosk class, webc attribute), absorbed by the drift-guard `PLATFORM_ONLY` allowlist.

### Option C: keep all kiosk attributes, patch the cascade

Accept `(0,2,0)` and out-specify each broken relationship: raise `--capsLock` and `--shiftActive`, add `box-shadow: none` to the modifier `:active`/`--pressed` block, and wrap the glyph rules under `.ui5KioskKey__label` for scoping.

- Pro: preserves full attribute convergence across twins.
- Con: several bespoke specificity hacks, each a future whack-a-mole hazard as new state is added; the drift guard still cannot see any of it; arguably re-creates the fragility Proposal A claimed to remove.

## 6. Recommendation

**Option B.** It is the only option that both eliminates every regression and keeps the wins that survived the adversarial review, and it turns the failure into a documented rule: in the kiosk light DOM, inert per-key data is an attribute; anything the cascade layers state onto stays a namespaced class. webc, immune by construction, keeps the fully-converged attribute contract.

If the wins are judged not worth the mixed model, fall back to Option A (full revert), which is strictly simpler. Avoid Option C.

**What shipped.** On kiosk, `data-key-type` reverted to the `keyModifier` / `keyAction` classes (renderer emits `rm.class`, the `.less` uses `&--modifier` / `&--action`), and the glyph rules gained a `.ui5KioskKey__label` scope prefix (`data-glyph-script` stays an attribute). `data-key-span` and `data-fkey` stayed attributes on both twins. webc is untouched. The drift guard now allows `keyType` as a webc-only attribute and lists `keyModifier` / `keyAction` as kiosk `PLATFORM_ONLY` classes. Regressions #1 and #3 are fixed with tests (a computed-`box-shadow` QUnit assertion for the caps-lock ring, verified failing on the pre-fix code first); #2 rides the same cascade fix and is covered by the visual e2e.

## 7. Test plan (failing-first, per CLAUDE.md sections 3 and 7)

1. **Caps-lock ring (regression #1)**: a QUnit computed-style test asserting `getComputedStyle(capsLockKey).boxShadow` contains the 2px ring. It must go **red on current `HEAD`** (proving the regression) before the fix, and green after. This is the empirical proof, not just the specificity argument above.
2. **Glyph leak (regression #3)**: a QUnit test placing a non-keyboard element with `data-glyph-script="cjk"` and asserting its `font-family` is unaffected by the keyboard stylesheet.
3. **Pressed modifier (regression #2)**: `:active` cannot be forced from script, so this stays a visual-e2e / manual repro (mouse-press a modifier key, confirm the drop-shadow flattens and matches webc). State this explicitly.
4. Full `check:base` before commit.

## 8. Non-goals

- No change to webc (shadow DOM is immune; it keeps all attributes).
- No change to the public styling API (`--ui5KioskKeyboard-*` / `--kiosk-keyboard-*` custom properties, `::part` names).
- No change to the drift guard's design; it continues to guard the contract modules. Its blind spot for stylesheet-level cascade is noted, not closed here.
