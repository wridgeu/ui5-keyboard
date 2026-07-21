#!/usr/bin/env node

/**
 * DOM-contract twin-parity check.
 *
 * `packages/kiosk-keyboard/src/internal/dom-contract.ts` (UI5 light DOM) and
 * `packages/kiosk-keyboard-webc/src/core/dom-contract.ts` (web-component shadow
 * DOM) are hand-maintained parallel maps of class names, data attributes and
 * selector helpers. They intentionally differ in the STRING VALUES (kiosk uses a
 * camelCase-BEM convention, webc uses kebab-BEM), which is why the byte-level
 * `check-twin-drift.mjs` lists `dom-contract` as unchecked. What still must not
 * drift is the SET OF SEMANTIC KEYS: a key added to one twin and forgotten in
 * the other is the class of bug that caused #98/#108.
 *
 * This guard compares keys, not values, for `classes` and `selectors`: every
 * CORE key must exist on both sides, and every remaining key must be declared in
 * that side's PLATFORM_ONLY allowlist (light-DOM vs shadow-DOM / ::part
 * realities legitimately differ). An unclassified key fails and forces an
 * explicit "shared vs platform-only" decision. `attributes` is the real
 * cross-DOM wire and test contract, so it is compared by key AND value. The
 * width helper is checked for injectivity so a lossy encoding cannot return.
 *
 * Zero new dependencies: both contract modules are erasable-syntax-only
 * TypeScript, so Node (>=24, native type stripping) imports them directly. Keep
 * them erasable (no enums, decorators, namespaces or parameter properties) or
 * this import must move to a transpile step.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");

/**
 * @param {string} rel repo-relative path to a dom-contract module
 * @returns {Promise<any>} the frozen KIOSK_KEYBOARD_DOM object
 */
async function loadContract(rel) {
  const mod = await import(pathToFileURL(path.join(repoRoot, rel)).href);
  return mod.KIOSK_KEYBOARD_DOM;
}

const kiosk = await loadContract("packages/kiosk-keyboard/src/internal/dom-contract.ts");
const webc = await loadContract("packages/kiosk-keyboard-webc/src/core/dom-contract.ts");

/** @type {string[]} */
const errors = [];

/**
 * Keys that MUST exist on both twins (CORE), plus the keys each side is allowed
 * to carry alone (PLATFORM_ONLY). Any key present on a side but absent from both
 * its CORE and PLATFORM_ONLY lists fails the check.
 *
 * @typedef {{ core: string[]; kioskOnly: string[]; webcOnly: string[] }} Parity
 * @type {{ classes: Parity; selectors: Parity }}
 */
const KEY_PARITY = {
  classes: {
    core: [
      "root",
      "rootDocked",
      "rootDisabled",
      "row",
      "key",
      "keyShiftActive",
      "keyCapsLock",
      "keyHighlight",
      "keyLabel",
      "keyLabelGlyph",
      "keyLabelMulti",
      "keyIcon",
      "keyDual",
      "variantPopup",
    ],
    // Light-DOM only: no shadow host, a static-area popover, an explicit closed
    // state and the JS-driven height-responsive classes.
    kioskOnly: [
      "rootClosed",
      "rootCqShort",
      "rootCqTiny",
      "keySpace",
      "keyPressed",
      "keyVariantAnchor",
      "variantPopover",
      "variantOption",
    ],
    // Shadow-DOM only: host-level classes, the aria-hidden host, numpad/numeric
    // host variants, the live region and the in-shadow variant popup host.
    webcOnly: [
      "rootHidden",
      "rootNumpad",
      "rootNumeric",
      "hostCqShort",
      "hostCqTiny",
      "liveRegion",
      "variantPopupHost",
    ],
  },
  selectors: {
    core: [
      "root",
      "row",
      "key",
      "focusableKey",
      "keyByValue",
      "keyByShiftValue",
      "variantPopover",
      "variantPopup",
      "variantOption",
    ],
    kioskOnly: [],
    webcOnly: ["keyHook", "variantOptionByIndex"],
  },
};

/**
 * @param {"classes" | "selectors"} group
 * @param {{ core: string[]; kioskOnly: string[]; webcOnly: string[] }} spec
 */
function checkKeyParity(group, spec) {
  const kioskKeys = Object.keys(kiosk[group]);
  const webcKeys = Object.keys(webc[group]);
  const kioskAllowed = new Set([...spec.core, ...spec.kioskOnly]);
  const webcAllowed = new Set([...spec.core, ...spec.webcOnly]);

  for (const k of spec.core) {
    if (!kioskKeys.includes(k)) errors.push(`${group}: CORE key "${k}" missing from kiosk`);
    if (!webcKeys.includes(k)) errors.push(`${group}: CORE key "${k}" missing from webc`);
  }
  for (const k of kioskKeys) {
    if (!kioskAllowed.has(k)) {
      errors.push(
        `${group}: kiosk key "${k}" is unclassified. Add it to CORE (and give it a webc twin) or to kiosk PLATFORM_ONLY with a reason in tools/check-dom-contract-drift.mjs.`,
      );
    }
  }
  for (const k of webcKeys) {
    if (!webcAllowed.has(k)) {
      errors.push(
        `${group}: webc key "${k}" is unclassified. Add it to CORE (and give it a kiosk twin) or to webc PLATFORM_ONLY with a reason in tools/check-dom-contract-drift.mjs.`,
      );
    }
  }
}

/** `attributes` is the cross-DOM wire contract: compare keys AND values. */
function checkAttributesIdentical() {
  const keys = new Set([...Object.keys(kiosk.attributes), ...Object.keys(webc.attributes)]);
  for (const k of keys) {
    const kv = kiosk.attributes[k];
    const wv = webc.attributes[k];
    if (kv === undefined) errors.push(`attributes: "${k}" present in webc but missing from kiosk`);
    else if (wv === undefined) errors.push(`attributes: "${k}" present in kiosk but missing from webc`);
    else if (kv !== wv) errors.push(`attributes: "${k}" differs (kiosk "${kv}" vs webc "${wv}")`);
  }
}

/**
 * The full `KeyWidth` vocabulary from `types.ts`. The width-to-DOM mapping must
 * be injective (no two distinct tokens collide), so a lossy encoding cannot
 * strand two widths on one class. Skipped once `keyWidthClass` is gone (a
 * verbatim `data-key-span` attribute cannot be lossy).
 */
const KEY_WIDTHS = ["1.25", "1.5", "1.75", "2", "2.25", "2.75", "space"];

function checkWidthInjective() {
  for (const [name, dom] of [
    ["kiosk", kiosk],
    ["webc", webc],
  ]) {
    if (typeof dom.keyWidthClass !== "function") continue;
    const outputs = KEY_WIDTHS.map((w) => dom.keyWidthClass(w));
    if (new Set(outputs).size !== KEY_WIDTHS.length) {
      errors.push(
        `${name}: keyWidthClass is not injective over KeyWidth [${KEY_WIDTHS.join(", ")}] -> [${outputs.join(", ")}]`,
      );
    }
  }
}

checkKeyParity("classes", KEY_PARITY.classes);
checkKeyParity("selectors", KEY_PARITY.selectors);
checkAttributesIdentical();
checkWidthInjective();

if (errors.length > 0) {
  console.error(`DOM-contract drift check failed (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("DOM-contract twins in parity (classes/selectors key sets, attributes key+value, width injectivity).");
