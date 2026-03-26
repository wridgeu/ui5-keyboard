#!/usr/bin/env node

/**
 * Visual baseline browser -- generates an HTML gallery of baseline (and
 * optionally screenshot) images and serves it locally.
 *
 * Usage:
 *   node tools/visual-browse.mjs <baselinesDir...> [--include-screenshots [dir]]
 *
 * Examples:
 *   # Single package
 *   node tools/visual-browse.mjs packages/kiosk-keyboard/test/e2e/__baselines__
 *
 *   # Single package with explicit screenshots dir
 *   node tools/visual-browse.mjs packages/kiosk-keyboard/test/e2e/__baselines__ \
 *     --include-screenshots packages/kiosk-keyboard/test/e2e/__screenshots__
 *
 *   # Multiple packages (screenshots inferred from __baselines__ -> __screenshots__)
 *   node tools/visual-browse.mjs \
 *     packages/kiosk-keyboard/test/e2e/__baselines__ \
 *     packages/kiosk-keyboard-webc/test/e2e/__baselines__ \
 *     --include-screenshots
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, parse, resolve, sep } from "node:path";
import { serveStatic } from "./serve-static.mjs";

// -- Arg parsing --

const rawArgs = process.argv.slice(2);
const screenshotsIdx = rawArgs.indexOf("--include-screenshots");
let includeScreenshots = false;
let explicitScreenshotsDir = null;

if (screenshotsIdx !== -1) {
  includeScreenshots = true;
  const nextArg = rawArgs[screenshotsIdx + 1];
  // If the next arg exists and is not a flag, treat it as an explicit path
  if (nextArg && !nextArg.startsWith("--")) {
    explicitScreenshotsDir = nextArg;
    rawArgs.splice(screenshotsIdx, 2);
  } else {
    rawArgs.splice(screenshotsIdx, 1);
  }
}

const baselinesDirs = rawArgs.filter((a) => !a.startsWith("--"));
if (baselinesDirs.length === 0) {
  console.error("Usage: node tools/visual-browse.mjs <baselinesDir...> [--include-screenshots [dir]]");
  console.error("");
  console.error("Examples:");
  console.error("  node tools/visual-browse.mjs packages/kiosk-keyboard/test/e2e/__baselines__");
  console.error(
    "  node tools/visual-browse.mjs pkg1/test/e2e/__baselines__ pkg2/test/e2e/__baselines__ --include-screenshots",
  );
  process.exit(1);
}

/**
 * Convention mapping for @wdio/visual-service output structure.
 * Update here if the testing infrastructure changes.
 */
const config = {
  /** Profile name for baselines stored directly in the root (not in a subdirectory). */
  rootProfile: "desktop",
  /** Directory name for screenshot output (sibling of __baselines__). */
  screenshotsDir: "__screenshots__",
  /** Subdirectory for actual screenshots within a profile's screenshot folder. */
  actualDir: "actual",
  /** Subdirectory for diff images within a profile's screenshot folder. */
  diffDir: "diff",
  /** Workspace root segment used to derive package names and repo-relative paths. */
  packagesSegment: "packages",
};

// -- Helpers --

function safeReaddir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function derivePackageName(dir) {
  const parts = dir.split(sep);
  const pkgIdx = parts.indexOf(config.packagesSegment);
  if (pkgIdx !== -1 && pkgIdx + 1 < parts.length) {
    return parts[pkgIdx + 1];
  }
  return basename(dir);
}

function toRepoRelative(absPath) {
  const parts = absPath.split(sep);
  const pkgIdx = parts.indexOf(config.packagesSegment);
  const relevant = pkgIdx !== -1 ? parts.slice(pkgIdx) : [basename(absPath)];
  return relevant.join("/");
}

function pngTags(dir) {
  return safeReaddir(dir)
    .filter((f) => f.endsWith(".png"))
    .map((f) => parse(f).name);
}

/** Infer __screenshots__ from __baselines__ path. */
function inferScreenshotsDir(baselinesAbsDir) {
  return join(dirname(baselinesAbsDir), config.screenshotsDir);
}

// -- Build per-package data --

// Validate baseline directories exist at startup
const resolvedBaselinesDirs = baselinesDirs.map((dir) => {
  const abs = resolve(dir);
  if (!existsSync(abs)) {
    console.error(`Baselines directory not found: ${abs}`);
    process.exit(1);
  }
  return abs;
});

function scanPackages() {
  const packages = [];

  for (const absBaselines of resolvedBaselinesDirs) {
    const pkg = derivePackageName(absBaselines);
    const entries = safeReaddir(absBaselines);
    const profiles = entries.filter((e) => isDir(join(absBaselines, e))).toSorted();

    const tagsByProfile = new Map();
    tagsByProfile.set(config.rootProfile, pngTags(absBaselines));
    for (const profile of profiles) {
      tagsByProfile.set(profile, pngTags(join(absBaselines, profile)));
    }

    let screenshotsDir = null;
    if (includeScreenshots) {
      if (explicitScreenshotsDir && resolvedBaselinesDirs.length === 1) {
        screenshotsDir = resolve(explicitScreenshotsDir);
      } else {
        screenshotsDir = inferScreenshotsDir(absBaselines);
      }
    }

    packages.push({ pkg, absBaselines, screenshotsDir, profiles, tagsByProfile });
  }

  const allProfiles = [...new Set(packages.flatMap((p) => p.profiles))].toSorted();
  const allColumns = [config.rootProfile, ...allProfiles];
  const multiPackage = packages.length > 1;
  const titleText = multiPackage ? "Visual Baselines" : `${packages[0].pkg} -- Visual Baselines`;

  const tagEntries = [];
  for (let pkgIdx = 0; pkgIdx < packages.length; pkgIdx++) {
    const p = packages[pkgIdx];
    const pkgTags = [...new Set(allColumns.flatMap((col) => p.tagsByProfile.get(col) ?? []))].toSorted();
    for (const tag of pkgTags) {
      tagEntries.push({ tag, pkg: p.pkg, pkgIdx });
    }
  }

  const sortedTagEntries = tagEntries.toSorted((a, b) => a.pkg.localeCompare(b.pkg) || a.tag.localeCompare(b.tag));

  return { packages, allProfiles, allColumns, multiPackage, titleText, tagEntries, sortedTagEntries };
}

// Print initial stats
const initial = scanPackages();
console.log(`Packages: ${initial.packages.map((p) => p.pkg).join(", ")}`);
console.log(`Profiles: ${initial.allColumns.join(", ")}`);
console.log(`Tags:     ${initial.tagEntries.length}`);

// -- Routes --

const routes = {};
for (const p of initial.packages) {
  const prefix = initial.multiPackage ? `/${p.pkg}` : "";
  routes[`${prefix}/baselines/${config.rootProfile}`] = p.absBaselines;
  for (const profile of p.profiles) {
    routes[`${prefix}/baselines/${profile}`] = join(p.absBaselines, profile);
  }
  if (p.screenshotsDir) {
    routes[`${prefix}/screenshots/${config.rootProfile}/${config.actualDir}`] = join(
      p.screenshotsDir,
      config.actualDir,
    );
    routes[`${prefix}/screenshots/${config.rootProfile}/${config.diffDir}`] = join(p.screenshotsDir, config.diffDir);
    for (const profile of p.profiles) {
      routes[`${prefix}/screenshots/${profile}/${config.actualDir}`] = join(
        p.screenshotsDir,
        profile,
        config.actualDir,
      );
      routes[`${prefix}/screenshots/${profile}/${config.diffDir}`] = join(p.screenshotsDir, profile, config.diffDir);
    }
  }
}

// -- HTML generation --

/**
 * @param {"baseline"|"actual"|"diff"} colType
 * @param {boolean} [hasActual] - For diff cells: whether a matching actual screenshot exists.
 *   When true, a missing diff means "no differences" (good). When false, "tests not run".
 */
function imgCell(src, fsRelPath, colType = "baseline", hasActual = false) {
  const pathLabel = fsRelPath ? `<span class="file-path">${fsRelPath}</span>` : "";
  const extraData = colType === "diff" ? `this.parentElement.dataset.hasActual='${hasActual}';` : "";
  return `<img src="${src}" loading="lazy" class="zoomable" onerror="this.parentElement.classList.add('img-missing');this.parentElement.dataset.colType='${colType}';${extraData}">${pathLabel}`;
}

/**
 * @param {string} [extraClass]
 * @param {string} [reason] - Short explanation shown below the placeholder label.
 */
function notInProfileCell(extraClass, reason) {
  const cls = extraClass ? `not-in-profile ${extraClass}` : "not-in-profile";
  const hide = extraClass?.includes("ss-col") ? ' style="display:none"' : "";
  const reasonHtml = reason ? `<span class="skip-reason">${reason}</span>` : "";
  return `<td class="${cls}"${hide}><span class="placeholder">Skipped${reasonHtml}</span></td>`;
}

function generateHtml() {
  const { packages, allColumns, multiPackage, titleText, tagEntries, sortedTagEntries } = scanPackages();

  const screenshotToggle = includeScreenshots
    ? `<button id="toggle-screenshots" class="header-btn" onclick="toggleScreenshots()">Show actual/diff</button>`
    : "";

  const packageFilter = multiPackage
    ? `<select id="pkg-filter" onchange="filterPackage(this.value)">
        <option value="all">All libraries</option>
        ${packages.map((p) => `<option value="${p.pkg}">${p.pkg}</option>`).join("\n")}
       </select>`
    : "";

  function resizableTh(label, extraClass) {
    const cls = extraClass ? ` class="${extraClass}"` : "";
    const style = extraClass?.includes("ss-col") ? ' style="display:none"' : "";
    return `<th${cls}${style}>${label}<span class="col-resize-handle"></span></th>`;
  }

  const profileHeaders = allColumns
    .map((col) => {
      const baselineHeader = resizableTh(col);
      if (!includeScreenshots) return baselineHeader;
      return [baselineHeader, resizableTh(`${col} actual`, "ss-col"), resizableTh(`${col} diff`, "ss-col")].join("\n");
    })
    .join("\n");

  const rows = sortedTagEntries
    .map((entry, i) => {
      const { tag, pkg, pkgIdx } = entry;
      const p = packages[pkgIdx];
      const rowClass = i % 2 === 0 ? "even" : "odd";
      const urlPrefix = multiPackage ? `/${pkg}` : "";
      const pkgBadge = multiPackage ? `<span class="pkg-badge">${pkg}</span>` : "";

      const cells = allColumns
        .map((col) => {
          const profileTags = p.tagsByProfile.get(col) ?? [];
          const tagExists = profileTags.includes(tag);

          if (!tagExists) {
            // Build a short reason: list which profiles DO have this tag
            const presentIn = allColumns.filter((c) => (p.tagsByProfile.get(c) ?? []).includes(tag));
            const reason = presentIn.length ? `Only in ${presentIn.join(", ")}` : "";
            if (!includeScreenshots) return notInProfileCell(undefined, reason);
            return [notInProfileCell(undefined, reason), notInProfileCell("ss-col"), notInProfileCell("ss-col")].join(
              "\n",
            );
          }

          const baselineSrc = `${urlPrefix}/baselines/${col}/${tag}.png`;
          const baselineFsDir = col === config.rootProfile ? p.absBaselines : join(p.absBaselines, col);
          const baselineFsPath = toRepoRelative(join(baselineFsDir, `${tag}.png`));
          const baselineCell = `<td>${imgCell(baselineSrc, baselineFsPath, "baseline")}</td>`;
          if (!includeScreenshots) return baselineCell;

          const actualSrc = `${urlPrefix}/screenshots/${col}/${config.actualDir}/${tag}.png`;
          const diffSrc = `${urlPrefix}/screenshots/${col}/${config.diffDir}/${tag}.png`;
          const sDir = p.screenshotsDir ?? "";
          const actualFsDir =
            col === config.rootProfile ? join(sDir, config.actualDir) : join(sDir, col, config.actualDir);
          const diffFsDir = col === config.rootProfile ? join(sDir, config.diffDir) : join(sDir, col, config.diffDir);
          const actualFileExists = existsSync(join(actualFsDir, `${tag}.png`));
          return [
            baselineCell,
            `<td class="ss-col" style="display:none">${imgCell(actualSrc, toRepoRelative(join(actualFsDir, `${tag}.png`)), "actual")}</td>`,
            `<td class="ss-col" style="display:none">${imgCell(diffSrc, toRepoRelative(join(diffFsDir, `${tag}.png`)), "diff", actualFileExists)}</td>`,
          ].join("\n");
        })
        .join("\n");

      return `<tr class="${rowClass}" data-pkg="${pkg}"><td class="tag-cell"><span class="tag-name">${tag}</span>${pkgBadge}</td>\n${cells}</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titleText}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }

  :root {
    --bg: #f5f5f5;
    --bg-surface: #fff;
    --bg-header: #fafafa;
    --bg-row-even: #fff;
    --bg-row-odd: #fafafa;
    --bg-hover: #f0f4ff;
    --bg-control: #fff;
    --bg-control-hover: #eee;
    --bg-placeholder: #f0f0f0;
    --bg-badge: #e8edf3;
    --text: #1a1a1a;
    --text-muted: #666;
    --text-heading: #555;
    --text-badge: #778;
    --text-placeholder: #bbb;
    --border: #e8e8e8;
    --border-strong: #ddd;
    --border-control: #ccc;
    --text-success: #2e7d32;
    color-scheme: light;
  }
  body.dark {
    --bg: #111;
    --bg-surface: #1a1a1a;
    --bg-header: #1e1e1e;
    --bg-row-even: #1a1a1a;
    --bg-row-odd: #1e1e1e;
    --bg-hover: #1a2233;
    --bg-control: #222;
    --bg-control-hover: #2a2a2a;
    --bg-placeholder: #282828;
    --bg-badge: #2a2f38;
    --text: #ddd;
    --text-muted: #888;
    --text-heading: #888;
    --text-badge: #889;
    --text-placeholder: #555;
    --border: #2a2a2a;
    --border-strong: #333;
    --text-success: #66bb6a;
    --border-control: #444;
    color-scheme: dark;
  }

  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    font-family: system-ui, -apple-system, sans-serif;
    line-height: 1.5;
  }
  body {
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--text);
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 16px;
    border-bottom: 1px solid var(--border-strong);
    background: var(--bg);
    flex-shrink: 0;
  }
  .summary {
    color: var(--text-muted);
    margin: 0;
    font-size: 0.8rem;
    white-space: nowrap;
  }
  h1 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .header-spacer { flex: 1; }

  .header-btn, #pkg-filter, #theme-toggle {
    padding: 4px 10px;
    border: 1px solid var(--border-control);
    border-radius: 3px;
    background: var(--bg-control);
    color: var(--text);
    cursor: pointer;
    font-size: 0.75rem;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .header-btn:hover, #pkg-filter:hover, #theme-toggle:hover {
    background: var(--bg-control-hover);
  }
  #theme-toggle { font-size: 0.9rem; padding: 2px 8px; }

  .table-wrapper {
    flex: 1;
    overflow: auto;
    background: var(--bg-surface);
  }

  table {
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.82rem;
    width: max-content;
  }
  th, td {
    border-bottom: 1px solid var(--border);
    border-right: 1px solid var(--border);
    padding: 10px 12px;
    text-align: center;
    vertical-align: top;
    overflow: hidden;
  }
  thead th {
    position: sticky;
    top: 0;
    background: var(--bg-header);
    border-bottom: 2px solid var(--border-strong);
    z-index: 2;
    font-weight: 600;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-heading);
    padding: 8px 12px;
    overflow: hidden;
  }

  .tag-cell {
    position: sticky;
    left: 0;
    z-index: 1;
    font-family: ui-monospace, "Cascadia Code", "Fira Code", monospace;
    font-weight: 600;
    font-size: 0.8rem;
    text-align: left;
    padding: 10px 14px;
    border-right: 2px solid var(--border-strong);
    overflow: hidden;
  }
  .tag-name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  tr.even .tag-cell { background: var(--bg-row-even); }
  tr.odd .tag-cell  { background: var(--bg-row-odd); }
  tr:hover .tag-cell { background: var(--bg-hover); }
  thead th:first-child {
    position: sticky;
    left: 0;
    z-index: 3;
    border-right: 2px solid var(--border-strong);
  }
  .col-resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    cursor: col-resize;
    background: transparent;
  }
  .col-resize-handle:hover,
  .col-resize-handle.dragging {
    background: var(--bg-hover);
  }

  tr.even { background: var(--bg-row-even); }
  tr.odd  { background: var(--bg-row-odd); }
  tr:hover { background: var(--bg-hover); }

  .pkg-badge {
    display: block;
    font-size: 0.58rem;
    font-weight: 400;
    font-family: system-ui, sans-serif;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--bg-badge);
    color: var(--text-badge);
    margin-top: 3px;
    letter-spacing: 0;
    text-transform: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: fit-content;
    max-width: 100%;
  }

  td img {
    max-width: 280px;
    max-height: 400px;
    object-fit: contain;
    display: block;
    margin: 0 auto;
    border-radius: 3px;
  }
  img.zoomable { cursor: zoom-in; }

  .file-path {
    display: block;
    margin-top: 6px;
    font-family: ui-monospace, "Cascadia Code", "Fira Code", monospace;
    font-size: 0.68rem;
    color: var(--text-muted);
    word-break: break-all;
    line-height: 1.3;
    max-width: 280px;
    text-align: center;
  }

  .not-in-profile { opacity: 0.5; }
  .img-missing img { display: none; }
  .img-missing .file-path { opacity: 0.6; }
  .img-missing::before {
    content: "No baseline found";
    display: flex;
    align-items: center;
    justify-content: center;
    width: 200px;
    height: 80px;
    background: var(--bg-placeholder);
    color: var(--text-muted);
    font-size: 0.7rem;
    border-radius: 3px;
    margin: 0 auto;
    text-align: center;
    padding: 8px;
    line-height: 1.4;
  }
  .img-missing[data-col-type="actual"]::before {
    content: "No screenshot - run e2e tests first";
  }
  .img-missing[data-col-type="diff"][data-has-actual="true"]::before {
    content: "\\2714  No differences";
    color: var(--text-success);
  }
  .img-missing[data-col-type="diff"][data-has-actual="false"]::before {
    content: "No screenshot - run e2e tests first";
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 160px;
    min-height: 80px;
    background: var(--bg-placeholder);
    color: var(--text-placeholder);
    font-size: 0.75rem;
    border-radius: 3px;
    margin: 0 auto;
    padding: 8px;
    text-align: center;
    line-height: 1.4;
  }
  .skip-reason {
    display: block;
    font-size: 0.6rem;
    opacity: 0.7;
    max-width: 140px;
    word-break: break-word;
  }

  #lightbox {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.85);
    cursor: zoom-out;
    align-items: center;
    justify-content: center;
  }
  #lightbox.open { display: flex; }
  #lightbox img {
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  }

  /* Dark mode is handled entirely via CSS custom properties on body.dark */
</style>
</head>
<body>
<header>
  <span class="summary">${tagEntries.length} tags, ${allColumns.length} profiles</span>
  <span class="header-spacer"></span>
  <h1>${titleText}</h1>
  <span class="header-spacer"></span>
  ${packageFilter}
  ${screenshotToggle}
  <button id="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark mode"></button>
</header>
<div class="table-wrapper">
<table>
<thead>
<tr>
<th>Tag<span class="col-resize-handle"></span></th>
${profileHeaders}
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</div>
<div id="lightbox" onclick="closeLightbox()">
  <img id="lightbox-img" alt="">
</div>
<script>
// -- URL state persistence --
const params = new URLSearchParams(location.search);

function updateUrl(key, value) {
  const p = new URLSearchParams(location.search);
  if (value === null || value === undefined) p.delete(key);
  else p.set(key, value);
  const qs = p.toString();
  history.replaceState(null, '', qs ? '?' + qs : location.pathname);
}

// -- Theme --
const themeBtn = document.getElementById('theme-toggle');
function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  themeBtn.textContent = dark ? '\u2600\uFE0F' : '\uD83C\uDF19';
  updateUrl('theme', dark ? 'dark' : 'light');
}
const initTheme = params.get('theme');
applyTheme(initTheme ? initTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
function toggleTheme() {
  applyTheme(!document.body.classList.contains('dark'));
}

// -- Screenshots toggle --
let screenshotsVisible = params.get('diff') === '1';
function applyScreenshots() {
  const cols = document.querySelectorAll('.ss-col');
  const display = screenshotsVisible ? '' : 'none';
  for (const col of cols) col.style.display = display;
  const btn = document.getElementById('toggle-screenshots');
  if (btn) btn.textContent = screenshotsVisible ? 'Hide actual/diff' : 'Show actual/diff';
  updateUrl('diff', screenshotsVisible ? '1' : null);
}
applyScreenshots();
function toggleScreenshots() {
  screenshotsVisible = !screenshotsVisible;
  applyScreenshots();
}

// -- Package filter --
const pkgFilter = document.getElementById('pkg-filter');
function filterPackage(pkg) {
  const rows = document.querySelectorAll('tbody tr');
  let visibleIdx = 0;
  for (const row of rows) {
    const show = pkg === 'all' || row.dataset.pkg === pkg;
    row.style.display = show ? '' : 'none';
    if (show) {
      row.classList.toggle('even', visibleIdx % 2 === 0);
      row.classList.toggle('odd', visibleIdx % 2 === 1);
      visibleIdx++;
    }
  }
  updateUrl('pkg', pkg === 'all' ? null : pkg);
}
const initPkg = params.get('pkg');
if (initPkg && pkgFilter) {
  pkgFilter.value = initPkg;
  filterPackage(initPkg);
}

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

document.addEventListener('click', (e) => {
  const img = e.target.closest('img.zoomable');
  if (!img) return;
  lightboxImg.src = img.src;
  lightbox.classList.add('open');
});

function closeLightbox() {
  lightbox.classList.remove('open');
  lightboxImg.src = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

// Column resize: drag any header's right edge to resize that column
{
  const table = document.querySelector('table');

  table.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.col-resize-handle');
    if (!handle) return;
    e.preventDefault();

    const th = handle.parentElement;
    const colIdx = [...th.parentElement.children].indexOf(th);
    const startX = e.clientX;
    const startWidth = th.offsetWidth;
    const varName = \`--col-\${colIdx}-w\`;
    const columnCells = table.querySelectorAll(\`tr > :nth-child(\${colIdx + 1})\`);
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev) {
      const width = Math.max(40, startWidth + (ev.clientX - startX));
      table.style.setProperty(varName, \`\${width}px\`);
      for (const cell of columnCells) {
        cell.style.width = \`var(\${varName})\`;
        cell.style.minWidth = \`var(\${varName})\`;
        cell.style.maxWidth = \`var(\${varName})\`;
      }
    }
    function onUp() {
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
</script>
</body>
</html>`;
}

const handlers = {
  "/index.html": () => ({ body: generateHtml() }),
};

console.log("\nStarting server...\n");

serveStatic(resolve("."), { routes, handlers });
