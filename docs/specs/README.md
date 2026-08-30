# Specs

Dated design specifications and adversarial-validation records. Each file is named `YYYY-MM-DD-<topic>.md` and captures the state of a design at the time it was written.

A spec is kept while something still points at it - CLAUDE.md, a config, a test, or another spec. One that nothing cites has become a changelog for work already shipped, and git history holds it better than this folder does; delete it and its row.

| Spec                                                                                                    | Topic                                                                                       |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Middleware Instance Isolation](./2026-04-08-middleware-instance-isolation.md)                          | Per-control composition middleware overrides without shared module state.                   |
| [Unified `controls` Attribute](./2026-04-08-unified-controls-attribute.md)                              | A single `controls` attribute for targeting input controls.                                 |
| [Extensible Custom Keys](./2026-06-11-extensible-keys-enriched-keypress.md)                             | Custom key tokens via an enriched `keyPress` contract.                                      |
| [Twin-Drift Check](./2026-06-11-twin-drift-check-adversarial-hypotheses.md)                             | Adversarial validation of the twin-drift checker (`tools/check-twin-drift.mjs`).            |
| [Key-Action Model Design](./2026-07-03-keyboard-key-action-model-design.md)                             | A parse-once typed action for buttons, layouts, and special functions.                      |
| [Key-Action Adversarial Hypotheses](./2026-07-03-key-action-adversarial-hypotheses.md)                  | Adversarial validation of the behavior-preserving `KeyAction` refactor.                     |
| [Long-Press Variant Popup (#162)](./2026-07-12-longpress-variant-popup-design.md)                       | Design and implementation plan for the accent/variant long-press popup.                     |
| [DOM-Contract Modernization (#173)](./2026-07-21-dom-contract-modernization-design.md)                  | The `dom-contract.ts` class/attribute redesign across both twins; partly superseded.        |
| [DOM-Contract Light-DOM Specificity](./2026-07-21-dom-contract-kiosk-lightdom-specificity.md)           | Why the key category reverted to classes on kiosk, then on webc for symmetry.               |
| [DOM-Contract Drift Guard](./2026-07-21-dom-contract-drift-adversarial-hypotheses.md)                   | Adversarial validation of `tools/check-dom-contract-drift.mjs`.                             |
| [Variant Extensibility (#187)](./2026-07-26-issue-187-variant-extensibility.md)                         | Accent-variant extensibility, the long-press hint, a11y, and target size.                   |
| [Stylesheet and CI-Selection Guards](./2026-07-28-stylesheet-guards-adversarial-hypotheses.md)          | Adversarial validation of the style twin-drift and patch-test guards.                       |
| [Layout Metadata and Keycap Language](./2026-08-01-layout-meta-lang-adversarial-hypotheses.md)          | Adversarial validation of per-layout metadata (#215) and keycap `lang` (#213).              |
| [`customLayouts` Design (#216)](./2026-08-03-issue-216-custom-layouts-design.md)                        | The `CustomLayout` aggregation and slot replacing the four `instance*` maps.                |
| [`customLayouts` Adversarial Hypotheses](./2026-08-03-custom-layouts-adversarial-hypotheses.md)         | Adversarial validation plan for the `customLayouts` migration, per CLAUDE.md §7.            |
| [`autoCompact` Adversarial Hypotheses](./2026-08-04-autocompact-adversarial-hypotheses.md)              | Adversarial validation of the `autoCompact` width tier, per CLAUDE.md §7.                   |
| [Token-list Attributes (#223, #224)](./2026-08-05-token-list-attributes-design.md)                      | Whitespace after a comma in `controls` and `suppress`, fixed at the type layer.             |
| [Native Text Insertion (#230)](./2026-08-11-native-text-insertion-design.md)                            | Inserting through `execCommand` so `maxlength` and the browser undo stack survive.          |
| [Native Insertion Adversarial Hypotheses](./2026-08-11-native-text-insertion-adversarial-hypotheses.md) | Adversarial validation of the native-insertion suites, per CLAUDE.md §7.                    |
| [Live-Region Exposure (#247, #254)](./2026-08-26-live-region-exposure-adversarial-hypotheses.md)        | Adversarial validation of the ARIA live-region exposure fix and the variant-count rephrase. |
