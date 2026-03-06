import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const testRoots = [
  path.join(repoRoot, "packages", "hotkeys", "test"),
  path.join(repoRoot, "packages", "kiosk-keyboard", "test"),
  path.join(repoRoot, "packages", "kiosk-keyboard-webc", "test"),
];

const fileExtensions = new Set([".ts", ".js", ".mjs", ".cjs"]);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function isE2ETestFile(filePath) {
  return toPosixPath(filePath).includes("/test/e2e/");
}

const hardWaitPatterns = [
  {
    name: "browser.pause",
    regex: /\bbrowser\.pause\s*\(/g,
    message: "Use waitUntil/waitFor* conditions instead of browser.pause().",
  },
  {
    name: "await setTimeout sleep",
    regex:
      /await\s+new\s+Promise\s*\(\s*(?:\(\s*resolve\s*\)|resolve)\s*=>\s*setTimeout\s*\(\s*resolve\s*,\s*(\d+)\s*\)\s*\)\s*;?/g,
    message: "Use waitUntil/waitFor* conditions instead of fixed setTimeout sleeps in e2e tests.",
    fileFilter: isE2ETestFile,
    shouldReport: (match) => Number.parseInt(match[1], 10) > 0,
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
      if (pattern.fileFilter && !pattern.fileFilter(filePath)) {
        continue;
      }

      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(source)) !== null) {
        if (pattern.shouldReport && !pattern.shouldReport(match)) {
          continue;
        }

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
