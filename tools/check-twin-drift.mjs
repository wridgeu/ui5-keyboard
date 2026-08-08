#!/usr/bin/env node

/**
 * Twin-drift check for the deliberately duplicated kiosk keyboard packages.
 *
 * `packages/kiosk-keyboard` (UI5 control) and `packages/kiosk-keyboard-webc`
 * (web component) intentionally do not share code; a set of modules is
 * duplicated by hand and must stay logically identical. Hand-syncing has
 * already missed one-sided fixes, so this check compares each twin pair after
 * normalizing away the differences that are legitimate (comments, blank lines,
 * `.js` ESM import suffixes, and the `../internal/` vs `../core/` helper
 * directory a middleware module imports through) and fails with the first
 * drifting line when anything else drifts. Intra-line spacing is left to oxfmt
 * (run before this check in the same pipeline), so the normalizer does not
 * collapse it.
 *
 * Deliberately UNCHECKED twin modules (framework-adapted or intentionally
 * divergent; compared by humans, not by this script):
 * - KioskKeyboard.ts: the main class is a UI5 Control (metadata, renderer,
 *   lifecycle hooks) in kiosk and a decorator-based web component in webc; the
 *   two are structurally non-comparable. This is the widest unchecked surface:
 *   shared logic here is hand-synced across the twins. #121 decomposed the
 *   self-contained responsibilities (F-key dispatch, arrow-key grid navigation,
 *   plus the kiosk-only controls delegation) into the framework-adapted
 *   controller files listed below, shrinking this surface.
 * - internal/layout-registry.ts <-> core/layout-registry.ts: both are
 *   module-scoped const Maps, but the twins diverge in their diagnostics --
 *   kiosk logs through sap/base/Log, webc through console.
 * - internal/middleware-registry.ts <-> core/middleware-registry.ts: the
 *   built-in factory tables name framework-adapted middleware modules.
 * - internal/input-operations.ts <-> core/input-operations.ts: kiosk routes
 *   through UI5 setValue/liveChange, webc writes the DOM value directly.
 * - internal/dom-contract.ts <-> core/dom-contract.ts: kiosk targets UI5
 *   controls, webc targets plain elements and shadow roots.
 * - internal/dom.ts <-> core/dom-utils.ts, internal/i18n-registry.ts <->
 *   core/i18n.ts, internal/detect-keyboard-type.ts <->
 *   core/keyboard-type-detector.ts, internal/backspace-repeat-behavior.ts <->
 *   core/backspace-repeat-controller.ts: framework adapters, different APIs.
 * - Framework-adapted controllers, same responsibility but kiosk extends
 *   sap/ui/base/Object behind a UI5 getter-based host while webc reads a plain
 *   element / shadow-root host:
 *   internal/responsive-sizing-controller.ts <-> core/responsive-sizing-controller.ts,
 *   internal/physical-key-highlight.ts <-> core/physical-key-highlight-controller.ts,
 *   internal/auto-show-behavior.ts <-> core/auto-show-controller.ts,
 *   internal/native-keyboard-suppression.ts <-> core/native-inputmode-suppression.ts
 *   (the last keys its refcount map by control id in kiosk, by element in webc),
 *   internal/auto-compact-behavior.ts <-> core/auto-compact-controller.ts (both
 *   measure the root's inline size off a ResizeObserver entry and apply the
 *   autoCompact tier from a frame, but kiosk reads a UI5 control's DOM ref and the
 *   camelCase threshold custom property while webc reads its shadow root and the
 *   kebab-case one),
 *   internal/fkey-controller.ts <-> core/fkey-controller.ts (kiosk reads the
 *   FKeyMode enum and dispatches via a UI5 target session; webc compares mode
 *   string literals and writes the resolved DOM input directly),
 *   internal/layout-state.ts <-> core/layout-state.ts (both own the base/requested
 *   layout and the source that drove the current one, but kiosk funnels every
 *   request through one `perform` that validates against the registry up front,
 *   while webc keeps three entry points and defers validation to `resolvedName`
 *   because its `layout` attribute can be set before `_processChildren` has
 *   populated the slot; kiosk also holds the tier announcement until the renderer's
 *   patch is done, where webc hands it straight to the announcement queue),
 *   internal/layout-fold-cache.ts <-> core/layout-fold-cache.ts (both cache the
 *   fold and dedupe its diagnostics, but kiosk keys the cache on aggregation
 *   child identity alone and logs through sap/base/Log, while webc also keys on
 *   each slotted element's revision, filters foreign children out of the slot,
 *   and logs through console),
 *   internal/key-grid-navigation.ts <-> core/key-grid-navigation.ts (both
 *   implement the same WAI-ARIA APG layout-grid arrow model (column-clamped
 *   vertical moves that stop at the top/bottom edge, row-boundary continuation
 *   that stops at the grid ends), but kiosk is a UI5 addDelegate driven by
 *   pseudo-events and DOM traversal while webc reads raw keydown against the
 *   resolved layout, so the two are behavior-aligned but not byte-identical).
 * - internal/controls-delegation-controller.ts: kiosk-only. The `controls`
 *   focus-delegation/auto-target reconciliation has no webc counterpart; webc
 *   resolves its single `controls` id lazily in AutoShowController instead.
 * - types.ts: kiosk carries UI5-only types (control settings, renderer API).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const kioskRoot = path.join(repoRoot, "packages", "kiosk-keyboard");
const webcRoot = path.join(repoRoot, "packages", "kiosk-keyboard-webc");

// High-fidelity tier: byte-identical after normalization.
const LAYOUTS = [
  "arabic",
  "default-layout",
  "fkey-row-compact",
  "fkey-row",
  "fkeys",
  "ja-kana-compact",
  "ja-kana",
  "ja-romaji",
  "ko-hangul",
  "nav-row-compact",
  "nav-row",
  "nav",
  "numeric",
  "numpad",
  "qwerty-es",
  "qwerty",
  "qwertz-de",
  "special",
  "symbol-common",
];

const CORE_MODULES = [
  "announcement-queue",
  "grapheme",
  "auto-repeat",
  "shift-state",
  "composition-utils",
  "key-token",
  "key-action-meta",
  "layout-constraint",
  "latin-variants",
  "layout-meta",
  "custom-layout-fold",
];

// Same-named kiosk internal/ <-> webc core/ helpers that are deliberately NOT
// byte-compared (framework-adapted; see the header comment). Together with
// CORE_MODULES these account for every module that exists under the same name
// in both directories; the completeness guard fails on any same-named pair not
// listed in either set, so a newly hand-duplicated module cannot silently skip
// the drift check.
const UNCHECKED_CORE_TWINS = [
  "dom-contract",
  "fkey-controller",
  "input-operations",
  "key-grid-navigation",
  "layout-fold-cache",
  "layout-registry",
  "layout-state",
  "middleware-registry",
  "responsive-sizing-controller",
];

// src/middleware/ is its own tier: the modules sit under the same path in both
// packages and reach their helpers through ../internal/ vs ../core/, which the
// normalizer equates.
const MIDDLEWARE = ["hangul-compose", "kana-dakuten"];

// Middleware whose twins are deliberately NOT byte-compared. Empty: a
// middleware's framework-specific step belongs in the input-operations adapter
// (`commitComposition`, `insertText`), which leaves the middleware itself
// identical. Add a name here, with the reason, only when that is genuinely
// impossible.
const UNCHECKED_MIDDLEWARE_TWINS = [];

const PAIRS = [
  ...LAYOUTS.map((name) => ({
    label: `layouts/${name}.ts`,
    kiosk: path.join(kioskRoot, "src", "layouts", `${name}.ts`),
    webc: path.join(webcRoot, "src", "layouts", `${name}.ts`),
  })),
  ...CORE_MODULES.map((name) => ({
    label: `${name}.ts (kiosk internal/ <-> webc core/)`,
    kiosk: path.join(kioskRoot, "src", "internal", `${name}.ts`),
    webc: path.join(webcRoot, "src", "core", `${name}.ts`),
  })),
  ...MIDDLEWARE.map((name) => ({
    label: `middleware/${name}.ts`,
    kiosk: path.join(kioskRoot, "src", "middleware", `${name}.ts`),
    webc: path.join(webcRoot, "src", "middleware", `${name}.ts`),
  })),
];

// Guard against the manifest silently shrinking (a dropped entry would make
// the check pass while comparing fewer pairs).
const EXPECTED_PAIR_COUNT = 32;

/**
 * Removes line and block comments, but ONLY outside string literals: a `//` or
 * `/*` inside a string is real data (layout key values are strings like "/" or
 * "*") and must survive verbatim. Newlines are preserved so the comparison
 * stays line-oriented; intra-line spacing is left to oxfmt and `normalize()`
 * trims each line, so no whitespace collapsing happens here.
 *
 * Limitation: regex literals are not modeled (none exist in the checked
 * modules). Both twins are parsed identically, so any quote-tracking desync
 * affects both sides the same way and still yields a faithful comparison.
 *
 * @param {string} src TypeScript source text
 * @returns {string} source with comments stripped
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  // Each quote char opens a verbatim span closed by the same char; template
  // `${}` interpolations are not parsed as code (no checked module nests code
  // in a template, and verbatim contents still compare faithfully).
  /** @type {Array<"code" | "single" | "double" | "template">} */
  const stack = ["code"];

  while (i < src.length) {
    const mode = stack[stack.length - 1];
    const c = src[i] ?? "";
    const next = src[i + 1] ?? "";

    if (mode === "code") {
      if (c === "/" && next === "/") {
        while (i < src.length && src[i] !== "\n") i++; // skip to (not past) the newline
        continue;
      }
      if (c === "/" && next === "*") {
        i += 2;
        while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
          if (src[i] === "\n") out += "\n"; // preserve contained newlines for line structure
          i++;
        }
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === "`") {
        stack.push(c === "'" ? "single" : c === '"' ? "double" : "template");
      }
      out += c;
      i++;
      continue;
    }

    // Inside a string or template literal: copy verbatim, honoring escapes.
    if (c === "\\") {
      out += c + next;
      i += 2;
      continue;
    }
    if ((mode === "single" && c === "'") || (mode === "double" && c === '"') || (mode === "template" && c === "`")) {
      stack.pop();
    }
    out += c;
    i++;
  }

  return out;
}

const RELATIVE_JS_SUFFIX = /((?:from|import)\s*\(?\s*["'])(\.{1,2}\/[^"']*)\.js(["'])/g;

// The one directory name the two packaging conventions force apart: a module
// under src/middleware/ reaches its helpers through ../internal/ in kiosk and
// ../core/ in webc. Scoped to those two literal prefixes so it cannot equate
// anything else -- a genuinely wrong cross-directory import stays visible here
// (and is a tsc error regardless).
const TWIN_HELPER_DIR = /((?:from|import)\s*\(?\s*["'])\.\.\/(?:internal|core)\//g;

/**
 * Normalizes one twin source file into comparable lines.
 *
 * @param {string} filePath absolute path to the source file
 * @returns {string[]} normalized, non-empty lines
 */
function normalize(filePath) {
  const lines = [];
  for (let line of stripComments(readFileSync(filePath, "utf8")).split("\n")) {
    line = line.trim();
    if (!line) continue;
    line = line.replace(RELATIVE_JS_SUFFIX, "$1$2$3"); // webc ESM `.js` suffixes
    line = line.replace(TWIN_HELPER_DIR, "$1../TWIN_HELPERS/"); // kiosk internal/ <-> webc core/
    lines.push(line);
  }
  return lines;
}

if (PAIRS.length !== EXPECTED_PAIR_COUNT) {
  console.error(`Pair manifest has ${PAIRS.length} entries, expected ${EXPECTED_PAIR_COUNT}. Update both together.`);
  process.exit(1);
}

/**
 * Fails if a module that should be a twin is not accounted for in the manifest,
 * so a newly hand-duplicated file cannot silently skip the drift check (the
 * EXPECTED_PAIR_COUNT guard only catches the manifest shrinking, not a new pair
 * being forgotten).
 *
 * Which basenames "should be a twin" is the caller's call, and the two tiers
 * differ. layouts/ and middleware/ pass each package's whole listing: every
 * module there is expected to exist on both sides, so a one-sided file is drift
 * and is meant to fail (registering it then fails on the missing twin file
 * instead). internal/ <-> core/ passes the intersection, because those two
 * directories also hold differently-named framework adapters and package-only
 * modules that are out of scope by design.
 *
 * @param {string} label  directory pair description for the error message
 * @param {string[]} present  basenames to account for
 * @param {string[]} registered  basenames accounted for (checked + unchecked)
 */
function reconcile(label, present, registered) {
  const known = new Set(registered);
  const unregistered = present.filter((name) => !known.has(name));
  if (unregistered.length > 0) {
    console.error(
      `Unregistered twin module(s) in ${label}: ${unregistered.join(", ")}. Add each to the manifest in tools/check-twin-drift.mjs (as a checked pair) or to the unchecked list with a reason.`,
    );
    process.exit(1);
  }
}

const tsBasenames = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => f.slice(0, -3));

// layouts/ is a flat byte-checked tier: every .ts in either package must be a
// registered pair.
reconcile("layouts/", tsBasenames(path.join(kioskRoot, "src", "layouts")), LAYOUTS);
reconcile("layouts/", tsBasenames(path.join(webcRoot, "src", "layouts")), LAYOUTS);

// A module present under the SAME name in both kiosk internal/ and webc core/
// must be either byte-checked (CORE_MODULES) or explicitly unchecked
// (UNCHECKED_CORE_TWINS). Differently-named framework adapters are out of scope:
// their divergence is intentional and their names are distinct by design.
const webcCore = new Set(tsBasenames(path.join(webcRoot, "src", "core")));
const sharedCoreNames = tsBasenames(path.join(kioskRoot, "src", "internal")).filter((name) => webcCore.has(name));
reconcile("internal/ <-> core/", sharedCoreNames, [...CORE_MODULES, ...UNCHECKED_CORE_TWINS]);

// middleware/ is a flat tier under the same path in both packages: every .ts
// must be a checked pair or explicitly unchecked. Without this a third
// hand-duplicated middleware would skip the drift check entirely.
reconcile("middleware/", tsBasenames(path.join(kioskRoot, "src", "middleware")), [
  ...MIDDLEWARE,
  ...UNCHECKED_MIDDLEWARE_TWINS,
]);
reconcile("middleware/", tsBasenames(path.join(webcRoot, "src", "middleware")), [
  ...MIDDLEWARE,
  ...UNCHECKED_MIDDLEWARE_TWINS,
]);

console.log(`Comparing ${PAIRS.length} twin pairs (kiosk-keyboard <-> kiosk-keyboard-webc)...`);

let drifted = 0;
for (const pair of PAIRS) {
  for (const file of [pair.kiosk, pair.webc]) {
    if (!existsSync(file)) {
      console.error(`Missing twin file: ${file} (pair '${pair.label}'). A missing file is drift, not a skip.`);
      process.exit(1);
    }
  }
  const kioskLines = normalize(pair.kiosk);
  const webcLines = normalize(pair.webc);
  if (kioskLines.join("\n") === webcLines.join("\n")) continue;

  drifted++;
  // Report the first divergence. Line numbers are positions in the normalized
  // form, not the source; open both files in a diff tool for the full delta.
  const max = Math.max(kioskLines.length, webcLines.length);
  let at = 0;
  while (at < max && kioskLines[at] === webcLines[at]) at++;
  console.error(`\nTwin drift in '${pair.label}' (first diff at normalized line ~${at + 1}):`);
  console.error(`--- ${path.relative(repoRoot, pair.kiosk)}`);
  console.error(`+++ ${path.relative(repoRoot, pair.webc)}`);
  console.error(`- ${kioskLines[at] ?? "<end of file>"}`);
  console.error(`+ ${webcLines[at] ?? "<end of file>"}`);
}

if (drifted > 0) {
  console.error(
    `\n${drifted} twin pair${drifted === 1 ? "" : "s"} drifted. Sync the change into both packages (or, if the divergence is intentional, move the pair to the unchecked list at the top of tools/check-twin-drift.mjs with a reason).`,
  );
  process.exit(1);
}

console.log("All twin pairs are in sync.");
