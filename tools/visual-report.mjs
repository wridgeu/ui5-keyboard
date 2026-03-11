#!/usr/bin/env node

/**
 * Generates an HTML visual-regression report via @wdio/visual-reporter
 * and serves it locally.
 *
 * The visual service already produces an output.json when
 * `createJsonReportFiles: true` is set in the wdio config.
 * This script simply feeds that file into the reporter CLI.
 *
 * Usage:
 *   node tools/visual-report.mjs <screenshotDir>
 *
 * Example:
 *   node tools/visual-report.mjs packages/kiosk-keyboard/test/e2e/__screenshots__
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
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

const outputJson = resolve(absDir, "output.json");
if (!existsSync(outputJson)) {
  console.error("No output.json found. Did any visual tests run?");
  console.error("Ensure createJsonReportFiles: true is set in your wdio visual service config.");
  process.exit(1);
}

// Step 1: Generate HTML report (non-interactive CLI mode)
const reportDir = resolve(absDir, "report");
console.log(`Generating HTML report in ${reportDir}...`);
execSync(`npx wdio-visual-reporter --jsonOutput="${outputJson}" --reportFolder="${reportDir}"`, { stdio: "inherit" });

// Step 2: Serve the report
const reportAppDir = resolve(reportDir, "report");
console.log("\nServing visual report...");
console.log("Open the URL shown below in your browser. Press Ctrl+C to stop.\n");
execSync(`npx sirv-cli "${reportAppDir}" --single --open`, { stdio: "inherit" });
