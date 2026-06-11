#!/usr/bin/env node

/**
 * Regression test for the less-openui5 parser patch.
 * Compiles the test LESS file and verifies expected at-rules appear
 * in the output. Run after `npm install` to confirm the patch is applied.
 *
 * Runs against the hoisted copy (patched by patch-package) and, when present,
 * one nested copy under an `@ui5/cli` install (synced by apply-nested.mjs),
 * so a broken nested sync fails this test instead of failing a theme build.
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
];

/**
 * Finds one nested less-openui5 copy under an `@ui5/cli` install (the root
 * node_modules or any workspace's), mirroring apply-nested.mjs's search.
 *
 * @returns {string | null} absolute path to the nested LESS entry point
 */
function findNestedLess() {
  const nodeModulesDirs = [join(repoRoot, "node_modules")];
  const packagesDir = join(repoRoot, "packages");
  if (existsSync(packagesDir)) {
    for (const pkg of readdirSync(packagesDir)) {
      nodeModulesDirs.push(join(packagesDir, pkg, "node_modules"));
    }
  }
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
      return entry;
    }
  }
  return null;
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

      if (failed > 0) {
        console.error(`\n${failed} of ${expected.length} checks failed for ${label}.\n`);
        console.error("Compiled CSS:\n" + css);
        process.exit(1);
      }

      console.log(`  All ${expected.length} checks passed.\n`);
      resolveDone();
    });
  });
}

await runSuite("hoisted node_modules/less-openui5", nodeRequire("less-openui5/lib/thirdparty/less/index.js"));

const nestedEntry = findNestedLess();
if (nestedEntry) {
  await runSuite(`nested ${relative(repoRoot, nestedEntry)}`, nodeRequire(nestedEntry));
} else {
  console.log("No nested @ui5/cli less-openui5 copy found; skipped the nested check.");
}
