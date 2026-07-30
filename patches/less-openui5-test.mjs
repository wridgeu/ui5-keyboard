#!/usr/bin/env node

/**
 * Regression test for the less-openui5 parser patch.
 * Compiles the test LESS file and verifies expected at-rules appear
 * in the output. Run after `npm install` to confirm the patch is applied.
 *
 * Runs against the hoisted copy (patched by patch-package) and every nested
 * copy under an `@ui5/cli` install (synced by apply-nested.mjs), so a broken
 * nested sync fails this test instead of failing a theme build.
 *
 * Usage: node patches/less-openui5-test.mjs
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const nodeRequire = createRequire(import.meta.url);

const input = readFileSync(join(import.meta.dirname, "less-openui5-test.less"), "utf8");

const expected = [
  "@supports (display: flex) and (color: red) {",
  "@keyframes fadeIn {",
  "@font-face {",
  "@container sidebar (min-width: 700px) {",
  "@container keyboard (max-width: 30rem) {",
  "@layer reset, base, utilities;",
  "@layer reset {",
  "@layer {",
  "@layer theme.dark {",
  "@media (max-width: 600px) {",
  "@supports (display: grid) {",
  ".parent .child {",
  "@layer ordering-a, ordering-b;",
  // The rule after an ordering statement. Without the `;`-terminated identifier
  // regex the directive name swallows it and the declaration is silently
  // dropped, which no other assertion here distinguishes from correct output.
  ".after-ordering {",
];

/**
 * The parent selector a conditional group rule must carry through, and how many
 * of the fixture's nested at-rules must reproduce it (@container, @supports,
 * @layer, @media). A rule that loses this prefix compiles to a page-global
 * selector, so the count has to be exact rather than "at least one".
 */
const SCOPED_SELECTOR = ".scoped .nested[data-flag]::after {";
const SCOPED_OCCURRENCES = 4;
/** The same rule with its scope dropped, at the start of a line. */
const UNSCOPED_SELECTOR = /^\s*\[data-flag\]::after\s*\{/m;

/**
 * Finds every nested less-openui5 copy under an `@ui5/cli` install (the root
 * node_modules or any workspace's), mirroring apply-nested.mjs's search so the
 * suite covers each copy apply-nested.mjs syncs.
 *
 * @returns {string[]} absolute paths to the nested LESS entry points
 */
function findNestedLessEntries() {
  const nodeModulesDirs = [join(repoRoot, "node_modules")];
  const packagesDir = join(repoRoot, "packages");
  if (existsSync(packagesDir)) {
    for (const pkg of readdirSync(packagesDir)) {
      nodeModulesDirs.push(join(packagesDir, pkg, "node_modules"));
    }
  }
  const entries = [];
  for (const nodeModules of nodeModulesDirs) {
    const entry = join(
      nodeModules,
      "@ui5",
      "cli",
      "node_modules",
      "less-openui5",
      "lib",
      "thirdparty",
      "less",
      "index.js",
    );
    if (existsSync(entry)) {
      entries.push(entry);
    }
  }
  return entries;
}

/**
 * Parses the fixture with the given LESS module and checks the output.
 *
 * @param {string} label which copy is under test (for the report)
 * @param {{ Parser: new (options: object) => { parse: Function } }} less the vendored LESS module
 * @returns {Promise<void>} resolves when all checks pass; exits the process otherwise
 */
function runSuite(label, less) {
  console.log(`Checking ${label}:`);
  return new Promise((resolveDone) => {
    const parser = new less.Parser({});
    parser.parse(input, (err, tree) => {
      if (err) {
        console.error(`PARSE ERROR (${label}):`, err.message || JSON.stringify(err));
        process.exit(1);
      }

      let css;
      try {
        css = tree.toCSS({});
      } catch (e) {
        console.error(`CSS GENERATION ERROR (${label}):`, e instanceof Error ? e.message : String(e));
        process.exit(1);
      }

      let failed = 0;
      for (const needle of expected) {
        if (css.includes(needle)) {
          console.log(`  PASS  ${needle}`);
        } else {
          console.error(`  FAIL  ${needle}`);
          failed++;
        }
      }

      const scopedCount = css.split(SCOPED_SELECTOR).length - 1;
      if (scopedCount === SCOPED_OCCURRENCES) {
        console.log(`  PASS  ${SCOPED_SELECTOR} x${SCOPED_OCCURRENCES}`);
      } else {
        console.error(`  FAIL  ${SCOPED_SELECTOR} x${SCOPED_OCCURRENCES} (found ${scopedCount})`);
        failed++;
      }

      if (UNSCOPED_SELECTOR.test(css)) {
        console.error(`  FAIL  a nested rule reached the top level unscoped`);
        failed++;
      } else {
        console.log(`  PASS  no nested rule reached the top level unscoped`);
      }

      if (failed > 0) {
        console.error(`\n${failed} check(s) failed for ${label}.\n`);
        console.error("Compiled CSS:\n" + css);
        process.exit(1);
      }

      console.log(`  All ${expected.length + 2} checks passed.\n`);
      resolveDone();
    });
  });
}

await runSuite("hoisted node_modules/less-openui5", nodeRequire("less-openui5/lib/thirdparty/less/index.js"));

const nestedEntries = findNestedLessEntries();
if (nestedEntries.length > 0) {
  for (const nestedEntry of nestedEntries) {
    await runSuite(`nested ${relative(repoRoot, nestedEntry)}`, nodeRequire(nestedEntry));
  }
} else {
  console.log("No nested @ui5/cli less-openui5 copy found; skipped the nested check.");
}
