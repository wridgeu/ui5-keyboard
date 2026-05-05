import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const oxlintBin = path.join(repoRoot, "node_modules", "oxlint", "bin", "oxlint");

const FIXTURE_DISABLE_PREFIX = "/* oxlint-disable no-unused-vars */\n";

function runOxlintFix(t, fileName, source) {
  const tempDir = fs.mkdtempSync(path.join(repoRoot, "tools", ".tmp-oxlint-custom-rules-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, FIXTURE_DISABLE_PREFIX + source, "utf8");

  const result = spawnSync(process.execPath, [oxlintBin, "--config", ".oxlintrc.json", "--fix", filePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  assert.equal(
    result.status,
    0,
    `oxlint exited with ${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
  const fixed = fs.readFileSync(filePath, "utf8");
  if (!fixed.startsWith(FIXTURE_DISABLE_PREFIX)) {
    throw new Error(`fixture lost its oxlint-disable prefix:\n${fixed}`);
  }
  return fixed.slice(FIXTURE_DISABLE_PREFIX.length);
}

test("no-redundant-boolean-return fixes complex positive branch safely", (t) => {
  const source = [
    "function isReady(foo, bar) {",
    "  if (foo && bar) {",
    "    return true;",
    "  } else {",
    "    return false;",
    "  }",
    "}",
    "",
  ].join("\n");

  const fixed = runOxlintFix(t, "redundant-boolean.ts", source);
  assert.equal(fixed, ["function isReady(foo, bar) {", "  return !!(foo && bar);", "}", ""].join("\n"));
});

test("no-redundant-boolean-return fixes inverse branch safely", (t) => {
  const source = [
    "function isDisabled(value) {",
    "  if (value?.enabled) return false;",
    "  else return true;",
    "}",
    "",
  ].join("\n");

  const fixed = runOxlintFix(t, "inverse-boolean.ts", source);
  assert.equal(fixed, ["function isDisabled(value) {", "  return !(value?.enabled);", "}", ""].join("\n"));
});

test("no-em-dash fixes strings and comments without touching delimiters", (t) => {
  const emDash = String.fromCodePoint(0x2014);
  const source = [`// alpha ${emDash} beta`, 'const label = "one ' + emDash + ' two";', ""].join("\n");

  const fixed = runOxlintFix(t, "em-dash.ts", source);
  assert.equal(fixed, ["// alpha -- beta", 'const label = "one - two";', ""].join("\n"));
});
