# Specs

Dated design specifications and adversarial-validation records, kept for context and traceability. Each file is named `YYYY-MM-DD-<topic>.md` and captures the state of a design at the time it was written.

| Spec                                                                                                  | Topic                                                                                          |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Middleware Instance Isolation](./2026-04-08-middleware-instance-isolation.md)                        | Per-control composition middleware overrides without shared module state.                      |
| [Unified `controls` Attribute](./2026-04-08-unified-controls-attribute.md)                            | A single `controls` attribute for targeting input controls.                                    |
| [Unified Registration API](./2026-04-08-unified-registration-api.md)                                  | A shared registration surface across layouts, locales, and middleware.                         |
| [KioskKeyboard Internal Extension Extraction](./2026-04-12-extension-extraction.md)                   | Splitting control logic into internal extension modules.                                       |
| [Playwright / ui5-test-runner Migration](./2026-06-01-playwright-migration-adversarial-hypotheses.md) | Adversarial validation of the Playwright and ui5-test-runner test migration.                   |
| [Extensible Custom Keys](./2026-06-11-extensible-keys-enriched-keypress.md)                           | Custom key tokens via an enriched `keyPress` contract.                                         |
| [Twin-Drift Check](./2026-06-11-twin-drift-check-adversarial-hypotheses.md)                           | Adversarial validation of the twin-drift checker (`tools/check-twin-drift.mjs`).               |
| [Key-Action Model Design](./2026-07-03-keyboard-key-action-model-design.md)                           | A parse-once typed action for buttons, layouts, and special functions.                         |
| [Key-Action Adversarial Hypotheses](./2026-07-03-key-action-adversarial-hypotheses.md)                | Adversarial validation of the behavior-preserving `KeyAction` refactor.                        |
| [Long-Press Variant Popup (#162)](./2026-07-12-longpress-variant-popup-design.md)                     | Design and implementation plan for the accent/variant long-press popup.                        |
| [`data-has-variants` Alignment](./2026-07-13-data-has-variants-alignment.md)                          | Aligning the `data-has-variants` convention across the two twins.                              |
| [Variant Option Sizing (#164)](./2026-07-13-variant-option-sizing-mechanism.md)                       | Sizing each popup option to the parent keyboard's key footprint.                               |
| [Caps Lock emits ẞ (#169)](./2026-07-17-capslock-emits-capital-sharp-s-design.md)                     | Emitting U+1E9E directly from the base ß key under Caps Lock.                                  |
| [ResizeObserver Swap (#180)](./2026-07-20-resize-observer-swap-adversarial-hypotheses.md)             | Adversarial validation of the resize-mechanism replacement.                                    |
| [DOM-Contract Modernization (#173)](./2026-07-21-dom-contract-modernization-design.md)                | The `dom-contract.ts` class/attribute redesign across both twins; partly superseded.           |
| [DOM-Contract Light-DOM Specificity](./2026-07-21-dom-contract-kiosk-lightdom-specificity.md)         | Why the key category reverted to classes on kiosk, then on webc for symmetry.                  |
| [DOM-Contract Drift Guard](./2026-07-21-dom-contract-drift-adversarial-hypotheses.md)                 | Adversarial validation of `tools/check-dom-contract-drift.mjs`.                                |
| [Twin Box Reconciliation (#190)](./2026-07-22-twin-box-reconciliation-adversarial-hypotheses.md)      | Adversarial validation of the reconciled box model across the twins.                           |
| [#206/#205 Fallout](./2026-07-25-206-fallout-adversarial-hypotheses.md)                               | Adversarial review findings from the merged #206/#205 diff, and the one falsified claim.       |
| [Phone Visual Capture (#204)](./2026-07-25-phone-visual-capture-adversarial-hypotheses.md)            | Adversarial validation of the phone-project screenshot-clipping fix.                           |
| [Variant Extensibility (#187)](./2026-07-26-issue-187-variant-extensibility.md)                       | Accent-variant extensibility, the long-press hint, a11y, and target size.                      |
| [Stylesheet and CI-Selection Guards](./2026-07-28-stylesheet-guards-adversarial-hypotheses.md)        | Adversarial validation of the style twin-drift and patch-test guards.                          |
| [Layout Metadata and Keycap Language](./2026-08-01-layout-meta-lang-adversarial-hypotheses.md)        | Adversarial validation of per-layout metadata (#215) and keycap `lang` (#213).                 |
| [Arabic Shaping Probe](./2026-08-03-arabic-shaping-probe-adversarial-hypotheses.md)                   | Adversarial validation of the Arabic keycap shaping guards (#212 fallout).                     |
| [Free-Port Guard](./2026-08-03-port-guard-adversarial-hypotheses.md)                                  | Adversarial validation of `tools/check-port-free.mjs` and its test.                            |
| [`customLayouts` Design (#216)](./2026-08-03-issue-216-custom-layouts-design.md)                      | The `CustomLayout` aggregation and slot replacing the four `instance*` maps.                   |
| [`customLayouts` Adversarial Hypotheses](./2026-08-03-custom-layouts-adversarial-hypotheses.md)       | Adversarial validation plan for the `customLayouts` migration, per CLAUDE.md §7.               |
| [`autoCompact` Adversarial Hypotheses](./2026-08-04-autocompact-adversarial-hypotheses.md)            | Adversarial validation of the `autoCompact` width tier, per CLAUDE.md §7.                      |
| [Token-list Attributes (#223, #224)](./2026-08-05-token-list-attributes-design.md)                    | Whitespace after a comma in `controls` and `suppress`, fixed at the type layer.                |
| [Consolidation Audit (#174)](./2026-08-05-issue-174-consolidation-audit.md)                           | Ranked backlog for the repo-wide consolidation pass, and what implementation changed about it. |
| [Key-Position Adversarial Hypotheses](./2026-08-10-key-position-adversarial-hypotheses.md)            | Adversarial validation of the grid coordinate as persisted focus state, per CLAUDE.md §7.      |
