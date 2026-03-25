#!/usr/bin/env node

/**
 * Visual baseline browser -- generates an HTML gallery of baseline (and
 * optionally screenshot) images and serves it locally.
 *
 * Usage:
 *   node tools/visual-browse.mjs <baselinesDir> [--include-screenshots <screenshotsDir>]
 *
 * Examples:
 *   node tools/visual-browse.mjs packages/kiosk-keyboard/test/e2e/__baselines__
 *   node tools/visual-browse.mjs packages/kiosk-keyboard/test/e2e/__baselines__ \
 *     --include-screenshots packages/kiosk-keyboard/test/e2e/__screenshots__
 */

import { existsSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, parse, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { serveStatic } from "./serve-static.mjs";

const args = process.argv.slice(2);
const screenshotsIdx = args.indexOf("--include-screenshots");
let screenshotsDir = null;

if (screenshotsIdx !== -1) {
  screenshotsDir = args[screenshotsIdx + 1];
  if (!screenshotsDir) {
    console.error("Error: --include-screenshots requires a directory argument.");
    process.exit(1);
  }
  args.splice(screenshotsIdx, 2);
}

const baselinesDir = args[0];
if (!baselinesDir) {
  console.error("Usage: node tools/visual-browse.mjs <baselinesDir> [--include-screenshots <dir>]");
  console.error("");
  console.error("Examples:");
  console.error("  node tools/visual-browse.mjs packages/kiosk-keyboard/test/e2e/__baselines__");
  console.error("  node tools/visual-browse.mjs packages/kiosk-keyboard/test/e2e/__baselines__ \\");
  console.error("    --include-screenshots packages/kiosk-keyboard/test/e2e/__screenshots__");
  process.exit(1);
}

const absBaselines = resolve(baselinesDir);
if (!existsSync(absBaselines)) {
  console.error(`Baselines directory not found: ${absBaselines}`);
  process.exit(1);
}

if (screenshotsDir) {
  screenshotsDir = resolve(screenshotsDir);
  if (!existsSync(screenshotsDir)) {
    console.error(`Screenshots directory not found: ${screenshotsDir}`);
    process.exit(1);
  }
}

/** Return entries in a directory, or [] if the directory does not exist. */
function safeReaddir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/** True when `p` is a directory. */
function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// Collect profiles: subdirectories of the baselines dir.
const entries = safeReaddir(absBaselines);
const profiles = entries.filter((e) => isDir(join(absBaselines, e))).toSorted();

// Collect tags: filenames without .png, grouped by profile.
// "desktop" represents files directly in the baselines root.
function pngTags(dir) {
  return safeReaddir(dir)
    .filter((f) => f.endsWith(".png"))
    .map((f) => parse(f).name);
}

const tagsByProfile = new Map();
tagsByProfile.set("desktop", pngTags(absBaselines));
for (const profile of profiles) {
  tagsByProfile.set(profile, pngTags(join(absBaselines, profile)));
}

const allColumns = ["desktop", ...profiles];
const allTags = [...new Set(allColumns.flatMap((p) => tagsByProfile.get(p) ?? []))].toSorted();

// Derive a human-friendly package name from the baselines path.
// e.g. ".../packages/kiosk-keyboard/test/e2e/__baselines__" -> "kiosk-keyboard"
function derivePackageName(dir) {
  const parts = dir.split(sep);
  const pkgIdx = parts.indexOf("packages");
  if (pkgIdx !== -1 && pkgIdx + 1 < parts.length) {
    return parts[pkgIdx + 1];
  }
  return basename(dir);
}

/** Return a path relative to the repo root (for display under images). */
function toRepoRelative(absPath) {
  const parts = absPath.split(sep);
  const pkgIdx = parts.indexOf("packages");
  const relevant = pkgIdx !== -1 ? parts.slice(pkgIdx) : [basename(absPath)];
  return relevant.join("/");
}

const packageName = derivePackageName(absBaselines);

console.log(`Package:  ${packageName}`);
console.log(`Profiles: ${allColumns.join(", ")}`);
console.log(`Tags:     ${allTags.length}`);

const routes = {};

// Baselines routes
routes["/baselines/desktop"] = absBaselines;
for (const profile of profiles) {
  routes[`/baselines/${profile}`] = join(absBaselines, profile);
}

// Screenshots routes (when provided)
if (screenshotsDir) {
  // Desktop actuals/diffs live directly under actual/ and diff/
  routes["/screenshots/desktop/actual"] = join(screenshotsDir, "actual");
  routes["/screenshots/desktop/diff"] = join(screenshotsDir, "diff");

  for (const profile of profiles) {
    routes[`/screenshots/${profile}/actual`] = join(screenshotsDir, profile, "actual");
    routes[`/screenshots/${profile}/diff`] = join(screenshotsDir, profile, "diff");
  }
}

const hasScreenshots = !!screenshotsDir;

/**
 * Build a cell that shows the image with its relative file path underneath.
 * The path shown is relative to the repo root so it can be opened manually.
 */
function imgCell(src, fsRelPath) {
  const pathLabel = fsRelPath ? `<span class="file-path">${fsRelPath}</span>` : "";
  return `<a href="${src}" target="_blank"><img src="${src}" loading="lazy" onerror="this.closest('td').innerHTML='<span class=\\'placeholder\\'>---</span>'"></a>${pathLabel}`;
}

function generateHtml() {
  const screenshotToggle = hasScreenshots
    ? `<button id="toggle-screenshots" onclick="toggleScreenshots()">Show actual/diff</button>`
    : "";

  const profileHeaders = allColumns
    .map((col) => {
      const baselineHeader = `<th>${col}</th>`;
      if (!hasScreenshots) return baselineHeader;
      return [
        baselineHeader,
        `<th class="ss-col" style="display:none">${col} actual</th>`,
        `<th class="ss-col" style="display:none">${col} diff</th>`,
      ].join("\n");
    })
    .join("\n");

  const rows = allTags
    .map((tag, i) => {
      const rowClass = i % 2 === 0 ? "even" : "odd";
      const cells = allColumns
        .map((col) => {
          const baselineSrc = `/baselines/${col}/${tag}.png`;
          const baselineFsDir = col === "desktop" ? absBaselines : join(absBaselines, col);
          const baselineFsPath = toRepoRelative(join(baselineFsDir, `${tag}.png`));
          const baselineCell = `<td>${imgCell(baselineSrc, baselineFsPath)}</td>`;
          if (!hasScreenshots) return baselineCell;

          const actualSrc = `/screenshots/${col}/actual/${tag}.png`;
          const diffSrc = `/screenshots/${col}/diff/${tag}.png`;
          const actualFsDir = col === "desktop" ? join(screenshotsDir, "actual") : join(screenshotsDir, col, "actual");
          const diffFsDir = col === "desktop" ? join(screenshotsDir, "diff") : join(screenshotsDir, col, "diff");
          return [
            baselineCell,
            `<td class="ss-col" style="display:none">${imgCell(actualSrc, toRepoRelative(join(actualFsDir, `${tag}.png`)))}</td>`,
            `<td class="ss-col" style="display:none">${imgCell(diffSrc, toRepoRelative(join(diffFsDir, `${tag}.png`)))}</td>`,
          ].join("\n");
        })
        .join("\n");

      return `<tr class="${rowClass}"><td class="tag-cell">${tag}</td>\n${cells}</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${packageName} - Visual Baselines</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }

  body {
    margin: 0;
    padding: 24px 28px;
    font-family: system-ui, -apple-system, sans-serif;
    background: #f5f5f5;
    color: #1a1a1a;
    line-height: 1.5;
  }

  header {
    max-width: 960px;
    margin-bottom: 20px;
  }
  h1 {
    margin: 0 0 2px;
    font-size: 1.3rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .summary {
    color: #666;
    margin: 0 0 14px;
    font-size: 0.85rem;
  }

  #toggle-screenshots {
    padding: 5px 12px;
    border: 1px solid #ccc;
    border-radius: 3px;
    background: #fff;
    cursor: pointer;
    font-size: 0.8rem;
    font-family: inherit;
    transition: background 0.1s;
  }
  #toggle-screenshots:hover { background: #eee; }

  .table-wrapper {
    overflow: auto;
    max-height: calc(100vh - 120px);
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fff;
  }

  table {
    border-collapse: collapse;
    font-size: 0.82rem;
    width: max-content;
  }
  th, td {
    border: 1px solid #e8e8e8;
    padding: 10px 12px;
    text-align: center;
    vertical-align: top;
  }
  thead th {
    position: sticky;
    top: 0;
    background: #fafafa;
    border-bottom: 2px solid #ddd;
    z-index: 2;
    font-weight: 600;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #555;
    padding: 8px 12px;
  }

  .tag-cell {
    position: sticky;
    left: 0;
    z-index: 1;
    font-family: ui-monospace, "Cascadia Code", "Fira Code", monospace;
    font-weight: 600;
    font-size: 0.8rem;
    text-align: left;
    white-space: nowrap;
    background: inherit;
    padding: 10px 14px;
  }
  thead th:first-child {
    position: sticky;
    left: 0;
    z-index: 3;
  }

  tr.even { background: #fff; }
  tr.odd  { background: #fafafa; }
  tr:hover { background: #f0f4ff; }

  td img {
    max-width: 280px;
    max-height: 400px;
    object-fit: contain;
    display: block;
    margin: 0 auto;
    border-radius: 3px;
  }
  td a { display: block; text-decoration: none; }

  .file-path {
    display: block;
    margin-top: 6px;
    font-family: ui-monospace, "Cascadia Code", "Fira Code", monospace;
    font-size: 0.68rem;
    color: #999;
    word-break: break-all;
    line-height: 1.3;
    max-width: 280px;
    text-align: center;
  }

  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 120px;
    height: 80px;
    background: #f0f0f0;
    color: #bbb;
    font-size: 0.75rem;
    border-radius: 3px;
    margin: 0 auto;
  }

  @media (prefers-color-scheme: dark) {
    body { background: #111; color: #ddd; }
    .table-wrapper { background: #1a1a1a; border-color: #333; }
    th, td { border-color: #2a2a2a; }
    thead th { background: #1e1e1e; border-bottom-color: #333; color: #888; }
    tr.even { background: #1a1a1a; }
    tr.odd  { background: #1e1e1e; }
    tr:hover { background: #1a2233; }
    .placeholder { background: #282828; color: #555; }
    .file-path { color: #666; }
    .summary { color: #888; }
    #toggle-screenshots {
      background: #222;
      border-color: #444;
      color: #ddd;
    }
    #toggle-screenshots:hover { background: #2a2a2a; }
  }
</style>
</head>
<body>
<header>
  <h1>${packageName} -- Visual Baselines</h1>
  <p class="summary">${allTags.length} tags across ${allColumns.length} profiles</p>
  ${screenshotToggle}
</header>
<div class="table-wrapper">
<table>
<thead>
<tr>
<th>Tag</th>
${profileHeaders}
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</div>
<script>
let screenshotsVisible = false;
function toggleScreenshots() {
  screenshotsVisible = !screenshotsVisible;
  const cols = document.querySelectorAll('.ss-col');
  const display = screenshotsVisible ? '' : 'none';
  for (const col of cols) col.style.display = display;
  document.getElementById('toggle-screenshots').textContent =
    screenshotsVisible ? 'Hide actual/diff' : 'Show actual/diff';
}
</script>
</body>
</html>`;
}

const tmpDir = mkdtempSync(join(tmpdir(), "visual-browse-"));
const htmlPath = join(tmpDir, "index.html");
writeFileSync(htmlPath, generateHtml());

console.log(`\nGallery written to ${htmlPath}`);
console.log("Starting server...\n");

serveStatic(tmpDir, { routes });
