#!/usr/bin/env node

/**
 * Message-bundle invariants for both keyboard packages.
 *
 * Two things about `src/i18n/messagebundle*.properties` are invisible in review and
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
 *    resolves with `bIgnoreKeyFallback`, so a key that was never declared returns that
 *    fallback with no warning: an English suite cannot tell it apart from a translation,
 *    and invariant 2 stays green because a key missing from the default bundle is
 *    equally missing from every locale. Only every locale except English is wrong, and
 *    only in an ARIA announcement.
 *
 * Values are deliberately NOT compared: translations differ, and `{0}` placeholder
 * counts are already load-bearing in the tests that assert the rendered text.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const PACKAGES = ["kiosk-keyboard", "kiosk-keyboard-webc"];
const DEFAULT_BUNDLE = "messagebundle.properties";
/** `getText("KEY"` - the only form either package uses to name a bundle key. */
const GET_TEXT_KEY = /\bgetText\(\s*"([A-Za-z0-9_]+)"/g;

const errors = [];

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
 * Every `getText("KEY"` literal under a package's `src/`, mapped to where it was asked
 * for. `src/generated/` is skipped: it is build output, rebuilt from the bundle itself.
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
    const source = readFileSync(file, "utf8");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(GET_TEXT_KEY)) {
        const key = match[1];
        if (key === undefined || found.has(key)) continue;
        found.set(
          key,
          `packages/${pkg}/${path.relative(path.join(repoRoot, "packages", pkg), file).replace(/\\/g, "/")}:${index + 1}`,
        );
      }
    });
  }
  return found;
}

let bundleCount = 0;
let keyCount = 0;

for (const pkg of PACKAGES) {
  const dir = path.join(repoRoot, "packages", pkg, "src", "i18n");
  const bundles = readdirSync(dir).filter((name) => /^messagebundle.*\.properties$/.test(name));
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

if (errors.length > 0) {
  console.error(`Message-bundle check failed (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`Message bundles in order (${bundleCount} bundles, ${keyCount} keys, all ASCII).`);
