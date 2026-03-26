#!/usr/bin/env node

/**
 * Regression test for the less-openui5 parser patch.
 * Compiles the test LESS file and verifies expected at-rules appear
 * in the output. Run after `npm install` to confirm the patch is applied.
 *
 * Usage: node patches/less-openui5-test.mjs
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const less = require("less-openui5/lib/thirdparty/less/index.js");

const input = readFileSync(join(__dirname, "less-openui5-test.less"), "utf8");

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

const parser = new less.Parser({});

parser.parse(input, (err, tree) => {
  if (err) {
    console.error("PARSE ERROR:", err.message || JSON.stringify(err));
    process.exit(1);
  }

  let css;
  try {
    css = tree.toCSS({});
  } catch (e) {
    console.error("CSS GENERATION ERROR:", e.message);
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
    console.error(`\n${failed} of ${expected.length} checks failed.\n`);
    console.error("Compiled CSS:\n" + css);
    process.exit(1);
  }

  console.log(`\nAll ${expected.length} checks passed.`);
});
