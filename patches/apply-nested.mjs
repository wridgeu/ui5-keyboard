#!/usr/bin/env node

/**
 * Copies the patched less-openui5 files to every nested copy in the monorepo.
 *
 * patch-package only patches the hoisted node_modules/less-openui5, but
 * @ui5/cli bundles its own nested copy (used by `ui5 build` for theme LESS).
 * Depending on hoisting that copy can live under the root node_modules or under
 * any workspace's node_modules, so we sync the patched files into all of them.
 */

import { cpSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

// The hoisted copy is the one patch-package patches: treat it as the source.
const source = join(root, "node_modules", "less-openui5");
if (!existsSync(source)) {
  process.exit(0);
}

/**
 * @param {string} dir package directory
 * @returns {string | undefined} the package's version, if readable
 */
/**
 * The version of the LESS fork vendored under `lib/thirdparty/less`, which is
 * what the patch actually rewrites. less-openui5 has carried the same fork
 * across its own releases, so this stays stable where its package version does
 * not: gating on the package version skips a nested copy whose vendored parser
 * is byte-identical, leaving the theme build unpatched.
 */
function readVendoredLessVersion(dir) {
  try {
    const index = readFileSync(join(dir, "lib/thirdparty/less/index.js"), "utf8");
    return /version:\s*\[([^\]]+)\]/.exec(index)?.[1]?.replaceAll(/\s/g, "");
  } catch {
    return undefined;
  }
}

const sourceVersion = readVendoredLessVersion(source);

// Exactly the files the less-openui5 patch modifies.
const patchedFiles = ["lib/thirdparty/less/parser.js", "lib/thirdparty/less/tree/directive.js"];

// Every node_modules tree in the workspace: the root plus each package. @ui5/cli
// nests its less-openui5 under whichever of these it was installed into.
const nodeModulesDirs = [join(root, "node_modules")];
const packagesDir = join(root, "packages");
if (existsSync(packagesDir)) {
  for (const pkg of readdirSync(packagesDir)) {
    nodeModulesDirs.push(join(packagesDir, pkg, "node_modules"));
  }
}

let synced = 0;
for (const nodeModules of nodeModulesDirs) {
  const target = join(nodeModules, "@ui5", "cli", "node_modules", "less-openui5");
  if (!existsSync(target)) {
    continue;
  }
  // Overwriting a different LESS fork with the hoisted version's patched files
  // could mix incompatible parser internals: skip and warn so the mismatch gets
  // resolved (rebase the patch or align the versions).
  const targetVersion = readVendoredLessVersion(target);
  if (targetVersion !== sourceVersion) {
    console.warn(
      `less-openui5 patch: skipped ${target} (vendored LESS ${targetVersion ?? "unknown"} differs from hoisted ${sourceVersion ?? "unknown"}); align the versions or rebase the patch.`,
    );
    continue;
  }
  let copiedAny = false;
  for (const file of patchedFiles) {
    const src = join(source, file);
    const dst = join(target, file);
    if (existsSync(src) && existsSync(dst)) {
      cpSync(src, dst);
      copiedAny = true;
    }
  }
  if (copiedAny) {
    synced++;
  }
}

if (synced > 0) {
  console.log(`less-openui5 patch: synced ${synced} nested cop${synced === 1 ? "y" : "ies"}`);
}
