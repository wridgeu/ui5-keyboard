/**
 * Post-process the Custom Elements Manifest after generation.
 *
 * 1. Normalize Windows backslash path separators in type references.
 *
 * 2. Fix quoted module paths in re-export declarations. The CEM analyzer
 *    wraps relative re-export paths in extra quotes.
 *
 * 3. Ensure the re-exporting module (KioskKeyboard.js) carries the
 *    custom-element-definition export so ui5-tooling-modules can find
 *    the class by the main entry path.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { posix } from "node:path";

const cemPath = "dist/custom-elements.json";
let content = readFileSync(cemPath, "utf8");

// 1. Normalize backslashes in raw text (before JSON.parse)
content = content.replaceAll("\\\\", "/");

const cem = JSON.parse(content);

// 2. Strip extra quotes from module paths in all exports/declarations.
//    The CEM analyzer wraps re-export paths like: "\"./Foo.js\"" -> "./Foo.js"
const stripQuotes = (s) => (typeof s === "string" ? s.replace(/^"(.*)"$/, "$1") : s);

for (const mod of cem.modules) {
  for (const exp of mod.exports ?? []) {
    if (exp.declaration?.module) {
      exp.declaration.module = stripQuotes(exp.declaration.module);
    }
  }
}

// Helper: resolve a relative module path against a parent module's directory.
const resolveRef = (ref, parentPath) => {
  if (!ref || !ref.startsWith(".")) return ref;
  return posix.join(posix.dirname(parentPath), ref);
};

// 3. Propagate custom-element-definition exports to re-exporting modules.
const ceDefs = [];
for (const mod of cem.modules) {
  for (const exp of mod.exports ?? []) {
    if (exp.kind === "custom-element-definition") {
      ceDefs.push({ sourcePath: mod.path, className: exp.declaration?.name, exp });
    }
  }
}

for (const mod of cem.modules) {
  for (const exp of mod.exports ?? []) {
    if (exp.kind !== "js" || !exp.declaration?.module) continue;
    const resolvedTarget = resolveRef(exp.declaration.module, mod.path);
    const ceDef = ceDefs.find((ce) => ce.sourcePath === resolvedTarget);
    if (!ceDef || ceDef.sourcePath === mod.path) continue;
    const alreadyHas = (mod.exports ?? []).some(
      (e) => e.kind === "custom-element-definition" && e.name === ceDef.exp.name,
    );
    if (!alreadyHas) {
      mod.exports.push({
        kind: "custom-element-definition",
        name: ceDef.exp.name,
        declaration: { name: ceDef.className, module: mod.path },
      });
    }
  }
}

const normalized = JSON.stringify(cem, null, 2);
writeFileSync(cemPath, normalized);
