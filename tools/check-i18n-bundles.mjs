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
 *
 * Values are deliberately NOT compared: translations differ, and `{0}` placeholder
 * counts are already load-bearing in the tests that assert the rendered text.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const PACKAGES = ["kiosk-keyboard", "kiosk-keyboard-webc"];
const DEFAULT_BUNDLE = "messagebundle.properties";

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
}

if (errors.length > 0) {
  console.error(`Message-bundle check failed (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`Message bundles in order (${bundleCount} bundles, ${keyCount} keys, all ASCII).`);
