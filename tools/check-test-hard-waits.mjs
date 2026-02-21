import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const testRoots = [
  path.join(repoRoot, "packages", "hotkeys", "test"),
  path.join(repoRoot, "packages", "kiosk-keyboard", "test"),
];

const fileExtensions = new Set([".ts", ".js", ".mjs", ".cjs"]);
const hardWaitPatterns = [
  {
    name: "browser.pause",
    regex: /\bbrowser\.pause\s*\(/g,
    message: "Use waitUntil/waitFor* conditions instead of browser.pause().",
  },
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (entry.isFile() && fileExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function getLineNumber(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

const violations = [];

for (const root of testRoots) {
  if (!fs.existsSync(root)) continue;

  for (const filePath of walk(root)) {
    const source = fs.readFileSync(filePath, "utf8");
    for (const pattern of hardWaitPatterns) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(source)) !== null) {
        violations.push({
          filePath,
          line: getLineNumber(source, match.index),
          name: pattern.name,
          message: pattern.message,
        });
      }
    }
  }
}

if (violations.length === 0) {
  console.log("No test hard-wait violations found.");
  process.exit(0);
}

console.error("Test hard-wait violations found:");
for (const violation of violations) {
  const relative = path.relative(repoRoot, violation.filePath);
  console.error(`- ${relative}:${violation.line} (${violation.name}) ${violation.message}`);
}
process.exit(1);
