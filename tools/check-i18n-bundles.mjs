#!/usr/bin/env node

/**
 * Message-bundle invariants for both keyboard packages.
 *
 * Three things about `src/i18n/messagebundle*.properties` are invisible in review and
 * silent at runtime, so they are checked here rather than noticed later:
 *
 * 1. **ASCII only.** Every non-ASCII character is written as a `\\uXXXX` escape. A raw
 *    UTF-8 value looks correct in an editor and in a diff, and decodes to mojibake as
 *    soon as the bundle is served as anything but UTF-8: the UI5 twin loads it through
 *    `Properties.create` -> `LoaderExtensions.loadResource({dataType:"text"})`, which
 *    sets no charset, leaving the decoding to whatever the response declares. An ASCII
 *    bundle decodes identically under all of them. The failure lands in an ARIA
 *    announcement, which nothing on screen would show was wrong.
 * 2. **Key parity.** Every locale bundle declares exactly the keys of its package's
 *    default bundle. A missing key falls back to the untranslated default silently, and
 *    an orphan key is dead weight nothing will ever read.
 * 3. **Call-site coverage.** Every key a package's `src/` asks for by literal exists in
 *    that package's default bundle. `getText` takes a hardcoded English fallback and
 *    resolves with `bIgnoreKeyFallback`, so an undeclared key returns that fallback with
 *    no warning: an English suite cannot tell it apart from a translation, and invariant
 *    2 stays green because a key missing from the default bundle is equally missing from
 *    every locale. Every locale but English then gets untranslated text.
 * 4. **Twin value parity.** A key the two packages share carries the same value in the
 *    same locale. The twins ship parallel bundles, so a wording fix applied to one and
 *    forgotten in the other leaves the two keyboards saying different things - and every
 *    other guard stays green, because invariants 1-3 are per-package and
 *    `check-twin-drift.mjs` lists no i18n path. Compared over the INTERSECTION of keys:
 *    the two surfaces name a few things differently (`ARIA_CAPS_LOCK` against
 *    `KEY_CAPS_LOCK`), which is a naming difference rather than drift.
 *
 * Values are otherwise NOT compared: locales differ from the default by definition, and
 * `{0}` placeholder counts are already load-bearing in the tests that assert the
 * rendered text.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const KIOSK_PKG = "kiosk-keyboard";
const WEBC_PKG = "kiosk-keyboard-webc";
const PACKAGES = [KIOSK_PKG, WEBC_PKG];
const DEFAULT_BUNDLE = "messagebundle.properties";

const errors = [];

/** Message bundles carry the default plus one file per locale; nothing else in the folder does. */
const isBundle = (name) => /^messagebundle.*\.properties$/.test(name);

/** The keys a bundle declares, in file order. Comment and blank lines are skipped. */
function readKeys(file) {
  const keys = [];
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) continue;
    keys.push(trimmed.split("=", 1)[0]);
  }
  return keys;
}

/**
 * key -> value for one bundle. Values are compared as written, escapes and all, which
 * is exactly what a reviewer sees in the diff.
 */
function readEntries(file) {
  const entries = new Map();
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) continue;
    const split = trimmed.indexOf("=");
    if (split === -1) continue;
    entries.set(trimmed.slice(0, split), trimmed.slice(split + 1));
  }
  return entries;
}

/** Reports every line carrying a character a non-UTF-8 read would mangle. */
function checkAscii(file, relative) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    // Iterated by code point rather than matched: a regex for "outside ASCII" has to
    // name the control range, which the lint rules reject for good reasons of their own.
    const offending = [...line]
      .map((char) => ({ char, code: char.codePointAt(0) ?? 0 }))
      .filter(({ code }) => code > 0x7f);
    if (offending.length === 0) return;
    const escapes = [...new Set(offending.map(({ code }) => code))].map(
      (code) => `\\u${code.toString(16).padStart(4, "0")}`,
    );
    const raw = offending.map(({ char }) => char).join("");
    errors.push(`${relative}:${index + 1} carries raw non-ASCII (${raw}). Write it as ${escapes.join(" ")}.`);
  });
}

/**
 * Records every `getText("KEY"` on one line into `found`, keyed by the first site that
 * asked for it.
 *
 * Working a line at a time is what makes the comment guard possible: a
 * `getText("EXAMPLE_KEY", ...)` in a doc-block is an example, not a request. Calls whose
 * key is a variable (`getText(entry[0], ...)`) are deliberately invisible here - their
 * keys come from tables this cannot follow, and the parity invariant covers the bundles
 * they read instead.
 *
 * @param {string} line one line of TypeScript source
 * @param {string} site `package/path:line`, recorded as where the key was first asked for
 * @param {Map<string, string>} found key -> first call site
 */
function collectLineKeys(line, site, found) {
  const trimmed = line.trim();
  if (trimmed.startsWith("*") || trimmed.startsWith("//")) return;

  const CALL = 'getText("';
  let at = line.indexOf(CALL);
  while (at !== -1) {
    const start = at + CALL.length;
    const end = line.indexOf('"', start);
    if (end === -1) return; // an unterminated literal is not a key we can name
    const key = line.slice(start, end);
    if (!found.has(key)) found.set(key, site);
    at = line.indexOf(CALL, end);
  }
}

/**
 * Every key a package's `src/` asks for by literal. `src/generated/` is skipped: it is
 * build output, rebuilt from the bundle itself.
 *
 * @param {string} dir directory to walk
 * @param {string} pkg package name, for the reported path
 * @param {Map<string, string>} found key -> first call site
 * @returns {Map<string, string>} the same map
 */
function collectRequestedKeys(dir, pkg, found = new Map()) {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) {
      if (name !== "generated") collectRequestedKeys(file, pkg, found);
      continue;
    }
    if (!name.endsWith(".ts") || name.endsWith(".d.ts")) continue;
    const relative = path
      .relative(path.join(repoRoot, "packages", pkg), file)
      .split(path.sep)
      .join("/");
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => collectLineKeys(line, `packages/${pkg}/${relative}:${index + 1}`, found));
  }
  return found;
}

let bundleCount = 0;
let keyCount = 0;

for (const pkg of PACKAGES) {
  const dir = path.join(repoRoot, "packages", pkg, "src", "i18n");
  const bundles = readdirSync(dir).filter(isBundle);
  if (!bundles.includes(DEFAULT_BUNDLE)) {
    errors.push(`packages/${pkg}/src/i18n has no ${DEFAULT_BUNDLE} to compare the locales against.`);
    continue;
  }

  const expected = new Set(readKeys(path.join(dir, DEFAULT_BUNDLE)));
  keyCount += expected.size;

  for (const name of bundles) {
    const file = path.join(dir, name);
    const relative = `packages/${pkg}/src/i18n/${name}`;
    bundleCount++;
    checkAscii(file, relative);

    if (name === DEFAULT_BUNDLE) continue;
    const declared = new Set(readKeys(file));
    for (const key of expected) {
      if (!declared.has(key)) errors.push(`${relative} is missing "${key}", so that locale falls back to English.`);
    }
    for (const key of declared) {
      if (!expected.has(key)) errors.push(`${relative} declares "${key}", which ${DEFAULT_BUNDLE} does not.`);
    }
  }

  for (const [key, site] of collectRequestedKeys(path.join(repoRoot, "packages", pkg, "src"), pkg)) {
    if (expected.has(key)) continue;
    errors.push(
      `${site} asks for "${key}", which packages/${pkg}/src/i18n/${DEFAULT_BUNDLE} does not declare, so every locale gets the hardcoded fallback.`,
    );
  }
}

// Invariant 4: the shared keys agree across the twins, locale by locale.
let sharedCount = 0;
const i18nDir = (pkg) => path.join(repoRoot, "packages", pkg, "src", "i18n");
// The union of both listings, because a locale that exists in one twin only is the
// drift this checks for: enumerating from one side would never open the file that
// has no counterpart, and invariants 1-3 are per-package and would stay green.
const localeBundles = [...new Set(PACKAGES.flatMap((pkg) => readdirSync(i18nDir(pkg))))].filter(isBundle);
for (const name of localeBundles) {
  const absent = PACKAGES.filter((pkg) => !existsSync(path.join(i18nDir(pkg), name)));
  for (const pkg of absent) {
    errors.push(`packages/${pkg}/src/i18n/${name} is missing, so that locale exists in only one twin.`);
  }
  if (absent.length > 0) continue;
  const kioskEntries = readEntries(path.join(i18nDir(KIOSK_PKG), name));
  const webcEntries = readEntries(path.join(i18nDir(WEBC_PKG), name));
  for (const [key, value] of kioskEntries) {
    const twin = webcEntries.get(key);
    if (twin === undefined) continue;
    if (name === DEFAULT_BUNDLE) sharedCount++;
    if (twin === value) continue;
    errors.push(
      `"${key}" differs between the twins in ${name}: ${KIOSK_PKG} has "${value}", ${WEBC_PKG} has "${twin}". ` +
        `A wording change has to land in both bundles.`,
    );
  }
}

if (errors.length > 0) {
  console.error(`Message-bundle check failed (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `Message bundles in order (${bundleCount} bundles, ${keyCount} keys, all ASCII; ${sharedCount} shared keys agree across the twins).`,
);
