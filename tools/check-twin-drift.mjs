#!/usr/bin/env node

/**
 * Twin-drift check for the deliberately duplicated kiosk keyboard packages.
 *
 * `packages/kiosk-keyboard` (UI5 control) and `packages/kiosk-keyboard-webc`
 * (web component) intentionally do not share code; a set of modules is
 * duplicated by hand and must stay logically identical. Hand-syncing has
 * already missed one-sided fixes, so this check compares each twin pair after
 * normalizing away the differences that are legitimate (comments, `.js` ESM
 * import suffixes, whitespace, logging idioms) and fails with a unified diff
 * when anything else drifts.
 *
 * Deliberately UNCHECKED twin modules (framework-adapted or intentionally
 * divergent; compared by humans, not by this script):
 * - KioskKeyboard.ts: the main class is a UI5 Control (metadata, renderer,
 *   lifecycle hooks) in kiosk and a decorator-based web component in webc; the
 *   two are structurally non-comparable. This is the widest unchecked surface:
 *   shared logic here is hand-synced across the twins until the orchestrators
 *   are decomposed into controller twin-pairs that this script can diff (the
 *   path to real coverage, tracked in #121).
 * - internal/key-grid-navigation.ts: kiosk extracted arrow-key grid navigation
 *   to its own module (attached via addDelegate); webc keeps the same logic
 *   inline in KioskKeyboard.ts `_onKeyDown`, so there is no webc twin file to
 *   diff. Closing this asymmetry is part of #121.
 * - middleware/kana-dakuten.ts: known semantic divergence between the twins.
 * - middleware/hangul-compose.ts: framework-adapted wiring differs.
 * - internal/layout-registry.ts <-> core/layout-registry.ts: registry is
 *   static-class-based in webc, module-scoped in kiosk.
 * - internal/middleware-registry.ts <-> core/middleware-registry.ts: same
 *   structural split as layout-registry.
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
 *   (the last keys its refcount map by control id in kiosk, by element in webc).
 * - types.ts: kiosk carries UI5-only types (control settings, renderer API).
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const kioskRoot = path.join(repoRoot, "packages", "kiosk-keyboard");
const webcRoot = path.join(repoRoot, "packages", "kiosk-keyboard-webc");

// High-fidelity tier: byte-identical after normalization.
const LAYOUTS = [
  "arabic",
  "default-layout",
  "fkey-row",
  "fkeys",
  "ja-kana",
  "ja-romaji",
  "ko-hangul",
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

const CORE_MODULES = ["grapheme", "auto-repeat", "shift-state", "composition-utils", "key-token"];

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
];

// Guard against the manifest silently shrinking (a dropped entry would make
// the check pass while comparing fewer pairs).
const EXPECTED_PAIR_COUNT = 21;

/**
 * Strips line and block comments and collapses whitespace runs to a single
 * space, but ONLY outside string literals: a `//` or extra spaces inside a
 * string are real data (layout key values are strings) and must survive.
 * Newlines outside strings are preserved so the diff stays line-oriented.
 *
 * Limitation: regex literals are not modeled (none exist in the checked
 * modules); a `/"/` regex would desync quote tracking. Because both twins are
 * parsed identically, a desync affects both sides the same way and still
 * yields a faithful comparison.
 *
 * @param {string} src TypeScript source text
 * @returns {string} normalized source
 */
function stripCommentsAndCollapseWhitespace(src) {
  let out = "";
  let i = 0;
  // All three quote types ('...', "...", `...`) are verbatim string spans;
  // template `${}` interpolations are not parsed as code (no checked module
  // nests code in a template, and verbatim contents still compare faithfully).
  /** @type {Array<"code" | "single" | "double" | "template">} */
  const stack = ["code"];
  let pendingSpace = false;

  const emit = (chunk) => {
    if (pendingSpace) {
      if (out.length > 0 && !out.endsWith("\n") && chunk !== "\n") {
        out += " ";
      }
      pendingSpace = false;
    }
    out += chunk;
  };

  while (i < src.length) {
    const mode = stack[stack.length - 1];
    // The base "code" entry is never popped, so the stack is never empty;
    // the `if (!mode)` guard only narrows the type for noUncheckedIndexedAccess.
    if (!mode) break;
    const c = src[i];
    const next = src[i + 1];

    if (mode === "code") {
      if (c === "/" && next === "/") {
        // Line comment: skip to (not past) the newline.
        while (i < src.length && src[i] !== "\n") i++;
        continue;
      }
      if (c === "/" && next === "*") {
        // Block comment: skip, preserving contained newlines for line structure.
        i += 2;
        while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
          if (src[i] === "\n") emit("\n");
          i++;
        }
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === "`") {
        stack.push(c === "'" ? "single" : c === '"' ? "double" : "template");
        emit(c);
        i++;
        continue;
      }
      if (c === "\n") {
        pendingSpace = false;
        emit("\n");
        i++;
        continue;
      }
      if (c === " " || c === "\t" || c === "\r") {
        pendingSpace = true;
        i++;
        continue;
      }
      emit(c);
      i++;
      continue;
    }

    // Inside a string or template literal: verbatim, honoring escapes.
    if (c === "\\") {
      emit(c + (next ?? ""));
      i += 2;
      continue;
    }
    if ((mode === "single" && c === "'") || (mode === "double" && c === '"') || (mode === "template" && c === "`")) {
      stack.pop();
    }
    emit(c);
    i++;
  }

  return out;
}

const LOG_CALL = /\b(?:Log\.(?:warning|error|info|debug|fatal|trace)|console\.(?:warn|error|info|log|debug))\s*\(/;
const LOG_IMPORT = /^import\s+Log\s+from\s*["']sap\/base\/Log["'];?$/;
const RELATIVE_JS_SUFFIX = /((?:from|import)\s*\(?\s*["'])(\.{1,2}\/[^"']*)\.js(["'])/g;

/**
 * Normalizes one twin source file into comparable lines.
 *
 * @param {string} filePath absolute path to the source file
 * @returns {string[]} normalized, non-empty lines
 */
function normalize(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const stripped = stripCommentsAndCollapseWhitespace(raw);
  const lines = [];
  for (let line of stripped.split("\n")) {
    line = line.trim();
    if (!line) continue;
    if (LOG_IMPORT.test(line)) continue; // kiosk-only logger import
    line = line.replace(RELATIVE_JS_SUFFIX, "$1$2$3"); // webc ESM `.js` suffixes
    if (LOG_CALL.test(line)) {
      // Logging idioms legitimately differ (UI5 Log vs console, message
      // prefixes, log-component arguments): equate any logging line.
      line = "__LOG_CALL__";
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Longest-common-subsequence diff over normalized lines, rendered in a
 * unified-diff style (files here are a few hundred lines; O(n*m) is fine).
 *
 * @param {string[]} a kiosk lines
 * @param {string[]} b webc lines
 * @returns {string[]} diff lines (empty when identical)
 */
function unifiedDiff(a, b) {
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = length of the longest common subsequence of a[i:] and b[j:].
  // Cells default to 0, which is also the base case, so out-of-range reads
  // coalesce to the correct value (`?? 0`) under noUncheckedIndexedAccess.
  /** @type {number[][]} */
  const lcs = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0));
  for (let i = n - 1; i >= 0; i--) {
    const row = lcs[i] ?? [];
    const below = lcs[i + 1] ?? [];
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? (below[j + 1] ?? 0) + 1 : Math.max(below[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  /** @type {Array<{ tag: " " | "-" | "+", text: string, ai: number, bi: number }>} */
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const ai = a[i] ?? "";
    const bj = b[j] ?? "";
    if (ai === bj) {
      ops.push({ tag: " ", text: ai, ai: i, bi: j });
      i++;
      j++;
    } else if ((lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0)) {
      ops.push({ tag: "-", text: ai, ai: i, bi: j });
      i++;
    } else {
      ops.push({ tag: "+", text: bj, ai: i, bi: j });
      j++;
    }
  }
  while (i < n) {
    ops.push({ tag: "-", text: a[i] ?? "", ai: i, bi: j });
    i++;
  }
  while (j < m) {
    ops.push({ tag: "+", text: b[j] ?? "", ai: i, bi: j });
    j++;
  }

  const CONTEXT = 2;
  const keep = ops.map(() => false);
  for (let k = 0; k < ops.length; k++) {
    if (ops[k]?.tag === " ") continue;
    for (let c = Math.max(0, k - CONTEXT); c <= Math.min(ops.length - 1, k + CONTEXT); c++) {
      keep[c] = true;
    }
  }
  const lines = [];
  let inHunk = false;
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    if (!op || !keep[k]) {
      inHunk = false;
      continue;
    }
    if (!inHunk) {
      lines.push(`@@ kiosk line ~${op.ai + 1}, webc line ~${op.bi + 1} (normalized) @@`);
      inHunk = true;
    }
    lines.push(`${op.tag} ${op.text}`);
  }
  return ops.some((op) => op.tag !== " ") ? lines : [];
}

if (PAIRS.length !== EXPECTED_PAIR_COUNT) {
  console.error(`Pair manifest has ${PAIRS.length} entries, expected ${EXPECTED_PAIR_COUNT}. Update both together.`);
  process.exit(1);
}

console.log(`Comparing ${PAIRS.length} twin pairs (kiosk-keyboard <-> kiosk-keyboard-webc)...`);

let drifted = 0;
for (const pair of PAIRS) {
  for (const file of [pair.kiosk, pair.webc]) {
    if (!existsSync(file)) {
      console.error(`Missing twin file: ${file} (pair '${pair.label}'). A missing file is drift, not a skip.`);
      process.exit(1);
    }
  }
  const diff = unifiedDiff(normalize(pair.kiosk), normalize(pair.webc));
  if (diff.length > 0) {
    drifted++;
    console.error(`\nTwin drift in '${pair.label}':`);
    console.error(`--- ${path.relative(repoRoot, pair.kiosk)}`);
    console.error(`+++ ${path.relative(repoRoot, pair.webc)}`);
    for (const line of diff) console.error(line);
  }
}

if (drifted > 0) {
  console.error(
    `\n${drifted} twin pair${drifted === 1 ? "" : "s"} drifted. Sync the change into both packages (or, if the divergence is intentional, move the pair to the unchecked list at the top of tools/check-twin-drift.mjs with a reason).`,
  );
  process.exit(1);
}

console.log("All twin pairs are in sync.");
