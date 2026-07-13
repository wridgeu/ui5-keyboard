# Aligning the `data-has-variants` twin convention

**Date:** 2026-07-13

## Problem

The `data-has-variants` marker attribute gates the accent-variant popup: the renderer
stamps it on any key whose effective `variants` list is non-empty, and the pointer
handlers read it to decide whether a long-press / right-click should arm or open the
popup. The attribute **name** is already shared per package through `dom-contract.ts`
(`attributes.hasVariants = "data-has-variants"`), and the two entries are meant to stay
parallel.

The **value written** and the **read style** diverge between the twins. Both are
correct; they are just stylistically inconsistent, which is exactly the kind of drift
the twin pairs are supposed to avoid.

| Concern      | kiosk (`packages/kiosk-keyboard`)                                                             | webc (`packages/kiosk-keyboard-webc`)                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| WRITE        | `KioskKeyboardRenderer.ts:255` — `rm.attr(KIOSK_KEYBOARD_DOM.attributes.hasVariants, "true")` | `KioskKeyboardTemplate.tsx:95` — `data-has-variants={... ? "" : undefined}` (presence-only, empty value)                  |
| READ 1       | `internal/variant-popup-behavior.ts:162` (`onPress`) — `keyEl.dataset.hasVariants !== "true"` | `core/variant-popup-controller.ts:333` (`_variantKey`) — `!keyEl.hasAttribute(KIOSK_KEYBOARD_DOM.attributes.hasVariants)` |
| READ 2       | `internal/variant-popup-behavior.ts:173` (`openFor`) — `keyEl.dataset.hasVariants !== "true"` | (single read site)                                                                                                        |
| READ 3       | `KioskKeyboard.ts:1851` (`oncontextmenu`) — `el.dataset.hasVariants !== "true"`               |                                                                                                                           |
| dom-contract | `src/internal/dom-contract.ts:48` — `hasVariants` (no doc comment)                            | `src/core/dom-contract.ts:64-65` — `hasVariants` (documented)                                                             |

So kiosk writes the sentinel string `"true"` and reads it with the `dataset` camelCase
mapping compared against `!== "true"`; webc writes a bare presence attribute and reads
it with `hasAttribute()`. The DOM-value semantics differ (`data-has-variants="true"` vs
`data-has-variants=""`), the accessor differs (`HTMLElement.dataset` vs `hasAttribute`),
and even the dom-contract entries differ (one documented, one not).

## Constraints (from CLAUDE.md and the task)

- **No shared-core package across the twins.** A shared runtime reader/writer helper is
  not an option; it would itself have to be duplicated. The twins render via different
  mechanisms (UI5 `RenderManager.attr` vs JSX), so a shared **writer** is infeasible.
  Any alignment is a per-package convention change, not an extraction.
- **The variant-popup files are the deliberately-not-byte-identical twin pairs.** The
  `dom-contract.ts` entries, by contrast, are supposed to stay parallel.
- **DOM read semantics:** `dataset.hasVariants` returns `""` (falsy) for an empty
  attribute and `undefined` when absent; `hasAttribute()` is render-mechanism-agnostic
  and behaves identically in both DOM environments.
- **Tests may assert on the attribute; a change must update tests in both packages** (or
  confirm the target package's suite already asserts the chosen convention).

## Options considered

### (i) Presence convention — align kiosk to webc _(chosen)_

Treat `data-has-variants` as an idiomatic HTML boolean/marker attribute (like
`disabled` / `hidden`): write it present-with-empty-value and read it with
`hasAttribute()`. webc already does exactly this, so kiosk moves: the renderer writes
`""` instead of `"true"`, and all three kiosk read sites switch to
`!el.hasAttribute(KIOSK_KEYBOARD_DOM.attributes.hasVariants)`. webc source and tests are
already at the target and do not change.

- **Pros:** idiomatic (presence encodes truth, no sentinel string to keep in sync); the
  read call becomes byte-identical across the twin variant-popup files while each still
  routes through its own dom-contract constant, so the parallel-not-shared invariant
  holds; `hasAttribute()` is render-mechanism-agnostic, so the kiosk RenderManager
  output and the webc JSX output are read by structurally identical code; the read
  `!el.hasAttribute(...)` cannot silently misfire the way `!== "true"` would if the
  written value ever changed; the whole diff lands in one package (kiosk), shrinking the
  twin-drift review surface; fully covered by existing tests.
- **Cons:** kiosk moves off the terse `dataset.hasVariants` auto-mapping to the slightly
  more verbose `hasAttribute(KIOSK_KEYBOARD_DOM.attributes.hasVariants)` (but that
  removes the implicit `data-*`→camelCase coupling and gives one source of truth for the
  name); the renderer comment at `L252-253` ("a cheap dataset read") goes stale and
  **must** be updated in the same edit (CLAUDE.md forbids stale comments); the negative
  test assertions must flip from `undefined` to `false` (`hasAttribute` never returns
  `undefined`).

### (ii) Explicit-value convention — align webc to kiosk _(rejected)_

Make the marker always carry `"true"` and compare against `"true"`: the webc template
emits `"true"` (not `""`) and the controller reads `getAttribute(...) === "true"`;
kiosk is unchanged.

- **Pros:** self-documenting DOM (`data-has-variants="true"` reads unambiguously in
  devtools/snapshots); future-proof if the marker ever gains a second sentinel value.
- **Cons (why rejected):** it does **not** unify the read — kiosk keeps `dataset`, webc
  moves to `getAttribute()`; only the compared string is aligned, not the accessor, so
  the reads stay stylistically different (fails priority _b_, identical render-agnostic
  reads). It moves webc away from the idiomatic boolean-attribute pattern toward a value
  check coupled to the writer's exact string. And it carries a silent-pass hazard
  (CLAUDE.md §7): after only the template value changes `""`→`"true"`, the existing webc
  `hasAttribute()` tests and the old `hasAttribute()` read both still pass, so nothing
  forces the read/test migration to actually happen.

### (iii) A reader/writer abstraction — rejected as gold-plating

Wrapping the check in an `isVariantKey(el)` reader (or a writer helper) is speculative
abstraction for a single boolean marker (CLAUDE.md §2), and a _shared_ helper is barred
outright by the no-shared-core rule and the RenderManager-vs-JSX writer asymmetry. This
"third option" otherwise collapses into (i): the materially-correct alignment is the
idiomatic presence + `hasAttribute()` convention. Its one worthwhile, genuinely-cheap
idea — giving kiosk's dom-contract entry the same doc comment webc already ships, so the
two entries reach documentation parity — is folded into the chosen plan below.

## Decision

Adopt **(i), the presence convention**, aligning kiosk to webc.

Rationale, against the stated priorities:

1. **Idiomatic correctness.** Present-or-absent read with `hasAttribute()` is the
   web-standard form for marker attributes (`disabled`, `hidden`, `checked`). The
   `"true"` sentinel is the non-idiomatic one that invites the classic
   `data-x="false"` is-still-truthy bug.
2. **Render-mechanism-agnostic, identical reads.** `hasAttribute()` behaves identically
   over the kiosk RenderManager output and the webc JSX output, and the read expression
   becomes byte-identical across the twin variant-popup files
   (`!keyEl.hasAttribute(DOM.attributes.hasVariants)`), each still routed through its own
   package's dom-contract constant. Option (ii) leaves the accessors different.
3. **Fewest moving parts / no new abstraction.** No helper, no new file, no new import
   edge; the writer stays per-twin as it must. webc — the busier package here — needs no
   source or test churn.
4. **Minimal, low-risk change.** The whole diff is confined to kiosk (4 src edits, one
   of them the mandatory stale-comment fix, plus one optional dom-contract doc-comment
   for parity, and 3 test edits). No CSS selector keys on the attribute value (grep of
   `*.css`/`*.less`/`*.scss` under `packages/` found zero `has-variants` selectors), so
   the `"true"`→`""` value change cannot break styling. Both kiosk read-site source files
   already import `KIOSK_KEYBOARD_DOM`, and the kiosk qunit test already binds
   `DOM = KioskKeyboard.DOM`, so there are no new import edges.

`RenderManager.attr(name, "")` emits the bare attribute `data-has-variants=""` (the
empty-value branch is not skipped), so `hasAttribute()` returns `true` — exactly
matching webc's `data-has-variants=""` output.

## Implementation plan

### kiosk source (`packages/kiosk-keyboard/src`)

1. **`KioskKeyboardRenderer.ts:255`** — change the written value:

   ```ts
   // before
   rm.attr(KIOSK_KEYBOARD_DOM.attributes.hasVariants, "true");
   // after
   rm.attr(KIOSK_KEYBOARD_DOM.attributes.hasVariants, "");
   ```

2. **`KioskKeyboardRenderer.ts:252-253`** — update the now-stale comment so it describes
   the current read mechanism (mandatory; CLAUDE.md: comments state the current
   contract):

   ```ts
   // before
   // Marker for the long-press / right-click accent-variant gate: a cheap
   // dataset read lets the pointer handlers skip keys with no variants.
   // after
   // Marker for the long-press / right-click accent-variant gate: a cheap
   // hasAttribute() presence check lets the pointer handlers skip keys with no variants.
   ```

3. **`internal/variant-popup-behavior.ts:162`** (`onPress`) — presence read:

   ```ts
   // before
   if (keyEl.dataset.hasVariants !== "true") return;
   // after
   if (!keyEl.hasAttribute(KIOSK_KEYBOARD_DOM.attributes.hasVariants)) return;
   ```

   `KIOSK_KEYBOARD_DOM` is already imported at `L7` (`import { KIOSK_KEYBOARD_DOM } from "./dom-contract";`).

4. **`internal/variant-popup-behavior.ts:173`** (`openFor`) — same change:

   ```ts
   // before
   if (keyEl.dataset.hasVariants !== "true") return;
   // after
   if (!keyEl.hasAttribute(KIOSK_KEYBOARD_DOM.attributes.hasVariants)) return;
   ```

5. **`KioskKeyboard.ts:1851`** (`oncontextmenu`) — presence read, retaining the compound
   `!el ||` guard:

   ```ts
   // before
   if (!el || el.dataset.hasVariants !== "true") return;
   // after
   if (!el || !el.hasAttribute(KIOSK_KEYBOARD_DOM.attributes.hasVariants)) return;
   ```

   `KIOSK_KEYBOARD_DOM` is already imported at `L13` (`import { KIOSK_KEYBOARD_DOM } from "./internal/dom-contract";`).

6. **`internal/dom-contract.ts:47-48`** — add the doc comment webc already ships, for
   dom-contract parity between the twins:
   ```ts
   // before
   rowKind: "data-row-kind",
   hasVariants: "data-has-variants",
   // after
   rowKind: "data-row-kind",
   /** Marks a key whose effective `variants` list is non-empty (the long-press gate). */
   hasVariants: "data-has-variants",
   ```
   Mirrors `packages/kiosk-keyboard-webc/src/core/dom-contract.ts:64`.

### kiosk tests (`packages/kiosk-keyboard/test/qunit/KioskKeyboard-variants.qunit.ts`)

`DOM` is already bound at `L18` (`const DOM = KioskKeyboard.DOM;`); no import churn. The
test titles at `L105` / `L114` mention `data-has-variants` descriptively and stay
accurate (the name is unchanged).

7. **`L109`** — positive assertion, value→presence:

   ```ts
   // before
   assert.strictEqual(aKey.dataset.hasVariants, "true", "'a' has variants (ä/à/...)");
   // after
   assert.strictEqual(aKey.hasAttribute(DOM.attributes.hasVariants), true, "'a' has variants (ä/à/...)");
   ```

8. **`L110`** — negative assertion, `undefined`→`false`:

   ```ts
   // before
   assert.strictEqual(bKey.dataset.hasVariants, undefined, "'b' has no default variants");
   // after
   assert.strictEqual(bKey.hasAttribute(DOM.attributes.hasVariants), false, "'b' has no default variants");
   ```

9. **`L119`** — off-by-default assertion, `undefined`→`false`:
   ```ts
   // before
   assert.strictEqual(getRequiredKeyElement(kb, "a").dataset.hasVariants, undefined, "off by default");
   // after
   assert.strictEqual(getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants), false, "off by default");
   ```

These three flipped assertions mirror the webc reference at
`packages/kiosk-keyboard-webc/test/component/variant-popup.test.ts:80-82`
(`hasAttribute(DOM.attributes.hasVariants)` → `true` / `false`). The long-press and
right-click behavior tests in the same file exercise the changed read path implicitly
and need no edits.

### webc — no changes

webc source and tests are already the target convention: the template emits `""`
(`KioskKeyboardTemplate.tsx:95`), the controller reads `hasAttribute`
(`core/variant-popup-controller.ts:333`), the dom-contract entry is documented
(`core/dom-contract.ts:64-65`), and the component tests already assert via
`hasAttribute(DOM.attributes.hasVariants)` at `L80-82`, `L372-374`, and `L383`. They stay
green and become the reference the kiosk tests are aligned to. The "update tests in both
packages" requirement is satisfied because webc is already at the target.

## Verification

Run from the repo root; all must pass:

- **Typecheck both twins (src + test):** `npm run typecheck` — in particular
  `typecheck:kiosk`, `typecheck:kiosk:test`, `typecheck:kiosk-webc`,
  `typecheck:kiosk-webc:test`. Catches any leftover `dataset.hasVariants` reference and
  the `strictEqual` boolean/`undefined` type flip in the kiosk test.
- **Twin-drift check:** `npm run test:twin-drift` (`tools/check-twin-drift.mjs`) — must
  stay green; the change reduces drift and does not touch the excluded god-class files.
- **kiosk variant suite:** `npm run test:kiosk:qunit` — the three flipped assertions plus
  the long-press / right-click behavior tests exercise the new presence write and read.
- **webc variant suite:** `npm run test:kiosk-webc:component` — must stay green unchanged,
  confirming the target convention the kiosk side now matches.
- **Lint:** `npm run lint`.

Adversarial note (CLAUDE.md §7): the presence write is genuinely load-bearing here, so
the kiosk positive assertion (`L109`, expects `true`) would go red if the renderer failed
to emit the attribute, and the negatives (`L110`/`L119`, expect `false`) would go red if
the attribute were emitted for a variant-less key. Confirm the kiosk suite actually
executes these three assertions (non-zero test count) rather than passing vacuously.
