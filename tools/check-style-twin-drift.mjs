#!/usr/bin/env node

/**
 * Stylesheet twin-parity check.
 *
 * `packages/kiosk-keyboard/src/themes/base/KioskKeyboard.less` (LESS, wrapped in
 * `@layer kiosk-keyboard`, LESS escapes around `min()`/`calc()`, class prefixes
 * `ui5KioskKeyboard`/`ui5KioskKey`) and
 * `packages/kiosk-keyboard-webc/src/themes/KioskKeyboard.css` (native CSS,
 * `:host`, native nesting, kebab-case `kiosk-keyboard`/`kiosk-key`) style the
 * same keyboard in two deliberately different idioms, so a text diff of the two
 * is meaningless and no byte-level guard covers them. What still must not drift
 * is the CONSUMER-FACING SURFACE: the set of public custom properties each twin
 * exposes. A styling knob added on one side and forgotten on the other is
 * exactly the drift this guard exists to catch.
 *
 * The two sides name the same property differently
 * (`--ui5KioskKeyboard-variantHintInset` vs
 * `--kiosk-keyboard-variant-hint-inset`), so names are compared as canonical
 * tokens: prefix dropped, separators stripped, lowercased. `--_`-prefixed
 * aliases are private implementation detail and are ignored (kiosk keeps a
 * fuller set of them). Every remaining property must exist on both sides or be
 * declared in that side's one-sided allowlist below, which is itself checked for
 * rot: an allowlisted property that has become symmetric, or that no longer
 * exists at all, fails the run.
 *
 * Names are collected from the whole file, comments included: the header block
 * in each twin is the published documentation for these properties, so a
 * property documented on one side and absent on the other is drift too.
 *
 * Everything else about the two stylesheets is UNCHECKED and compared by humans:
 * selectors, declarations, breakpoints, cascade layering, the UI5 theme
 * parameters (`@sapUiButtonBackground`) vs SAP CSS variables
 * (`var(--sapButton_Background, ...)`) split, and the responsive-tier markers
 * (kiosk root classes vs webc host attributes).
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const kioskStyles = path.join(repoRoot, "packages", "kiosk-keyboard", "src", "themes", "base", "KioskKeyboard.less");
const webcStyles = path.join(repoRoot, "packages", "kiosk-keyboard-webc", "src", "themes", "KioskKeyboard.css");

// Group 1 captures the `_` privacy marker, group 2 the name after the prefix.
const KIOSK_PROPERTY = /--(_?)ui5KioskKeyboard-([A-Za-z0-9]+)/g;
const WEBC_PROPERTY = /--(_?)kiosk-keyboard-([a-z0-9-]+)/g;

// Guard against an extractor that silently matches nothing (a renamed prefix, a
// broken pattern): two empty sets compare equal, so the run would pass while
// verifying nothing.
const EXPECTED_MIN_PROPERTIES = 35;

/**
 * Properties that legitimately exist in one twin only, as canonical tokens.
 *
 * The accent-variant popup is the whole asymmetry. webc slots plain
 * `ui5-button`s into a `ui5-popover` and therefore owns - and exposes - the
 * option row's wrapping layout, while kiosk renders the same popup as a themed
 * `sap/m/Popover` of `sap/m/Button`s in the UI5 static area where the framework
 * theme owns the frame; the kiosk header block documents that there is nothing
 * popup-specific to override there. `variantoptionwidth` is the anchor key's
 * rendered width, published by the control when the popup opens: public-prefixed
 * in webc because it is set on the host and has to cross the shadow boundary
 * onto the slotted options, private in kiosk
 * (`--_ui5KioskKeyboard-variantOptionWidth`) because it is set on the option
 * grid inside the control's own popover.
 *
 * @type {{ kioskOnly: string[]; webcOnly: string[] }}
 */
const PROPERTY_PARITY = {
  kioskOnly: [],
  webcOnly: ["variantpopupgap", "variantpopuppadding", "variantpopupmaxwidth", "variantoptionwidth"],
};

/**
 * Collects the public custom properties one twin exposes, keyed by canonical
 * token so the camelCase and kebab-case conventions compare directly.
 *
 * @param {string} filePath absolute path to the stylesheet
 * @param {RegExp} pattern global matcher for that twin's property prefix
 * @returns {Map<string, string>} canonical token -> property name without prefix
 */
function publicProperties(filePath, pattern) {
  const found = new Map();
  for (const match of readFileSync(filePath, "utf8").matchAll(pattern)) {
    const isPrivate = match[1];
    const name = match[2];
    if (isPrivate || !name) continue;
    found.set(name.replaceAll("-", "").toLowerCase(), name);
  }
  return found;
}

for (const file of [kioskStyles, webcStyles]) {
  if (!existsSync(file)) {
    console.error(`Missing twin stylesheet: ${file}. A missing file is drift, not a skip.`);
    process.exit(1);
  }
}

const kiosk = publicProperties(kioskStyles, KIOSK_PROPERTY);
const webc = publicProperties(webcStyles, WEBC_PROPERTY);

for (const [label, found] of /** @type {[string, Map<string, string>][]} */ ([
  ["kiosk", kiosk],
  ["webc", webc],
])) {
  if (found.size < EXPECTED_MIN_PROPERTIES) {
    console.error(
      `Only ${found.size} public custom properties found in the ${label} stylesheet, expected at least ${EXPECTED_MIN_PROPERTIES}. The prefix changed or the extractor in tools/check-style-twin-drift.mjs is broken.`,
    );
    process.exit(1);
  }
}

const errors = [];

/** @param {{ kioskOnly: string[]; webcOnly: string[] }} spec */
function checkPropertyParity(spec) {
  const kioskAllowed = new Set(spec.kioskOnly);
  const webcAllowed = new Set(spec.webcOnly);

  for (const [token, name] of kiosk) {
    if (webc.has(token) || kioskAllowed.has(token)) continue;
    errors.push(
      `--ui5KioskKeyboard-${name} has no webc counterpart. Add the kebab-case --kiosk-keyboard-* twin to the webc stylesheet, or list "${token}" in kioskOnly with a reason in tools/check-style-twin-drift.mjs.`,
    );
  }
  for (const [token, name] of webc) {
    if (kiosk.has(token) || webcAllowed.has(token)) continue;
    errors.push(
      `--kiosk-keyboard-${name} has no kiosk counterpart. Add the camelCase --ui5KioskKeyboard-* twin to the kiosk stylesheet, or list "${token}" in webcOnly with a reason in tools/check-style-twin-drift.mjs.`,
    );
  }
}

/**
 * Fails on a one-sided allowlist entry whose asymmetry is gone, either because
 * the property became symmetric or because it no longer exists at all, so the
 * allowlist cannot quietly rot into a permanent hole in the check.
 *
 * @param {string[]} tokens canonical tokens allowlisted for `owner`
 * @param {"kiosk" | "webc"} owner the twin expected to declare them
 */
function checkAllowlistFreshness(tokens, owner) {
  const own = owner === "kiosk" ? kiosk : webc;
  const other = owner === "kiosk" ? webc : kiosk;
  for (const token of tokens) {
    if (!own.has(token)) {
      errors.push(
        `one-sided "${token}" no longer exists in the ${owner} stylesheet. Drop it from ${owner}Only in tools/check-style-twin-drift.mjs.`,
      );
    } else if (other.has(token)) {
      errors.push(
        `one-sided "${token}" now exists in both twins. Drop it from ${owner}Only in tools/check-style-twin-drift.mjs so the pair is compared.`,
      );
    }
  }
}

checkPropertyParity(PROPERTY_PARITY);
checkAllowlistFreshness(PROPERTY_PARITY.kioskOnly, "kiosk");
checkAllowlistFreshness(PROPERTY_PARITY.webcOnly, "webc");

if (errors.length > 0) {
  console.error(`Stylesheet twin-drift check failed (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `Stylesheet twins in parity (${kiosk.size} kiosk / ${webc.size} webc public custom properties, modulo naming convention).`,
);
