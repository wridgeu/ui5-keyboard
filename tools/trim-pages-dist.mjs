// Trims the self-hosted GitHub Pages demo dist (packages/demo-app/dist) after a
// `ui5 build --all` with the SAPUI5 framework (ui5-pages.yaml). `--all` bundles
// the entire sap.ushell dependency closure (~560 MB); this prunes it down to the
// subset the keyboard launchpad actually loads (~150 MB) using three production
// trims, each scoped to assets the running FLP never requests:
//
//  1. Minified-only: drop *-dbg.js debug duplicates and *.js.map source maps
//     (never requested unless data-sap-ui-debug=true) plus *.less sources
//     (compiled library.css is shipped).
//  2. Single theme: keep sap_horizon (+ the required `base`); drop the unused
//     sap_hcb / sap_horizon_dark / _hcb / _hcw variants.
//  3. Library tree-shaking: keep only the libraries the FLP + demo load at
//     runtime; drop the specialist libraries sap.ushell declares but a keyboard
//     launchpad never loads (3D viewport, charts, rich-text, cards, ...).
//
// Run via `npm run build:pages`. Pinned to SAPUI5 1.149.0; revisit the keep/drop
// lists on a framework bump.

import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const distRoot = fileURLToPath(new URL("../packages/demo-app/dist", import.meta.url));
const resources = join(distRoot, "resources");

if (!existsSync(resources)) {
  console.error(`trim-pages-dist: ${resources} not found - run the Pages build first.`);
  process.exit(1);
}

// Top-level resources/sap/* libraries to keep; every other sap/* dir is dropped.
const KEEP_SAP = new Set(["ui", "m", "ushell", "fe"]);
// Specialist resources/sap/ui/* sublibraries the launchpad never loads.
const DROP_SAP_UI = ["vk", "richtexteditor", "integration", "vbm", "mdc", "commons", "table", "test"];
// Unused theme variants (the demo runs on sap_horizon; `base` is required).
const DROP_THEMES = new Set(["sap_hcb", "sap_horizon_dark", "sap_horizon_hcb", "sap_horizon_hcw"]);

function dirSize(path) {
  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) total += dirSize(full);
    else
      try {
        total += statSync(full).size;
      } catch {
        /* removed concurrently */
      }
  }
  return total;
}

const mb = (bytes) => `${(bytes / 1048576).toFixed(0)} MB`;
const before = dirSize(resources);
let removed = 0;

function drop(path, label) {
  if (!existsSync(path)) return;
  removed += dirSize(path);
  rmSync(path, { recursive: true, force: true });
  console.log(`  drop ${label}`);
}

// 1. Debug duplicates, source maps, and .less sources.
function pruneFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (DROP_THEMES.has(entry.name)) {
        drop(full, `theme ${entry.name}`);
        continue;
      }
      pruneFiles(full);
    } else if (entry.name.endsWith("-dbg.js") || entry.name.endsWith(".js.map") || entry.name.endsWith(".less")) {
      try {
        removed += statSync(full).size;
      } catch {
        /* ignore */
      }
      rmSync(full, { force: true });
    }
  }
}

console.log("trim-pages-dist: pruning self-hosted demo dist...");
pruneFiles(resources);

// 2. Unused top-level sap/* libraries.
const sapDir = join(resources, "sap");
for (const entry of readdirSync(sapDir, { withFileTypes: true })) {
  if (entry.isDirectory() && !KEEP_SAP.has(entry.name)) drop(join(sapDir, entry.name), `sap/${entry.name}`);
}

// 3. Unused sap/ui/* specialist sublibraries.
for (const sub of DROP_SAP_UI) drop(join(sapDir, "ui", sub), `sap/ui/${sub}`);

const after = dirSize(resources);
console.log(`trim-pages-dist: ${mb(before)} -> ${mb(after)} (removed ${mb(removed)})`);
