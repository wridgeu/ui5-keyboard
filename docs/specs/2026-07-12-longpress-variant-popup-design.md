# Long-press accent/variant popup — design & implementation plan (#162)

**Status:** proposal · **Date:** 2026-07-12 · **Issue:** #162 (German umlauts from any layout)

This plan covers issue #162 task 1 (the `KeyDefinition.variants[]` long-press popup — the
primary fix), folds in task 2 (`ẞ`), and scopes task 3 (docs/demo). It maps the feature onto
the current architecture of **both** twins (`kiosk-keyboard`, `kiosk-keyboard-webc`), names the
one place the architecture must be *enhanced* (a floating overlay — neither control renders one
today), and lists the decisions that change what gets built.

---

## 0. TL;DR

- **Data model:** add optional `variants?: string[]` to `KeyDefinition` in both twins. Purely
  additive; every existing layout keeps working. This is a trivial, natural fit — it sits beside
  `shiftValue`/`shiftLabel` and mirrors the CLDR `longPress` model 1:1.
- **Gesture:** reuse the existing `AutoRepeater` (the #109 backspace hold primitive) as a
  single-shot ~450 ms hold detector, wired through a new per-twin controller that mirrors the
  existing backspace-hold controller. No new timing engine.
- **Insertion:** reuse the existing cursor-aware `insertText()` path unchanged. A chosen variant
  is inserted exactly like a normal character key.
- **The one genuinely new thing** — and the only place that needs architectural *enhancement* —
  is **rendering a floating popup that escapes the keyboard's clipping box.** Neither control
  renders any overlay today, and **both** clip their content (`overflow: hidden` on the kiosk root
  and the webc `:host`; webc additionally traps `position: fixed` via `container-type`). This is
  where the two twins diverge most and where the real work is.
- **`ẞ`** folds into the popup as a variant of `s`/`ß` (no change to the QWERTZ Shift mapping).
- Net verdict: **folds naturally, no rework of the data/insertion/shift model.** The popup overlay
  is net-new UI surface, additive rather than breaking.

---

## 1. What already exists (do not rebuild)

Confirmed against current code:

- `layouts/qwertz-de.ts` (both twins, byte-identical) ships dedicated `ü/Ü ö/Ö ä/Ä` keys and
  `ß → ?` on Shift (correct for physical DE keyboards — **do not change**).
- `de → qwertz-de` in both locale maps (`internal/layout-registry.ts`, `core/layout-registry.ts`);
  German-locale apps auto-select QWERTZ.
- German bundle `messagebundle_de.properties` exists in both twins.
- Grapheme-aware backspace already deletes umlauts correctly.

**The gap:** on the default `qwerty` layout (name `"qwerty"`, from `layouts/default-layout.ts`),
the `a/o/u/s` keys are bare `{ value: "…" }` — no umlaut access, no long-press, and `ẞ` is
unreachable anywhere.

## 2. Architecture fit — the three easy layers

### 2.1 Data model — `KeyDefinition.variants?: string[]` (trivial fit)

`KeyDefinition` is duplicated per twin (`packages/kiosk-keyboard/src/types.ts:111`,
`packages/kiosk-keyboard-webc/src/types.ts:59`). Add the optional field to **both**. Semantics
mirror CLDR `longPress`: an ordered list of alternate glyphs; the key's own `value` stays the tap
default and is **not** included in the list.

```ts
/**
 * Ordered alternate glyphs surfaced in a long-press / right-click popup.
 * The key's own `value` remains the tap default and is not repeated here.
 * When Shift/Caps is active, the popup surfaces the uppercase forms.
 * @example { value: "a", variants: ["ä", "à", "á", "â"] }
 */
variants?: string[];
```

Nothing else in the type system changes. `KeyRow`/`LayoutDefinition` are unaffected. Because this
is additive and optional, the twin-drift guard and all existing layout tests stay green.

### 2.2 Gesture/timing — reuse `AutoRepeater` (clean fit)

`internal/auto-repeat.ts` / `core/auto-repeat.ts` expose an identical generic `AutoRepeater`
(`initialDelayMs: 450`, then an accelerating repeat). For the popup we want **only the first
timer fire** (the hold detection at ~450 ms) and no repeat cadence. Two options: a bare
`setTimeout`, or an `AutoRepeater` whose `_onRepeat` opens the popup and returns `false` (stops
after one tick). Recommend the latter for symmetry with backspace and to inherit the same
cancel/teardown discipline.

The existing hold **wrappers are hardcoded to `{backspace}`** and are not reusable as-is:
- kiosk `internal/backspace-repeat-behavior.ts` — `onPress` early-returns unless
  `keyEl.dataset.key === "{backspace}"`.
- webc `core/backspace-repeat-controller.ts` — same gate in `_start`, plus a `consumeClick(value)`
  one-shot that swallows the release click after a hold.

So each twin gets a **new sibling controller** (`VariantPopupBehavior` / `VariantPopupController`)
that mirrors the backspace one but gates on "*key has variants*" instead of `{backspace}`, and on
hold opens the popup instead of repeating. See §4.3.

> **Timing collision to watch:** Shift double-click uses `DOUBLE_CLICK_MS = 400`, and backspace
> repeat uses `initialDelayMs = 450`. The hold threshold (issue: 400–500 ms) overlaps both. These
> are independent state machines on different keys, so there is no functional conflict, but keep
> the constant explicit and documented (e.g. `VARIANT_HOLD_MS = 450`) rather than reusing another
> subsystem's number by coincidence.

### 2.3 Insertion — reuse `insertText()` (trivial fit)

On commit, call the existing public `insertText(glyph)` → `TargetInputSession.insertText` →
`input-operations.insertText` (kiosk), or `insertText(target, glyph)` via `getActiveTargetElement()`
(webc). This is the exact caret-aware, `liveChange`/`input`-firing path a normal char key uses. No
caret math is hand-rolled. Fire the cancelable `key-press` event first for parity with the char
branch, then `autoRelease()` Shift afterward.

## 3. The crux — a clipping-escaping overlay (what needs *enhancement*)

Neither control renders any transient overlay today; both are flat, renderer/template-driven
trees. Adding a floating popup is the one net-new capability, and the two twins solve it
differently because their rendering models differ. **Both** keyboards clip their own content:

- **kiosk** `.ui5KioskKeyboard { overflow: hidden }` (base LESS `:173`); docked mode is
  `position: fixed; z-index: var(--ui5KioskKeyboard-dockedZIndex, 100)`.
- **webc** `:host { overflow: hidden }` (`KioskKeyboard.css:7`); `.kiosk-keyboard` and `.kiosk-key`
  set `container-type: inline-size`, which establishes a containing block that **traps even
  `position: fixed`** descendants. So a naive fixed popup inside the shadow root is still contained.

A popup for the top rows must render **above** the keyboard and stay on-screen near screen edges,
so it cannot live inside the clipped box.

### 3.1 kiosk overlay strategy

The kiosk control uses `sap.ui.core` rendering and does imperative DOM mutation on the rendered
tree, but renders no overlays and uses **no** `Popup`/`Popover`/static-area today. Two candidate
hosts:

- **(A) UI5 `sap/ui/core/Popup`** anchored to the pressed key's `getBoundingClientRect()`. Idiomatic,
  handles the static-area/z-order/collision, integrates with UI5 focus/escape. Cost: a new
  dependency-of-pattern for this control, and Popup's own focus handling must be reconciled with our
  roving-tabindex listbox.
- **(B) A plain body-level element** (created imperatively, positioned from the key rect,
  torn down in `_clearPressedKeyState`/`exit`). Lighter, fully under our control, no UI5 Popup
  semantics to fight. Cost: we own collision/edge-flip and z-index-above-docked ourselves.

**Recommendation: (B)** — a self-owned, body-level, absolutely-positioned listbox. It keeps the
control's rendering model intact (imperative DOM on top of a renderer tree, which the control
already does for pressed/shift classes), avoids importing Popup focus semantics that fight our
roving-tabindex, and matches the webc approach so the two twins stay conceptually parallel. Escape
handling must `stopPropagation()` so it dismisses only the popup, not the docked keyboard
(`_onDocumentEscapeKeydown`). Announce open/close through the existing `role="status"` live region
(`_announceLiveRegion`).

### 3.2 webc overlay strategy

Reactive JSX in shadow DOM. Add a `@property({ noAttribute: true })` reactive state field
(`_variantPopup = { anchorKeyId, glyphs, activeIndex } | null`) mirroring `_shifted`/`_liveRegionText`;
assigning it schedules the rAF-batched re-render. Render the popup as new JSX. To escape the
`:host { overflow: hidden }` + `container-type` trap, the popup element must **not** be a normal
in-flow descendant of `.kiosk-keyboard`; render it as a direct child of the shadow root (sibling of
the root `div`, inside the fragment) with its own stacking context and a z-index above docked, and
relax/avoid containment on that subtree. Anchor via
`shadowRoot.getElementById(anchorKeyId).getBoundingClientRect()` in `onAfterRendering`. Because it
lives in shadow DOM, styling is exposed via **new `::part`s** (see §4.7) — this is the webc
per-key-styling story the roadmap already flags.

> This is the deepest asymmetry between the twins and the highest-risk part of the estimate.
> Prototype the escape-the-clip behavior in **each** twin first (a static popup that simply shows
> over the number row near a screen edge) before wiring the gesture — de-risk positioning before
> behavior.

## 4. Component-by-component design

### 4.1 Types (both twins)
Add `variants?: string[]` to `KeyDefinition` (§2.1). Regenerate kiosk `KioskKeyboard.gen.d.ts` via
the generator (never hand-edit) — though a property on a plain interface likely produces no
`.gen.d.ts` delta, run `npm run generate` and commit any diff.

### 4.2 Default Latin-diacritic variant table — and how it is enabled *(decided: §8)*
**Decision:** ship a **broad Latin-diacritics table** as a documented, opt-in named export; keep
the built-in `qwerty.ts` pristine. The `variants[]` field is the extensibility primitive; the table
is a batteries-included default that consumers enable explicitly. This keeps non-German kiosks
unsurprising, keeps built-in layout data pristine, is discoverable/documented, and still makes
"accents/umlauts from any layout" a one-liner. German ä/ö/ü/ß are a natural subset.

**The table** — mirror the iOS / Gboard / CLDR `longPress` lists (base char is the tap default and
is **not** repeated; order = most-common first). Ship in both twins (duplicated per #105), keyed by
lowercase base char:

```ts
// e.g. core/latin-variants.ts (webc) / internal/latin-variants.ts (kiosk)
export const LATIN_DIACRITIC_VARIANTS: Readonly<Record<string, readonly string[]>> = {
  a: ["à", "á", "â", "ä", "æ", "ã", "å", "ā"],
  c: ["ç", "ć", "č"],
  e: ["è", "é", "ê", "ë", "ē", "ė", "ę"],
  i: ["î", "ï", "í", "ī", "į", "ì"],
  l: ["ł"],
  n: ["ñ", "ń"],
  o: ["ô", "ö", "ò", "ó", "œ", "ø", "ō", "õ"],
  s: ["ß", "ś", "š", "ẞ"],   // ß + the capital sharp-S ẞ (task 2) live here
  u: ["û", "ü", "ù", "ú", "ū"],
  y: ["ÿ", "ý"],
  z: ["ž", "ź", "ż"],
};
```
(Exact glyph sets to be finalized against CLDR TR35 Part 7 during implementation; the shape is the
contract.)

**How it is enabled — DX:** a boolean-ish control property (working name `accentVariants` /
`long-press-variants`, kiosk setting + webc attribute) that, when on, merges the table onto matching
base keys at render time by matching `key.value` (lowercased) — so it works on **any** Latin layout
(`qwerty`, `qwertz-de`, `qwerty-es`, …) with zero layout edits. Precedence: an **author-supplied
`variants` on a key always wins** over the table; the table only fills keys that declare none. Power
users can also import `LATIN_DIACRITIC_VARIANTS` and spread/trim it into custom layouts directly. The
merge is a pure, unit-tested function (no test-only production exports, §4/§6).

> Because the table now covers many base letters, `data-has-variants` (the pointer-gate marker,
> §4.3) must reflect the **effective** variants after the merge, not just author-declared ones —
> compute it in the same render path that applies the table.

### 4.3 Hold-gesture controller (per twin — mirror the backspace controller)
- **kiosk** `internal/variant-popup-behavior.ts`: `onPress(keyEl, enabled)` gated on
  `keyEl` having variants; arms an `AutoRepeater`/`setTimeout` (~450 ms) whose fire opens the popup;
  `stop()`; `shouldSuppressRelease()` so the lift-off tap does **not** also insert the base glyph.
  Wire in `ontouchstart` (beside `_backspaceRepeat.onPress`, `:1689`), cancel in
  `_clearPressedKeyState` (`:1654`), suppress-release in `ontouchend` (mirror `:1716`).
- **webc** `core/variant-popup-controller.ts`: `attach(signal)` adding `pointerdown` (arm) /
  `pointerup`+`pointercancel`+`pointerleave` (cancel) on the shadow root, gated on variants; reuse the
  `consumeClick(value)` one-shot to swallow the base-char click when a variant was committed.

Where variants live in the DOM: emit a boolean/marker attribute (e.g. `data-has-variants`) on keys
that declare `variants`, so the pointer gate is a cheap `dataset` read (mirroring how `shiftValue`
is surfaced as `data-shift-value`). Register the attribute name in the DOM contract (§4.8).

**Optional within-twin refactor:** backspace-hold and variant-hold now share the
pointerdown→arm→(pointerup/leave/blur)→cancel + suppress-release wiring. That is two consumers — the
CLAUDE.md §2 threshold for *considering* extraction, not yet mandating it. Recommend keeping them
parallel for v1 (the gate + payload genuinely differ) and extracting a `HoldGesture` base **only**
if a third hold gesture appears. Do **not** hoist across twins (#105).

### 4.4 The popup — DOM, ARIA, navigation
Neither twin has a `role="grid"`/`role="listbox"`/`aria-selected` precedent — the key grid is a
roving-tabindex *button group*. The popup should be a real listbox:

- Container `role="listbox"`, options `role="option"` with `aria-selected`, exactly one option
  `tabindex="0"` at a time.
- **Mirror the roving mechanics** from `KeyGridNavigation._transferFocus` (kiosk) /
  `KeyGridNavigation.onKeyDown` (webc): Left/Right (or Up/Down) moves the active option
  (`setAttribute("tabindex","-1")` on old, `"0"` + `.focus()` on new), Enter/Space commits,
  Escape/pointer-leave-out cancels. **Route arrow keys to the popup while it is open** (the grid's
  own nav must yield).
- Accessible names for options: reuse the label resolution (`getKeyAriaLabel` / `_getKeyAriaLabel`)
  or the glyph itself.
- Announce "N variants for {base}" / dismissal via the existing live region.

### 4.5 Shift / uppercase and `ẞ` (task 2 folds in)
When Shift/Caps is active the popup surfaces uppercase forms. Author/table `variants` are lowercase
glyphs; on Shift, uppercase each via `toLocaleUpperCase()`. Across the broad table this is almost
uniformly correct (à→À, ñ→Ñ, ç→Ç, ø→Ø, œ→Œ, æ→Æ …). The one glyph that mis-maps is **`ß`**:
`"ß".toUpperCase() === "SS"`, **not** `ẞ`. Special-case it so `s`/`ß` under Shift surfaces
**`ẞ` (U+1E9E)** — this is exactly task 2, and it lands inside the popup's shift-mapping with a
dedicated unit test (plus a table-wide test asserting every other entry round-trips through
`toLocaleUpperCase` without collapsing/expanding length unexpectedly). Do **not** touch
`qwertz-de.ts`'s `ß → ?` Shift value. The CapsLock-emits-`ẞ` rule stays a documented follow-up.

### 4.6 Insertion + base-tap suppression
On commit: fire cancelable `key-press` → `insertText(glyph)` → `autoRelease()` Shift. On open,
set the suppress-release/consume-click flag so lift-off doesn't also insert the base character. On
cancel (Escape / drift-off / release outside), insert nothing and restore focus to the origin key.

### 4.7 Styling — CSS vars + `::part`s
- **kiosk:** style inside `@layer kiosk-keyboard`; public vars `--ui5KioskKeyboard-variantPopup*`
  and private `--_ui5KioskKeyboard-variantPopup*`; reuse `@sapUi*` tokens (`@sapUiButtonBackground`,
  focus ring `@sapUiContentFocusColor`, `@sapUiContentShadowColor`); add matching
  `forced-colors` / `prefers-reduced-motion` / `.sapUiSizeCompact` / `.sapUiRtl` blocks. z-index
  above `--ui5KioskKeyboard-dockedZIndex`.
- **webc:** public `--kiosk-keyboard-variant-popup-*` on `:host`, private `--_kiosk-keyboard-*`
  aliases on the root; expose new parts `variant-popup` and `variant-option`, added to the frozen
  parts list so `exportParts` forwards them through nested hosts.

### 4.8 DOM-contract additions (both twins)
Add to the frozen `KIOSK_KEYBOARD_DOM` single-source-of-truth (never hard-code strings): the popup
container/option class names, the `data-has-variants` attribute, any new selectors, and (webc) the
two new `part` names. Tests read `KioskKeyboard.DOM`.

## 5. Interaction model *(decision, see §8)*
Two established gestures, different input modalities:
- **Touch:** press-and-hold base key → popup → **drag onto** a variant → **release** to insert
  (phone muscle memory). Requires pointer tracking on the popup (the key's own `ontouchend` fires
  first and clears pressed state, so selection tracking must live on the popup DOM, not the key
  press/release pair).
- **Desktop:** hold (or **right-click**, per the issue) → popup stays open ("sticky") → click an
  option (or arrow+Enter) to insert; Escape/click-away cancels.

**Recommendation:** ship **both** — sticky popup as the base model (works for mouse, touch tap-tap,
and keyboard/AT), plus drag-release as a touch enhancement. Right-click as an explicit desktop
opener. Edge positioning: measure the popup, flip/clamp horizontally and vertically against the
viewport so it never renders off-screen.

## 6. Test strategy (CLAUDE.md §3, §4, §7)
Failing-first, both twins, no test-only production exports (assert through public API / DOM).

- **Pure logic (unit):** variant→uppercase mapping incl. `ß → ẞ`; default table shape; hold-timer
  fire/cancel. kiosk `*.qunit.ts`, webc `*.test.ts` (vitest).
- **Controller:** arm-on-hold / cancel-on-release / suppress-base-tap, gated on variants only.
- **Integration (control-level):** hold a variant key → popup opens with correct glyphs → arrow +
  Enter (and click, and drag-release) inserts the chosen glyph into a real input at the caret →
  base tap still inserts base char → Escape dismisses without inserting → Shift surfaces uppercase
  incl. `ẞ`. kiosk QUnit via the internals-cast pattern; webc `test/component/*.test.ts`.
- **A11y:** listbox roles, roving tabindex, `aria-selected`, live-region announcement, focus
  restoration to origin key.
- **Adversarial (§7):** this adds a new interactive surface and timing — write dated
  `docs/specs/2026-07-…-variant-popup-adversarial-hypotheses.md` and *see each fail* (does the
  suite catch: popup never opens? wrong glyph inserted? base char double-inserted on commit? popup
  renders off-screen/clipped? arrows not routed to popup?).

## 7. Docs + demo (task 3)
- **READMEs (both):** a "Long-press accent variants (incl. German umlauts)" section slots under the
  existing *Layouts* / *Per-Instance Customization* headings — state that `qwertz-de` exists and `de`
  auto-detects it, how to enable the built-in Latin-diacritics table (`accentVariants` +
  `LATIN_DIACRITIC_VARIANTS`), and how to author/override `variants` per key. Answers both "does it
  support German?" and "does it support accents?".
- **Demo:** webc `test/pages/index.html` already has QWERTZ-DE + locale-default panels — add a
  long-press-on-default-layout scenario. UI5 `demo-app` has a `KioskCustomLayouts` view/controller —
  the natural home for a UI5-side variants demo.

## 8. Decisions (locked 2026-07-12)
1. **Default variants: opt-in table, built-in `qwerty` stays pristine** (§4.2). ✅ decided.
2. **Variant breadth: broad Latin-diacritics table shipped now** (§4.2) — not German-only; German
   ä/ö/ü/ß are a subset. ✅ decided (this is the one change from the initial recommendation).
3. **Interaction model: sticky (base) + touch drag-release + desktop right-click** (§5). ✅ decided.
4. **kiosk overlay host: self-owned body-level listbox**, not UI5 `Popup`, to keep the twins parallel
   and avoid Popup focus fights (§3.1). Recommendation — open to revisit.
5. **Delivery: staged** (§9). Recommendation.

## 9. Suggested sequencing
1. **Foundation (low risk):** `variants?: string[]` type in both twins + DOM-contract entries +
   `data-has-variants` emission + regenerate `.gen.d.ts`. Tests: type/render presence.
2. **Overlay spike (de-risk):** static, clip-escaping, edge-safe popup positioned over a key —
   **each twin separately**. Proves §3 before any behavior.
3. **Gesture + insertion:** per-twin hold controller, open on hold, commit via `insertText`,
   suppress base tap. Failing-first controller + integration tests.
4. **A11y + keyboard nav:** listbox roles, roving tabindex, arrow routing, live-region, focus
   restore. A11y tests.
5. **Shift/uppercase + `ẞ`:** shift mapping incl. `ß → ẞ`; table-wide uppercase round-trip test.
6. **Broad Latin table + `accentVariants` enable switch + render-time merge** (§4.2), then
   **docs/demo** (§7).
7. **Adversarial validation pass** (§6) before merge.

## 10. What this "breaks" / long-term
- No breaking API change: `variants` is optional/additive; all existing layouts, tests, and the
  twin-drift guard stay green.
- **Net-new capability, not a rewrite:** the control gains its first floating-overlay pattern. That
  is the lasting architectural addition — once a clip-escaping, edge-safe, a11y-correct popup host
  exists per twin, future features (emoji picker, symbol fly-outs, autocomplete suggestions) can
  reuse it. That upside justifies building the overlay host properly now rather than a one-off.
- Respects #105 (no shared core): logic is duplicated per twin, timing/labels kept in sync by hand,
  no "keep byte-identical" comments.
