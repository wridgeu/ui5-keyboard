import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();

// Auto-discover test directories from workspace packages
const testRoots = fs.globSync("packages/*/test", { cwd: repoRoot }).map((p) => path.join(repoRoot, p));

const testFileGlob = "**/*.{ts,js,mjs,cjs}";

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
  if (!ts.isAwaitExpression(node)) return false;
  const inner = node.expression;

  if (!ts.isNewExpression(inner)) return false;
  if (!ts.isIdentifier(inner.expression) || inner.expression.text !== "Promise") return false;

  const args = inner.arguments;
  if (!args || args.length !== 1) return false;
  const callback = args[0];

  if (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) return false;

  const body = callback.body;
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
    fileFilter: (filePath) => filePath.includes("/e2e/"),
    match: (node) => isAwaitedSetTimeoutSleep(node),
  },
];

// ── AST visitor ──

function collectViolations(sourceFile, applicableRules) {
  const hits = [];

  function visit(node) {
    for (const rule of applicableRules) {
      if (rule.match(node)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        hits.push({ line: line + 1, name: rule.name, message: rule.message });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return hits;
}

// ── Main ──

const violations = [];

for (const root of testRoots) {
  const files = fs.globSync(testFileGlob, { cwd: root }).map((f) => path.join(root, f));

  for (const filePath of files) {
    const posixPath = filePath.split(path.sep).join("/");
    const applicableRules = rules.filter((r) => !r.fileFilter || r.fileFilter(posixPath));
    if (applicableRules.length === 0) continue;

    const source = fs.readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

    for (const hit of collectViolations(sourceFile, applicableRules)) {
      violations.push({ filePath, ...hit });
    }
  }
}

if (violations.length === 0) {
  console.log("No test hard-wait violations found.");
  process.exitCode = 0;
} else {
  console.error("Test hard-wait violations found:");
  for (const v of violations) {
    console.error(`- ${path.relative(repoRoot, v.filePath)}:${v.line} (${v.name}) ${v.message}`);
  }
  process.exitCode = 1;
}
