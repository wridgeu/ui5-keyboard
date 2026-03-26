#!/usr/bin/env node

/**
 * Copies patched less-openui5 files to any nested copies in node_modules.
 *
 * patch-package only patches the hoisted node_modules/less-openui5, but
 * @ui5/builder may resolve a nested copy at node_modules/@ui5/cli/node_modules/less-openui5.
 * This script ensures all copies receive the patched files.
 */

import { cpSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hoisted = join(root, "node_modules", "less-openui5");
const nested = join(root, "node_modules", "@ui5", "cli", "node_modules", "less-openui5");

if (!existsSync(hoisted) || !existsSync(nested)) {
  process.exit(0);
}

const files = ["lib/thirdparty/less/parser.js", "lib/thirdparty/less/tree/directive.js"];

let copied = 0;
for (const file of files) {
  const src = join(hoisted, file);
  const dst = join(nested, file);
  if (existsSync(src) && existsSync(dst)) {
    cpSync(src, dst);
    copied++;
  }
}

if (copied > 0) {
  console.log(`less-openui5 patch: synced ${copied} file(s) to nested copy`);
}
