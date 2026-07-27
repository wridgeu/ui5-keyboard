#!/usr/bin/env node

/**
 * Scope check for the built kiosk library stylesheet.
 *
 * A UI5 library stylesheet is loaded page-globally, so every rule it ships is
 * evaluated against the whole host page. Each rule must therefore be scoped to
 * one of the library's own `ui5Kiosk*` classes (see
 * `packages/kiosk-keyboard/src/internal/dom-contract.ts`).
 *
 * The recurring way that scope gets lost is the LESS parent selector inside an
 * at-rule: less-openui5 does not resolve `&` inside an at-rule it does not
 * model, so
 *
 *   .ui5KioskKey { @container (max-inline-size: 1.5rem) { &[data-has-variants]::after { ... } } }
 *
 * compiles to `@container (max-inline-size: 1.5rem){[data-has-variants]::after{...}}`:
 * the `.ui5KioskKey` scope is dropped without a warning and the rule then paints
 * on any host-page element carrying that attribute.
 * `packages/kiosk-keyboard/src/themes/base/KioskKeyboard.less` hoists such blocks
 * to the top level with their full selector spelled out; this check is what
 * catches a block that was nested instead.
 *
 * Runs on the BUILT css (every theme, LTR and RTL) because the bug exists only
 * after compilation: the LESS source reads as correctly nested. Absent build
 * output is a hard failure, never a silent pass.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const themesRoot = path.join(repoRoot, "packages", "kiosk-keyboard", "dist", "resources", "ui5", "kiosk", "themes");

const THEMES = ["base", "sap_horizon", "sap_horizon_dark", "sap_horizon_hcb", "sap_horizon_hcw"];
const STYLESHEETS = ["library.css", "library-RTL.css"];

/**
 * Every class the control renders starts with `ui5Kiosk`, so a selector
 * carrying one is confined to the control's own DOM. Compound and descendant
 * forms (`.sapUiRtl .ui5KioskKey`, `.sapMPopover.ui5KioskVariantPopover
 * .sapMPopoverCont`) are scoped by that one class regardless of where it sits in
 * the selector; which classes exist is the dom-contract check's business, not
 * this one's.
 */
const LIBRARY_CLASS = /\.ui5Kiosk[\w-]/;

/**
 * Selectors the UI5 theme build emits that carry no library class:
 * `sap/ui/core/themes/base/global.less` (imported by every `library.source.less`)
 * contributes the access-key rule, and the build appends the theme-parameter
 * marker keyed by library namespace.
 */
const ALLOWED_UNSCOPED = new Set([".sapUiAccKeysHighlighDom:first-letter", "#sap-ui-theme-ui5\\.kiosk"]);

/**
 * At-rules whose block holds further rules, so their nested selectors are
 * checked. Any other at-rule (`@keyframes`, `@font-face`, `@property`, ...) owns
 * its block contents (keyframe stops, descriptors) and is skipped whole.
 */
const GROUPING_AT_RULES = new Set(["@media", "@supports", "@container", "@layer", "@scope", "@document"]);

const QUOTED = /"[^"]*"|'[^']*'/g;
const NEGATION = /:not\([^()]*\)/g;

/**
 * A library class narrows a selector everywhere except in two positions: inside
 * an attribute value (`[data-x=".ui5KioskKey"]`), where it is data rather than
 * scope, and inside `:not(...)`, where it widens the match instead. `:is()` and
 * `:where()` arguments do carry scope and stay.
 *
 * @param {string} selector one complex selector
 * @returns {boolean} whether it is confined to the library's own DOM
 */
function isScoped(selector) {
  return LIBRARY_CLASS.test(selector.replace(QUOTED, '""').replace(NEGATION, ":not()"));
}

/**
 * Splits a selector list on its top-level commas. Commas inside `:is(...)` /
 * `:not(...)` arguments and inside attribute selectors belong to the enclosing
 * selector; a quoted attribute value can only occur inside brackets, so bracket
 * and paren depth alone keep them together.
 *
 * @param {string} selectorList the `{`-terminated prelude of a rule
 * @returns {string[]} the individual complex selectors
 */
function splitSelectorList(selectorList) {
  const selectors = [];
  let current = "";
  let depth = 0;

  for (const c of selectorList) {
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      selectors.push(current.trim());
      current = "";
      continue;
    }
    current += c;
  }
  selectors.push(current.trim());

  return selectors.filter(Boolean);
}

/**
 * @typedef {{ selector: string; context: string }} Violation
 */

/**
 * Walks the stylesheet and collects every rule whose selector escapes the
 * library's scope. Declaration blocks and opaque at-rule blocks are skipped by
 * brace depth; comments and quoted spans are consumed so a `{`, `}` or `;`
 * inside them cannot desynchronize the walk.
 *
 * @param {string} css built stylesheet text
 * @returns {{ violations: Violation[]; ruleCount: number }}
 */
function scan(css) {
  /** @type {Violation[]} */
  const violations = [];
  /** @type {Array<{ depth: number; name: string }>} */
  const groups = [];
  let ruleCount = 0;
  let prelude = "";
  let depth = 0;
  // Brace depth of the innermost declaration / opaque at-rule block, or -1
  // outside one. Its contents are never selectors.
  let opaqueDepth = -1;
  let i = 0;

  while (i < css.length) {
    const c = css[i] ?? "";
    const next = css[i + 1] ?? "";

    if (c === "/" && next === "*") {
      i += 2;
      while (i < css.length && !(css[i] === "*" && css[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let literal = c;
      i++;
      while (i < css.length && css[i] !== quote) {
        literal += css[i] === "\\" ? (css[i] ?? "") + (css[i + 1] ?? "") : (css[i] ?? "");
        i += css[i] === "\\" ? 2 : 1;
      }
      literal += quote;
      i++;
      if (opaqueDepth < 0) prelude += literal;
      continue;
    }
    if (c === "\\") {
      if (opaqueDepth < 0) prelude += c + next;
      i += 2;
      continue;
    }

    if (c === "{") {
      depth++;
      if (opaqueDepth < 0) {
        const name = prelude.trim().replace(/\s+/g, " ");
        if (name.startsWith("@")) {
          if (GROUPING_AT_RULES.has(name.split(/[\s(]/)[0]?.toLowerCase() ?? "")) groups.push({ depth, name });
          else opaqueDepth = depth;
        } else {
          const context = groups.map((g) => g.name).join(" > ");
          for (const selector of splitSelectorList(name)) {
            ruleCount++;
            if (!isScoped(selector) && !ALLOWED_UNSCOPED.has(selector)) violations.push({ selector, context });
          }
          opaqueDepth = depth;
        }
      }
      prelude = "";
      i++;
      continue;
    }
    if (c === "}") {
      if (opaqueDepth === depth) opaqueDepth = -1;
      else if (groups.at(-1)?.depth === depth) groups.pop();
      depth--;
      prelude = "";
      i++;
      continue;
    }
    if (c === ";") {
      // Statement at-rule (`@import ...;`, `@layer a, b;`) or, inside a block we
      // are not skipping, stray text: neither starts a selector.
      prelude = "";
      i++;
      continue;
    }

    if (opaqueDepth < 0) prelude += c;
    i++;
  }

  return { violations, ruleCount };
}

const files = THEMES.flatMap((theme) => STYLESHEETS.map((name) => path.join(themesRoot, theme, name)));
const missing = files.filter((file) => !existsSync(file));

if (missing.length > 0) {
  console.error(`Built kiosk stylesheet missing (${missing.length}):`);
  for (const file of missing) console.error(`  - ${path.relative(repoRoot, file)}`);
  console.error(
    "\nThis check reads compiled css, so it must run after `npm run build:kiosk`. A build that produced no stylesheet is a failure, not a skip.",
  );
  process.exit(1);
}

console.log(`Checking ${files.length} built kiosk stylesheets for unscoped selectors...`);

let unscoped = 0;
for (const file of files) {
  const { violations, ruleCount } = scan(readFileSync(file, "utf8"));
  if (ruleCount === 0) {
    console.error(
      `No rules found in ${path.relative(repoRoot, file)}. An empty stylesheet passes every scope assertion vacuously; rebuild the package.`,
    );
    process.exit(1);
  }
  if (violations.length === 0) continue;

  unscoped += violations.length;
  console.error(`\nUnscoped selector(s) in ${path.relative(repoRoot, file)}:`);
  for (const { selector, context } of violations) {
    console.error(`  - ${selector}${context ? `   (inside ${context})` : ""}`);
  }
}

if (unscoped > 0) {
  console.error(
    `\n${unscoped} unscoped selector${unscoped === 1 ? "" : "s"}, each matching arbitrary host-page elements. The usual cause is a rule nested under \`&\` inside an at-rule less-openui5 does not model: hoist the block to the top level and spell out the full selector (or, if it is legitimately unscoped, add it to ALLOWED_UNSCOPED in tools/check-css-scope.mjs with a reason).`,
  );
  process.exit(1);
}

console.log("All built rules are scoped to the library's own classes.");
