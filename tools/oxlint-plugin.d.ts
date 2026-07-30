/**
 * Shape of an oxlint JS plugin, as loaded through the `jsPlugins` field in
 * `.oxlintrc.json`.
 *
 * `OxlintRule` is oxlint's own `Rule` type, reached through the signature of
 * the `RuleTester` it publishes from `oxlint/plugins-dev`. Oxlint keeps `Rule`,
 * `Context` and the visitor types internal to its bundled declarations, so
 * deriving them from the one exported entry point is what keeps this in step
 * with the installed version instead of drifting from a hand-written copy.
 *
 * Only the plugin container is declared here, because oxlint publishes no type
 * for it. Typing against `eslint` is not an option: this repo does not use
 * ESLint and does not depend on it, and the copy that resolves is a transitive
 * `eslint@7` pulled in by `@ui5/webcomponents-tools`, whose `ESLint.Plugin`
 * predates the v9 rule shape oxlint implements.
 */

import type { RuleTester } from "oxlint/plugins-dev";

/** A single oxlint rule: `meta` plus the visitor factory oxlint calls per file. */
export type OxlintRule = Parameters<RuleTester["run"]>[1];

/** A plugin: its namespace and the rules it contributes to that namespace. */
export interface OxlintPlugin {
  meta: { name: string };
  rules: Record<string, OxlintRule>;
}
