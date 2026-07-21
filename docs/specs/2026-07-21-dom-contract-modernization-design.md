# DOM-contract modernization (issue #173)

- Date: 2026-07-21
- Status: design, approved for planning
- Scope: `dom-contract.ts` in both `kiosk-keyboard` (light DOM) and `kiosk-keyboard-webc` (shadow DOM)
- Relationship to PR #188: deliberately separate. PR #188 (ResizeObserver swap) only reads the `cqShort`/`cqTiny` classes from the contract; it neither renames nor restructures anything. This work lands as its own PR so the perf change stays reviewable and revertible on its own.

## 1. Context and motivation

`dom-contract.ts` is the centralized, zero-dependency map of CSS class names, data attributes, and selector helpers for the keyboard's flat DOM. It works, but its shape has drifted toward a large enumerated-class surface, and the two hand-maintained copies have diverged along more than one axis (naming convention, and a width-encoding helper that strips the dot in one package and dashes it in the other).

This design modernizes the contract and, in the same move, closes the structural drift between the two packages. It is a refactor plus one guardrail, not a bug fix.

The scope was set by research into current OSS and web-platform practice (Radix, SUIT, MDC, Spectrum, Shoelace/Web Awesome, SAP UI5 core, MDN, web.dev, caniuse). The research changed the original issue's plan in two places, recorded below.

## 2. Fixed constraints

Every decision here respects three constraints that are treated as settled:

1. **The public styling API is the `--ui5KioskKeyboard-*` CSS custom properties**, not the class names. The classes and selectors are an internal plus test-assertion hook (`KioskKeyboard.DOM`). This is what makes renaming or moving classes a refactor rather than a breaking change. Before shipping, a grep of the demo app and docs confirms no class name leaked into a de-facto public contract.
2. **No runtime shared package** between the two packages (decided in #105). `kiosk-keyboard` ships UI5 AMD resolved by namespace and cannot take a runtime npm dependency. Build-time and CI-time mechanisms are allowed.
3. **The contract module stays zero-dependency**, importable from any tsconfig context (src, QUnit, e2e).

## 3. Scope decisions

| Proposal                                 | Decision                                     | One-line reason                                                                                                                                                                                                     |
| ---------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Enumerated classes to data attributes | **Do it**                                    | Mutually-exclusive enums as one attribute make illegal states unrepresentable, self-document the DOM, and reconverge the two packages for these families.                                                           |
| B. Style state off ARIA                  | **Drop**                                     | Evidence says this is the wrong move: SAP's own `ToggleButton` keeps a state class alongside `aria-pressed`, and caps/pressed/highlight have no honest ARIA source. Low value, breaks test hooks and twin parity.   |
| C. Kill twin drift                       | **Do it, as a CORE + allowlist drift guard** | A ~60-line Node script in the same family as the existing `check-twin-drift.mjs`. Not codegen (over-engineered for two divergent-by-design objects), not strict key equality (would fire on legitimate divergence). |
| D. Naming convention                     | **Document, do not rename**                  | Canonical kebab-BEM is wrong for kiosk (it would sit against UI5's camelCase `sapM*` house style). Keep each package's convention, converge only the contract key names.                                            |

## 4. Proposal A: data attributes over enumerated classes

The decision is split by the kind of value. Do not apply one rule uniformly.

### 4.1 `data-key-type` (category enum) and `data-fkey` (orthogonal boolean)

`modifier`, `action`, and `fkey` are NOT one mutually-exclusive family. `keyModifier` / `keyAction` come from `key.type` via an else-if (mutually exclusive), but `keyFkey` comes from `parseKeyAction(key.value).kind === "fkey"` on a separate `if`, and the F-keys (`{fkey:F1}`..`{fkey:F12}`) carry `type: "modifier"`, so an F-key emits BOTH `keyModifier` and `keyFkey` today (webc `part="key modifier fkey"`). Collapsing all three into one attribute value would drop the modifier styling from F-keys. So the category and the fkey flag are modeled separately, which is exactly the Radix split (single-valued enum as one attribute, orthogonal booleans as presence attributes):

- `data-key-type="modifier"` | `"action"`: the mutually-exclusive category from `key.type`. A key that is neither (a plain character key, or a `space` key) carries no `data-key-type`, matching today's "no modifier/action class" state. Styling: single attribute selectors `[data-key-type="modifier"]`, `[data-key-type="action"]`.
- `data-fkey` (presence attribute, empty value, read via `hasAttribute`): replaces `keyFkey`, orthogonal to `data-key-type`, so an F-key carries both `data-key-type="modifier"` and `data-fkey`. This uses the repo's own presence-attribute idiom (`rm.attr(name, "")` on kiosk; `data-fkey={isFkey ? "" : undefined}` on webc). Styling: `[data-fkey]`.

The old class family could set two members at once as an unenforceable invariant; the split makes the category single-valued (illegal to set both modifier and action) while keeping fkey as the honest independent boolean it actually is.

### 4.2 `data-glyph-script` (script enum)

Replace `keyLabelGlyphCjk` / `keyLabelGlyphHangul` / `keyLabelGlyphIndic` / `keyLabelGlyphArabic` with:

- `data-glyph-script="cjk"` | `"hangul"` | `"indic"` | `"arabic"` on the label element.
- The base marker `keyLabelGlyph` (the orthogonal "is a glyph label" boolean) stays a class. It is not part of the script enum, and keeping it a class minimizes churn.
- Styling: `[data-glyph-script="cjk"]`, and so on.

### 4.3 `data-key-span` (numeric width)

Replace the `keyWidthClass(width)` helper and its `keySpace` companion with a verbatim attribute:

- `data-key-span="1.25"` | `"1.5"` | `"1.75"` | `"2"` | `"2.25"` | `"2.75"` | `"space"`, carried verbatim from the layout token. The authoritative closed vocabulary is the `KeyWidth` union in `types.ts`.
- This deletes the string-munging helper that drifted between the packages (kiosk `.replace(".", "")` gives `--w15`, webc `.replace(".", "-")` gives `--w1-5`). Over the real `KeyWidth` vocabulary neither encoding actually collides today, so this removes a _latent_ lossiness and the divergence, not an active shipping bug.

**CSS mechanism (shipping path).** A closed set of single attribute rules, one per width, replacing the current `&--wNN { flex: N 1 0 }` block:

```css
[data-key-span="1.25"] {
  flex: 1.25 1 0;
}
[data-key-span="1.5"] {
  flex: 1.5 1 0;
}
[data-key-span="1.75"] {
  flex: 1.75 1 0;
}
[data-key-span="2"] {
  flex: 2 1 0;
}
[data-key-span="2.25"] {
  flex: 2.25 1 0;
}
[data-key-span="2.75"] {
  flex: 2.75 1 0;
}
[data-key-span="space"] {
  flex: 6 1 0;
}
```

Typed `attr()` (`flex: attr(data-key-span type(<number>)) 1 0`) is deliberately **not** used as the primary path: it is Chromium-only (Chrome and Edge 133+, not Baseline as of mid-2026), so Safari and Firefox would render no width. It also could not cleanly express `space` (whose `flex` grow is 6, not its token value). The static set is lossless, works everywhere, and is tiny because the vocabulary is closed. A typed-`attr()` block guarded by `@supports (x: attr(x type(*)))` may be added later as a progressive enhancement without touching the emitted DOM; it is out of scope here.

### 4.4 Specificity rule (load-bearing)

All new selectors stay **single attribute selectors**: `[data-key-type="modifier"]`, never `.ui5KioskKey[data-key-type="modifier"]`. A single attribute selector has the same weight as a single class (0,1,0), so it slots into the existing cascade with no specificity change. Compounding it with the block class would silently bump to 0,2,0 and change which rules win, which matters because these hooks back existing override CSS and test assertions.

### 4.5 Contract changes and blast radius

`attributes` gains four shared entries on **both** packages (key and value identical): `keyType: "data-key-type"`, `fkey: "data-fkey"`, `glyphScript: "data-glyph-script"`, `keySpan: "data-key-span"`.

`classes` loses on both packages: `keyModifier`, `keyAction`, `keyFkey`, `keyLabelGlyphCjk`, `keyLabelGlyphHangul`, `keyLabelGlyphIndic`, `keyLabelGlyphArabic`, plus kiosk's `keySpace` and the `keyWidthClass()` helper (both copies).

Files touched (grep the literal class strings, not just the contract module):

- Contracts: `kiosk-keyboard/src/internal/dom-contract.ts`, `kiosk-keyboard-webc/src/core/dom-contract.ts`.
- Emitters: `KioskKeyboardRenderer.ts` (`rm.class(...)` to `rm.attr(...)`), `KioskKeyboardTemplate.tsx` (class-map entries to attribute bindings).
- Styles: `kiosk-keyboard/src/themes/base/KioskKeyboard.less` (width block at ~347-368, modifier/action rules at ~193-194 and ~694-705, glyph rules at ~589/627), and the webc CSS twin.
- Types comments: `types.ts` in both packages reference the old `--w15` mapping and need updating to the attribute.
- Tests: QUnit and e2e helpers and specs that hard-code `ui5KioskKey--modifier` / `kiosk-key--modifier` / `--wNN` and the glyph classes.

### 4.6 Explicitly untouched

The webc `parts` / `exportParts` surface (`modifier`, `action`, `fkey`, ...) is a separate, semi-public `::part` API. Moving the classes to attributes does not force renaming the parts, and `::part()` cannot be reliably combined with attribute selectors across the shadow boundary in all engines. Leave the part names as-is in this refactor.

## 5. Proposal C: DOM-contract drift guard

Add one script, `tools/check-dom-contract-drift.mjs`, a sibling to `tools/check-twin-drift.mjs`, wired into the same static CI job (alongside `test:twin-drift` and `test:packages:smoke`) as `"test:dom-contract": "node tools/check-dom-contract-drift.mjs"`.

It runs on Node >=24 (already the repo engines pin) and `import()`s both frozen contract modules directly. Both files are erasable-syntax-only TypeScript (type annotations, `as const`, `Object.freeze`, no enums or decorators), so Node's native type-stripping loads them with zero new dependencies. A one-line comment on each `dom-contract.ts` records that erasable-syntax constraint so the guard keeps working.

What it checks:

1. **`classes` and `selectors`: compare KEYS, not values.** The string values legitimately differ by naming convention, so a value diff is wrong here (this is exactly why `dom-contract` sits in `UNCHECKED_CORE_TWINS` in the byte-level twin check). The check is CORE-subset plus per-side allowlist, not set-equality:
   - **CORE** keys must exist on both sides.
   - Each side's remaining keys must be in that side's **PLATFORM_ONLY** allowlist.
   - Any unclassified key fails with an actionable message forcing the author to decide "shared (add the twin, promote to CORE)" or "platform-only (add to the allowlist with a reason)". This converts a forgotten twin from silent drift into a CI failure.
2. **`attributes`: assert key AND value identical** across both packages. Data attributes are the real cross-DOM wire and test contract and must stay byte-identical (including the four new A entries: `data-key-type`, `data-fkey`, `data-glyph-script`, `data-key-span`).
3. **Width injectivity.** Assert the width-to-DOM mapping is injective over the full `KeyWidth` vocabulary (no two distinct tokens collide). After A this reduces to asserting `data-key-span` carries each token verbatim; the assertion stays as a permanent lock so a future lossy helper cannot reappear.

Initial classification (starting point, adjusted as A lands):

- **CORE**: `root`, `rootDocked`, `rootDisabled`, `row`, `key`, `keyShiftActive`, `keyCapsLock`, `keyHighlight`, `keyLabel`, `keyLabelGlyph`, `keyLabelMulti`, `keyIcon`, `keyDual`, `variantPopup`.
- **PLATFORM_ONLY kiosk**: `rootClosed`, `rootCqShort`, `rootCqTiny`, `keyPressed`, `keyVariantAnchor`, `variantPopover`, `variantOption`.
- **PLATFORM_ONLY webc**: `rootHidden`, `rootNumpad`, `rootNumeric`, `hostCqShort`, `hostCqTiny`, `liveRegion`, `variantPopupHost`, `parts`, `exportParts`.

Deliberately minimal: no scoring, no confidence output, no auto-fix, roughly 60 lines that exit non-zero with a clear message. If it ever needs a third comparison dimension, that is the signal to revisit.

## 6. Proposal D: documented conventions, no rename

Keep both conventions and write each one down in the contract header:

- **kiosk**: camelCase-BEM hybrid (camelCase segments, BEM `__` and `--` grammar), for example `ui5KioskKey__label` and `ui5KioskKey--pressed`. This matches UI5's own camelCase house style (`sapMBtn`, `sapMBtnInner`, `sapMBtnActive`) in the light DOM it renders into, and is essentially SUIT-with-a-namespace-prefix, a recognized pattern.
- **webc**: canonical kebab-BEM (`kiosk-key__label`, `kiosk-key--modifier`), matching MDC and Shoelace and its own kebab `::part` names.

Converge on **structure**, diverge on **casing**. The two packages keep the same BEM grammar and the same `dom-contract` KEY names (which proposal C then guards); the casing of the emitted strings differs by design because each renders into a different framework. That casing difference is correct per-framework house style, not drift.

A full rename to canonical kebab-BEM was rejected: it would put kebab classes against the `sapM*` idiom in kiosk's light DOM, and would touch every renderer line, `.less` rule, and test selector for zero consumer-visible benefit, against "every changed line must trace to the request" and "sharing has a cost".

## 7. Why proposal B is dropped

The original issue proposed styling stateful modifiers off ARIA attributes instead of parallel classes. Research reversed this:

- SAP's own `sap.m.ToggleButton` emits `aria-pressed` **and** keeps a separate `sapMToggleBtnPressed` class for styling (verified across pinned OpenUI5 1.118 to 1.145). Every source warns against coupling pixels to the ARIA surface generally; MDN endorses styling off `[aria-disabled="true"]` specifically, but even there keeping the class preserves twin parity and a stable test hook.
- `keyCapsLock`, `keyPressed`, and `keyHighlight` have no honest ARIA twin: caps is a label swap on the shift key, pressed is momentary (mapping it to `aria-pressed` would announce a false persistent toggle to assistive tech), and highlight is a hardware-key echo. So B cannot be "delete the state classes".
- The web-component `:state()` primitive is real (Baseline 2024) but host-only: it cannot reach the per-key shadow nodes where most of these states live, the light-DOM kiosk control cannot use it at all, and adopting it webc-only would deepen the very drift proposal C exists to close.

Net: B is low value and would cost test-hook churn and twin divergence. The state classes stay as-is on both packages.

## 8. Testing strategy

- **Proposal A (behavior parity, per CLAUDE.md section 3).** The renderer black-box suites assert the emitted DOM. Update them to assert `data-key-type` / `data-glyph-script` / `data-key-span` presence and value where they previously asserted classes, and add an assertion that each layout width token reaches the DOM verbatim (the regression lock for the removed lossy helper). Integration selectors that resolve keys by type or width switch to the new attributes.
- **Proposal C (the guard itself, per CLAUDE.md section 7).** A green guard can lie. Before trusting it, prove it goes red on each real breakage and then revert: (1) add a CORE key to one contract only (must fail with the shared-vs-platform message); (2) change a `data-*` value on one side only (must fail the attributes equality check); (3) reintroduce a lossy width mapping (must fail injectivity); (4) point the importer at a bogus path (must fail, not pass empty). Record these hypotheses in a dated `docs/specs/2026-07-21-dom-contract-drift-adversarial-hypotheses.md` and clear each only after seeing red.
- **Full suite before commit.** Lint, fmt, typecheck, twin-drift, the new dom-contract guard, all QUnit and webc suites, and package smoke, per the existing `check:base`.

## 9. Implementation order

1. **C first.** Land the drift guard against the current contracts (with today's key classification) so the two packages cannot diverge further while A lands. Adjust CORE and the allowlists as A removes keys.
2. **A next.** Data attributes and the width span, one package fully green before touching the other, then reconcile the contract key names so the guard passes.
3. **D alongside.** Add the documented convention headers as part of the contract edits in step 1 and 2.

## 10. Non-goals

- No runtime shared package (#105).
- No codegen for the contracts.
- No mass class rename.
- No change to the `--ui5KioskKeyboard-*` public custom-property API.
- No change to the webc `::part` / `exportParts` surface.
- Proposal E (replacing the height-responsive JS with height container queries) is not in scope; it is a separate spike, and it overlaps the controller PR #188 just rewrote.

## 11. References

Key sources from the research pass (full set in the research task output):

- MDN, `attr()`: typed `attr()` is experimental, not Baseline; feature-detect with `@supports (x: attr(x type(*)))`. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/attr
- caniuse, typed `attr()`: Chromium-only since Chrome 133. https://caniuse.com/mdn-css_types_attr
- web.dev, specificity: `[attr=val]` equals a class at 0,1,0. https://web.dev/learn/css/specificity
- Radix Primitives styling: single-valued `data-*` for enums, presence attrs for booleans. https://www.radix-ui.com/primitives/docs/guides/styling
- MDN, `aria-disabled`: `[aria-disabled="true"]` is the one ARIA-driven styling case it endorses. https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled
- OpenUI5 `ToggleButtonRenderer`: emits `aria-pressed` and keeps `sapMToggleBtnPressed`. https://github.com/SAP/openui5/blob/master/src/sap.m/src/sap/m/ToggleButtonRenderer.js
- MDN, `:state()` and `ElementInternals.states`: Baseline 2024, host and custom-element only. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:state
- BEM naming (kebab-only canon). https://getbem.com/naming/ SUIT (camelCase segments). https://github.com/suitcss/suit/blob/master/doc/naming-conventions.md
- Node TypeScript type-stripping (default in Node 24). https://nodejs.org/api/typescript.html
- In-repo precedent: `tools/check-twin-drift.mjs`, the `.gen.d.ts` `generate && git diff --exit-code` gate, and #105's stated preference for a normalized-diff guardrail over extraction.
