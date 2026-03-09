import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

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

// ── AST helpers ──

/** Returns true if the node is a property-access call like `obj.method(...)`. */
function isMethodCall(node, objName, methodName) {
  if (!ts.isCallExpression(node)) return false;
  const expr = node.expression;
  if (!ts.isPropertyAccessExpression(expr)) return false;
  return ts.isIdentifier(expr.expression) && expr.expression.text === objName && expr.name.text === methodName;
}

/**
 * Returns true if the node is `await new Promise(resolve => setTimeout(resolve, N))`
 * where N > 0.
 */
function isAwaitedSetTimeoutSleep(node) {
  // Must be an await expression
  if (!ts.isAwaitExpression(node)) return false;
  const inner = node.expression;

  // Must be `new Promise(...)`
  if (!ts.isNewExpression(inner)) return false;
  if (!ts.isIdentifier(inner.expression) || inner.expression.text !== "Promise") return false;

  const args = inner.arguments;
  if (!args || args.length !== 1) return false;
  const callback = args[0];

  // Arrow or function: (resolve) => setTimeout(resolve, N)
  if (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) return false;

  const body = callback.body;
  // Body is the setTimeout call directly (concise arrow) or a block with a single statement
  let callExpr;
  if (ts.isCallExpression(body)) {
    callExpr = body;
  } else if (ts.isBlock(body) && body.statements.length === 1) {
    const stmt = body.statements[0];
    if (ts.isExpressionStatement(stmt) && ts.isCallExpression(stmt.expression)) {
      callExpr = stmt.expression;
    }
  }
  if (!callExpr) return false;

  // Must be setTimeout(resolve, N)
  if (!ts.isIdentifier(callExpr.expression) || callExpr.expression.text !== "setTimeout") return false;
  const stArgs = callExpr.arguments;
  if (!stArgs || stArgs.length < 2) return false;

  const delay = stArgs[1];
  if (!ts.isNumericLiteral(delay)) return false;
  return Number.parseInt(delay.text, 10) > 0;
}

// ── Rule definitions ──

const rules = [
  {
    name: "browser.pause",
    message: "Use waitUntil/waitFor* conditions instead of browser.pause().",
    match: (node) => isMethodCall(node, "browser", "pause"),
  },
  {
    name: "await setTimeout sleep",
    message: "Use waitUntil/waitFor* conditions instead of fixed setTimeout sleeps in e2e tests.",
    fileFilter: isE2ETestFile,
    match: (node) => isAwaitedSetTimeoutSleep(node),
  },
];

// ── File walker ──

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (entry.isFile() && fileExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

// ── Main ──

const violations = [];

for (const root of testRoots) {
  if (!fs.existsSync(root)) continue;

  for (const filePath of walkDir(root)) {
    const source = fs.readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

    const applicableRules = rules.filter((r) => !r.fileFilter || r.fileFilter(filePath));
    if (applicableRules.length === 0) continue;

    function visit(node) {
      for (const rule of applicableRules) {
        if (rule.match(node)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          violations.push({
            filePath,
            line: line + 1, // 1-based
            name: rule.name,
            message: rule.message,
          });
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
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
