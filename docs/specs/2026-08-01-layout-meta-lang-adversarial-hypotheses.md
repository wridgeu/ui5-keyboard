# Per-layout metadata and keycap language: adversarial hypotheses

- Date: 2026-08-01
- Issues: #215 (per-layout metadata, option B + the descriptor extension), #213 (WCAG 2.2 SC 3.1.2)
- Suites under test:
  - `packages/kiosk-keyboard/test/qunit/layout-meta.qunit.ts` (new)
  - `packages/kiosk-keyboard-webc/test/unit/layout-meta.test.ts` (new)
  - the keycap-language block in `KioskKeyboard-renderer-blackbox.qunit.ts`
  - the keycap-language block in `kiosk-keyboard-icon-label.test.ts`
  - the popup-language tests in `KioskKeyboard-variants.qunit.ts` and `variant-popup.test.ts`
  - `tools/check-twin-drift.mjs` (`npm run test:twin-drift`), now at 25 pairs
- Method (CLAUDE.md §7): a green suite can lie. Each hypothesis below is a way a green
  run could be a false positive. Cleared only after SEEING the suite go red for it, then
  reverting the perturbation.

## Why these hypotheses

Everything here is an attribute that is _absent_ most of the time: `lang` appears on a
minority of labels, `secondary` on four layouts, `variants: null` on four. A suite that
asserts only presence, or that resolves the wrong node, passes just as happily against an
implementation that emits nothing. Every case below therefore pairs a positive assertion
with a negative control on a layout or key type that must NOT carry the attribute.

## Hypotheses

- **H1 (the kiosk emission is live).** The renderer must actually write the attribute.
  Perturbation: delete the `rm.attr("lang", lang)` block from `renderKeyLabel`
  (`KioskKeyboardRenderer.ts`). **Expected red. Observed:** `KioskKeyboard-renderer-blackbox`
  31/35.
- **H2 (the exclusion is live).** The action tokens and space take their label from i18n
  and must stay in the UI language; a suite that only checks character keys would not
  notice them being tagged. Perturbation: drop the guard so every label gets the
  attribute. **Expected red. Observed:** `KioskKeyboard-renderer-blackbox` 31/35 (the
  negative controls, not the positives).
- **H8 (the exclusion keys on label provenance, not on the visual category).** The first
  implementation excluded `key.type` of `action` / `modifier` / `space`. `type` is
  documented as a visual style category (`types.ts`), so it says nothing about where a
  label came from: ja-kana's dakuten and handakuten keys are typed `modifier` for their
  weight yet carry no i18n label at all, so their keycaps are raw kana that silently lost
  the declaration. The test for it must fail against the old rule, or it is not pinning
  anything. Perturbation: restore the `key.type`-based predicate in the webc template.
  **Expected red. Observed:** 1 failure, "declares the language on a modifier-typed key
  whose keycap is kana". The shipped predicate is
  `parseKeyAction(key.value).kind === "char" && key.value !== " "`.
- **H3 (the per-attribute fallback is live).** `resolveLayoutMeta` merges the built-in
  under the instance entry; a whole-record replacement would silently drop a built-in's
  `lang` whenever a descriptor declared only `secondary`, and would make the bare-rows and
  descriptor entry forms disagree. Perturbation: replace the merge with
  `instanceMeta?.get(name) ?? BUILTIN_LAYOUT_META.get(name)`. **Expected red. Observed:**
  `layout-meta.test.ts` 2 failures - "falls back per attribute to the built-in of the same
  name" and "resolves a bare-rows entry, which declares nothing, as the built-in".
- **H4 (the `ja-romaji` asymmetry is live).** `ja-romaji` declares `variants: null` but no
  `lang`; issue #213 proposed mapping it to `ja`, which would announce Latin keycaps as
  Japanese and pull ASCII into CJK font fallback. This is the entry a plausible
  implementation gets wrong, so a test must pin it. Perturbation: add `lang: "ja"` to the
  `ja-romaji` entry. **Expected red. Observed:** `layout-meta.test.ts` 2 failures, plus
  the `ja-romaji` renderer control.
- **H5 (the webc emission is live).** The twin renders through a JSX template rather than
  a RenderManager, so H1 says nothing about it. Perturbation: delete the `lang={...}`
  attribute from the key label span in `KioskKeyboardTemplate.tsx`. **Expected red.
  Observed:** 4 failures in the component suite (`expected null to equal 'ar'` / `'ja'` /
  `'ko'`).
- **H6 (the drift guard covers the new pair).** A new twin module that no manifest lists
  would be compared by nothing, and `EXPECTED_PAIR_COUNT` only catches the manifest
  shrinking. Perturbation: change `arabic`'s lang to `ar-EG` in the webc copy only.
  **Expected red. Observed:** `Twin drift in 'layout-meta.ts (kiosk internal/ <-> webc core/)'`.
- **H7 (the exit code propagates).** The kiosk QUnit runner prints a non-fatal
  `EADDRINUSE: Port 8082 is already in use` line on some runs, which looks like a failure
  and would mask one if the runner exited 0 regardless. Perturbation: drop `lang: "ar"`
  from the built-in `arabic` entry and run `npm run test:kiosk:qunit`. **Expected
  non-zero. Observed:** exit code 1 with two suites marked failing; a clean run exits 0
  even when the `EADDRINUSE` line is printed, so that line is noise rather than signal.

- **H9 (the declaration is cleared, not blanked, on a layout switch).** Every other test
  mounts one layout per fixture, so none exercises a _reused_ label. Key element ids are
  positional (`core/dom-utils.ts` `keyElementId`), so they are stable across layouts and
  both renderers patch the existing label span rather than replacing it. The test was
  written first and **observed red**: "drops the language from reused labels when
  switching to a UI-language layout". Fixed with a `key` on the label span that varies
  with the resolved language, so the span remounts. This is not a hypothesis about the
  renderers; both mechanisms were read from the pinned sources:

  - **webc.** `@ui5/webcomponents-base` 2.22.0 vendors preact **10.25.1**
    (`src/thirdparty/preact/version.txt`), and `dist/renderer/JsxRenderer.js:1` imports
    `render` from it directly. Its `setProperty` routes a prop to IDL assignment when the
    name is not one of exactly eleven exclusions -- `width`, `height`, `href`, `list`,
    `form`, `tabIndex`, `download`, `rowSpan`, `colSpan`, `role`, `popover` -- **and**
    `name in element`. `lang` is in neither set, so it takes that branch, which assigns
    `n[l] = null != t || r ? t : ""` (`r` = target is a custom element). For a plain
    `<span>` an `undefined` value therefore writes `lang=""`.
  - **The HTML standard.** WHATWG defines that value, not merely as odd:
    "Setting the attribute to the empty string indicates that the primary language is
    unknown", and the language algorithm's second step tests whether the attribute _is
    set_, not whether it is non-empty -- so `lang=""` terminates it there and never
    reaches the parent-element step. Blanking is strictly worse than never marking the
    label, because it also severs inheritance from the document element.
  - **kiosk, immune by construction.** `RenderManager` routes to `sap/ui/core/Patcher.js`
    for any `apiVersion != 1`. `Patcher` does not track what the previous render wrote: it
    snapshots the live attributes on `openStart` (`_getAttributes`), each `attr()` call
    deletes its name from that snapshot, and `openEnd` removes every name still left. The
    kiosk renderer omits the `rm.attr("lang", ...)` call rather than passing `undefined`,
    so removal is automatic and there is no undefined-value path to get wrong. The same
    test passes there unchanged.
  - **No renderer-level escape hatch exists.** `ifDefined` is Lit-only
    (`dist/renderer/LitRenderer.js`); the JSX renderer ships no attribute-vs-property
    directive, and `dist/thirdparty/preact/jsx.d.ts` types `lang?: string | undefined`, so
    TypeScript flags nothing. SAP's own 132 templates pass possibly-`undefined` values to
    `title` throughout without guarding. A varying `key` is the only mechanism inside the
    renderer that yields a genuinely absent attribute.

- **H10 (one bad entry is reported once).** Construction warms the `instanceLayouts`
  caches twice, from `applySettings` and from the setter `super.applySettings` then
  invokes, so a diagnostic emitted inside the normalizer is announced twice. An
  `assert.ok(warn.called)` cannot see that; only a count can. Perturbation: assert
  `callCount` where the code reported from inside the normalizer. **Observed:** 2, against
  1 for the webc twin. Fixed by returning the rejected names and letting the setter own
  the message, with the count asserted in both twins (issue #218).

- **H11 (a reused key's tooltip state matches a freshly mounted one).** `title` sits on the
  key div and hits the same preact IDL-property branch as `lang`, so `title={undefined}`
  wrote `title=""`. The observable defect was not a stale tooltip -- the previous layout's
  text does not survive -- but an inconsistency: a freshly mounted key had no attribute
  while a switched-to key had an empty one. The first attempt at a test asserted the
  absence of the old text and **passed against the bug**, which is the vacuity trap this
  document exists for; it was rewritten to compare a switched key against the same key
  mounted directly. Perturbation: restore `: undefined`. **Observed red:** "a switched-to
  key matches the same key mounted directly: expected '' to equal null".

  Removal is not expressible here. Keying the key div would remount it, and
  `onAfterRendering` performs no focus restoration, so a layout switch would drop DOM
  focus; `popover.opener` also holds a live element reference, and `variant-popup.test.ts`
  asserts node identity across renders. Moving the attribute to the already-keyed label
  span fails because the dual label is reduced to 1x1 px under a narrow container query,
  which would make the tooltip unreachable. The attribute is therefore written on every
  render, and an empty `title` states truthfully that the key carries no advisory
  information -- unlike `lang=""`, which asserted a falsehood.

  **Accepted twin divergence:** kiosk omits the attribute, webc writes it empty. Both state
  the same thing, and mirroring `rm.attr("title", "")` into kiosk would suppress
  inheritance from the control's `tooltip` aggregation to accommodate the other twin's
  renderer. No drift tool covers `title`, so this is recorded here rather than enforced.

## Visual baselines: checked, deliberately not regenerated

Setting `lang` changes browser font fallback, so the 70 committed non-Latin baseline PNGs
(35 per package, across desktop/phone-sm/phone-md/phone-lg/tablet) were the candidate blast
radius. They were **not** pre-emptively regenerated: every label that receives `lang`
already carries `data-glyph-script`, and the stylesheet pins an explicit script font stack
on that attribute (`--ui5KioskKeyboard-cjkFontFamily` and siblings), so the family is
chosen by CSS rather than by the last-resort fallback `lang` influences. The two
multi-character script keycaps that do render in the unpinned stack (英数, かな) are both
`type: "modifier"` and therefore excluded, and `ja-romaji` declares no `lang` at all.

A baseline that _does_ move is therefore real signal that the exclusion rule or the
glyph-script pinning has a hole, and should be investigated rather than accepted.

Residual, deliberately not guarded: kiosk's shifted snapshots run with
`maxDiffPixelRatio: 0.003`, loose enough to swallow a few-key metric change. The DOM-level
`lang` assertions above are the real guard; the pixel suites are corroboration.

## Not covered

- **The popup language on a built-in non-Latin layout is unreachable by construction.**
  All four non-Latin built-ins resolve `variants` to `null`, so no popup ever opens on
  them. The popup-language tests reach it the only way a consumer can: an `instanceLayouts`
  descriptor that declares both `lang` and explicit per-key `variants`. If a future
  built-in ships a non-Latin layout with a variant table, that path becomes reachable
  without a new test.
- **`lang` is not in `KIOSK_KEYBOARD_DOM.attributes`,** so `tools/check-dom-contract-drift.mjs`
  does not compare it across the twins. That is deliberate: it is a native HTML attribute,
  and the renderer emits `role`, `aria-*`, `title` and `tabindex` outside the contract for
  the same reason. Twin parity for it rests on the two suites above, not on the contract tool.
