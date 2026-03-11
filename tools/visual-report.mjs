#!/usr/bin/env node

/**
 * Generates an HTML visual-regression report via @wdio/visual-reporter
 * and serves it locally.
 *
 * The visual service already produces an output.json when
 * `createJsonReportFiles: true` is set in the wdio config.
 * This script finds all output.json files (including per-device subfolders)
 * and feeds them into the reporter CLI.
 *
 * Usage:
 *   node tools/visual-report.mjs <screenshotDir>
 *
 * Example:
 *   node tools/visual-report.mjs packages/kiosk-keyboard/test/e2e/__screenshots__
 */

import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";

const screenshotDir = process.argv[2];
if (!screenshotDir) {
  console.error("Usage: node tools/visual-report.mjs <screenshotDir>");
  console.error("  e.g. node tools/visual-report.mjs packages/kiosk-keyboard/test/e2e/__screenshots__");
  process.exit(1);
}

const absDir = resolve(screenshotDir);
if (!existsSync(absDir)) {
  console.error(`Screenshot directory not found: ${absDir}`);
  console.error("Run the e2e tests first to generate screenshots.");
  process.exit(1);
}

/**
 * Recursively find all output.json files under the given directory.
 */
function findOutputJsonFiles(dir) {
  const results = [];
  const rootFile = join(dir, "output.json");
  if (existsSync(rootFile)) results.push(rootFile);

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const nested = join(full, "output.json");
      if (existsSync(nested)) results.push(nested);
    }
  }
  return results;
}

const outputJsonFiles = findOutputJsonFiles(absDir);

if (outputJsonFiles.length === 0) {
  console.error("No output.json found. Did any visual tests run?");
  console.error("Ensure createJsonReportFiles: true is set in your wdio visual service config.");
  process.exit(1);
}

/**
 * Merge multiple output.json files into a single combined file.
 * Each output.json contains a JSON object; we merge their top-level arrays.
 */
function mergeOutputJsonFiles(files) {
  if (files.length === 1) return files[0];

  const merged = [];
  for (const file of files) {
    const data = JSON.parse(readFileSync(file, "utf-8"));
    // output.json can be an array of comparison results or an object with an array
    if (Array.isArray(data)) {
      merged.push(...data);
    } else if (data && typeof data === "object") {
      // Push the entire object as-is; the reporter may expect individual entries
      merged.push(data);
    }
  }

  const combinedPath = join(absDir, "output-combined.json");
  writeFileSync(combinedPath, JSON.stringify(merged, null, 2));
  console.log(`Merged ${files.length} output.json files into ${combinedPath}`);
  return combinedPath;
}

const outputJson = mergeOutputJsonFiles(outputJsonFiles);
console.log(`Found output.json file(s): ${outputJsonFiles.map((f) => f.replace(absDir, ".")).join(", ")}`);

// Step 1: Generate HTML report (non-interactive CLI mode)
const reportDir = resolve(absDir, "report");
console.log(`Generating HTML report in ${reportDir}...`);
execSync(`npx wdio-visual-reporter --jsonOutput="${outputJson}" --reportFolder="${reportDir}"`, { stdio: "inherit" });

// Step 2: Serve the report
const reportAppDir = resolve(reportDir, "report");
console.log("\nServing visual report...");
console.log("Open the URL shown below in your browser. Press Ctrl+C to stop.\n");
execSync(`npx sirv-cli "${reportAppDir}" --single --open`, { stdio: "inherit" });
