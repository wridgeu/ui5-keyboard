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
| [`customLayouts` Design (#216)](./2026-08-03-issue-216-custom-layouts-design.md)                      | The `CustomLayout` aggregation and slot replacing the four `instance*` maps.                   |
| [`customLayouts` Adversarial Hypotheses](./2026-08-03-custom-layouts-adversarial-hypotheses.md)       | Adversarial validation plan for the `customLayouts` migration, per CLAUDE.md §7.               |
| [`autoCompact` Adversarial Hypotheses](./2026-08-04-autocompact-adversarial-hypotheses.md)            | Adversarial validation of the `autoCompact` width tier, per CLAUDE.md §7.                      |
| [Token-list Attributes (#223, #224)](./2026-08-05-token-list-attributes-design.md)                    | Whitespace after a comma in `controls` and `suppress`, fixed at the type layer.                |
| [Consolidation Audit (#174)](./2026-08-05-issue-174-consolidation-audit.md)                           | Ranked backlog for the repo-wide consolidation pass, and what implementation changed about it. |
