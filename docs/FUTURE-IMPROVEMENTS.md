# Future Improvements

Ideas that are not currently planned but may become relevant as the ecosystem evolves. Each entry links to the original issue for full context.

## CSS `text-box-edge: ideographic-ink` for CJK Centering

> [#52](https://github.com/wridgeu/ui5-keyboard/issues/52)

The CSS Inline Layout Module Level 3 spec defines `text-box-edge: ideographic-ink`, which trims to the actual ink bounds of CJK characters. This would improve vertical centering of CJK glyph labels on kiosk keyboard keys.

**Why not now:** No browser ships this value yet. The spec has open questions around which font in the cascade provides ideographic metrics and how to synthesize ideographic-over/under baselines.

**When to revisit:** When Chromium or WebKit ships `ideographic-ink` behind a flag. At that point, a `@supports` guard can be added to both `kiosk-keyboard` (Less) and `kiosk-keyboard-webc` (CSS). Existing visual baselines should be re-verified before adoption.

**Tracking:** [Chromium #365423076](https://issues.chromium.org/issues/365423076), [csswg-drafts #10928](https://github.com/w3c/csswg-drafts/issues/10928), [csswg-drafts #10850](https://github.com/w3c/csswg-drafts/issues/10850).

## Shared Internal Package for Cross-Package Utilities

> [#28](https://github.com/wridgeu/ui5-keyboard/issues/28)

Several source files are duplicated between `kiosk-keyboard` and `kiosk-keyboard-webc` (shift state machine, grapheme utilities, input operations, layout types). A `packages/kiosk-shared` internal package could deduplicate them.

**Why not now:** The duplication is manageable and the two packages have started diverging in subtle ways. Premature extraction risks creating a shared package that satisfies neither consumer well. The cost of syncing changes across two files is lower than the cost of maintaining a shared abstraction boundary.

**When to revisit:** When a bug fix or feature change needs to be applied identically to both packages more than a few times in a release cycle, the maintenance cost starts outweighing the abstraction cost.

## Value Property with Two-Way Binding Support

> [#65](https://github.com/wridgeu/ui5-keyboard/issues/65)

The kiosk keyboard currently operates imperatively by reaching into a target input via `setValue()` + `fireEvent("liveChange")`. A `value` property on the keyboard itself could enable standalone/headless usage (PIN entry, search terminals) or a read-only mirror for observing typing activity.

**Why not now:** The current imperative approach is correct for character-level input with cursor management. A `value` property is most compelling for headless/standalone mode (Scenario 1 in the issue), which is a distinct usage pattern that needs proper design work.

**When to revisit:** When there is concrete demand for a headless keyboard mode without a visible input control.
