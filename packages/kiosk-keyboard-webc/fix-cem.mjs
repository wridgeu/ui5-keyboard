#!/usr/bin/env node

// Post-processes the CEM (custom-elements.json) to fix two issues caused by the
// @ui5/webcomponents-tools CEM analyzer when handling re-exports:
//
// 1. The `custom-element-definition` export only appears on the declaring module
//    (KioskKeyboardCore.js), not on the re-exporting main entry (KioskKeyboard.js).
//    The ui5-tooling-modules middleware resolves the main entry from `package.json`
//    and looks for the CE def export there. Without it, the middleware bundles the
//    raw class without generating a WebComponent.extend() wrapper.
//
// 2. The analyzer wraps re-export `declaration.module` paths in extra quotes:
//    `"\"./KioskKeyboardCore.js\""` instead of `"./KioskKeyboardCore.js"`.
//    This prevents the middleware from following the re-export chain.

import { readFileSync, writeFileSync } from "node:fs";

const CEM_PATH = "dist/custom-elements.json";
const MAIN_MODULE = "dist/KioskKeyboard.js";
const CORE_MODULE = "dist/KioskKeyboardCore.js";

const cem = JSON.parse(readFileSync(CEM_PATH, "utf8"));

const mainMod = cem.modules.find((m) => m.path === MAIN_MODULE);
const coreMod = cem.modules.find((m) => m.path === CORE_MODULE);

if (!mainMod) {
  console.error(`fix-cem: could not find ${MAIN_MODULE} in CEM`);
  process.exit(1);
}

// After the class was flattened into KioskKeyboard.ts, the core module no
// longer exists. The CEM analyzer now places the custom-element-definition
// directly on KioskKeyboard.js, so both fixes below become unnecessary.
// Exit gracefully -- Task 2 will remove this script entirely.
if (!coreMod) {
  process.stdout.write("fix-cem: KioskKeyboardCore.js not found in CEM (class flattened), nothing to fix\n");
  process.exit(0);
}

// 1. Propagate the custom-element-definition export to the main entry
const ceDef = coreMod.exports?.find((e) => e.kind === "custom-element-definition");
if (ceDef) {
  const alreadyHasCeDef = mainMod.exports?.some((e) => e.kind === "custom-element-definition");
  if (!alreadyHasCeDef) {
    mainMod.exports = mainMod.exports || [];
    mainMod.exports.push({
      kind: "custom-element-definition",
      name: ceDef.name,
      declaration: {
        name: ceDef.declaration.name,
        module: MAIN_MODULE,
      },
    });
    process.stdout.write(`fix-cem: propagated custom-element-definition for <${ceDef.name}> to ${MAIN_MODULE}\n`);
  }
}

// 2. Fix extra-quoted declaration.module paths throughout the CEM
let fixCount = 0;
for (const mod of cem.modules) {
  for (const exp of mod.exports || []) {
    if (exp.declaration?.module && /^".*"$/.test(exp.declaration.module)) {
      exp.declaration.module = exp.declaration.module.slice(1, -1);
      fixCount++;
    }
  }
}
if (fixCount > 0) {
  process.stdout.write(`fix-cem: fixed ${fixCount} extra-quoted declaration.module path(s)\n`);
}

writeFileSync(CEM_PATH, JSON.stringify(cem, null, 2) + "\n");
