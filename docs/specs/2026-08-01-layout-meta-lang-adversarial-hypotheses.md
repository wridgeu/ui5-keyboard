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
