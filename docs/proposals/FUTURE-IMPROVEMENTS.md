# Future Improvements

> Status: Deferred

Ideas that are not currently planned but may become relevant as the ecosystem evolves. Each entry links to the original issue for full context.

The deferred CSS `text-box-edge: ideographic-ink` adoption for CJK centering (issue [#52](https://github.com/wridgeu/ui5-keyboard/issues/52)) is tracked under "What Remains" in [CJK-GLYPH-CENTERING.md](./CJK-GLYPH-CENTERING.md).

## Shared Internal Package for Cross-Package Utilities

> [#28](https://github.com/wridgeu/ui5-keyboard/issues/28)

Several source files are duplicated between `kiosk-keyboard` and `kiosk-keyboard-webc` (shift state machine, grapheme utilities, input operations, layout types). A `packages/kiosk-shared` internal package could deduplicate them.

**Why not now:** The duplication is manageable and the two packages have started diverging in subtle ways. Premature extraction risks creating a shared package that satisfies neither consumer well. The cost of syncing changes across two files is lower than the cost of maintaining a shared abstraction boundary. This was formally evaluated and **declined in [#105](https://github.com/wridgeu/ui5-keyboard/issues/105)**. The dominant constraint is that `kiosk-keyboard` ships UI5 AMD resolved by namespace and cannot carry a runtime npm dependency, so any shared core would have to be vendored/inlined into both build pipelines rather than depended upon. Instead of extraction, a `tools/check-twin-drift.mjs` guardrail diffs the parallel leaf files in CI.

**When to revisit:** When a bug fix or feature change needs to be applied identically to both packages more than a few times in a release cycle, the maintenance cost starts outweighing the abstraction cost. Per #105, prefer strengthening the divergence guardrail over extraction.

## Value Property with Two-Way Binding Support

> [#65](https://github.com/wridgeu/ui5-keyboard/issues/65)

The kiosk keyboard currently operates imperatively by editing a target input: a platform edit through `execCommand` while the target is focused, otherwise `setValue()` + `fireEvent("liveChange")`. A `value` property on the keyboard itself could enable standalone/headless usage (PIN entry, search terminals) or a read-only mirror for observing typing activity.

**Why not now:** The current imperative approach is correct for character-level input with cursor management, and it is what keeps `maxlength` and the browser undo stack working. A `value` property is most compelling for headless/standalone mode (Scenario 1 in the issue), which is a distinct usage pattern that needs proper design work.

**When to revisit:** When there is concrete demand for a headless keyboard mode without a visible input control.
