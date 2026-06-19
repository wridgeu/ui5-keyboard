#!/usr/bin/env node

/**
 * Twin-drift check for the deliberately duplicated kiosk keyboard packages.
 *
 * `packages/kiosk-keyboard` (UI5 control) and `packages/kiosk-keyboard-webc`
 * (web component) intentionally do not share code; a set of modules is
 * duplicated by hand and must stay logically identical. Hand-syncing has
 * already missed one-sided fixes, so this check compares each twin pair after
 * normalizing away the differences that are legitimate (comments, blank lines,
 * `.js` ESM import suffixes, logging idioms) and fails with a unified diff when
 * anything else drifts. Intra-line spacing is left to oxfmt (run before this
 * check in the same pipeline), so the normalizer does not re-collapse it.
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

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
  const lines = [];
  for (let line of stripComments(readFileSync(filePath, "utf8")).split("\n")) {
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
 * Renders a unified diff of two normalized line lists for human consumption,
 * delegated to `git diff --no-index` (git is always available here, so there
 * is no hand-rolled diff to maintain). The drift decision is made by the caller
 * via line equality; this is best-effort output only and always returns a
 * non-empty string so a git hiccup can never read as "in sync". Reported line
 * numbers are positions in the normalized form, not the source.
 *
 * @param {string[]} kioskLines
 * @param {string[]} webcLines
 * @returns {string} diff hunks (or a git-failure notice)
 */
function renderDiff(kioskLines, webcLines) {
  const dir = mkdtempSync(path.join(tmpdir(), "twin-drift-"));
  try {
    const kioskTmp = path.join(dir, "kiosk");
    const webcTmp = path.join(dir, "webc");
    writeFileSync(kioskTmp, `${kioskLines.join("\n")}\n`);
    writeFileSync(webcTmp, `${webcLines.join("\n")}\n`);
    // `git diff --no-index` exits 1 when the files differ, so the diff arrives
    // on the thrown error's stdout. stderr is piped (not inherited) so git's
    // cosmetic LF/CRLF working-copy warnings for these temp files stay out of
    // our output.
    execFileSync("git", ["diff", "--no-index", "--no-color", "--", kioskTmp, webcTmp], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return "(identical after normalization)"; // unreachable: caller only renders real drift
  } catch (err) {
    const e = /** @type {{ stdout?: string; message?: string }} */ (err);
    // Drop git's temp-path file headers; keep the @@ hunks and +/- lines.
    const hunks = (e.stdout ?? "")
      .split("\n")
      .filter((line) => !/^(?:diff --git |index |--- |\+\+\+ )/.test(line))
      .join("\n")
      .trim();
    return hunks || `(git diff failed: ${e.message || "unknown error"})`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
  const kioskLines = normalize(pair.kiosk);
  const webcLines = normalize(pair.webc);
  if (kioskLines.join("\n") !== webcLines.join("\n")) {
    drifted++;
    console.error(`\nTwin drift in '${pair.label}' (normalized):`);
    console.error(`--- ${path.relative(repoRoot, pair.kiosk)}`);
    console.error(`+++ ${path.relative(repoRoot, pair.webc)}`);
    console.error(renderDiff(kioskLines, webcLines));
  }
}

if (drifted > 0) {
  console.error(
    `\n${drifted} twin pair${drifted === 1 ? "" : "s"} drifted. Sync the change into both packages (or, if the divergence is intentional, move the pair to the unchecked list at the top of tools/check-twin-drift.mjs with a reason).`,
  );
  process.exit(1);
}

console.log("All twin pairs are in sync.");
