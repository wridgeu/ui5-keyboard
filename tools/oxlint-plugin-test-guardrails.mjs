// oxlint plugin: test stability guardrails (flags flaky hard-wait patterns).
// See https://oxc.rs/docs/guide/usage/linter/writing-js-plugins

/** @typedef {import('./oxlint-plugin.js').OxlintRule} OxlintRule */

/**
 * Returns the inner call expression from an arrow/function callback body,
 * handling both concise (`resolve => fn()`) and block (`resolve => { fn(); }`)
 * forms. Returns `undefined` when the body doesn't match.
 */
function extractSingleCallFromBody(body) {
  if (body.type === "CallExpression") return body;
  if (body.type === "BlockStatement" && body.body.length === 1) {
    const stmt = body.body[0];
    if (stmt.type === "ExpressionStatement" && stmt.expression.type === "CallExpression") {
      return stmt.expression;
    }
  }
  return undefined;
}

/**
 * Reports fixed-duration sleeps in e2e tests:
 *
 * - `await new Promise(resolve => setTimeout(resolve, N))` where N > 0
 * - `page.waitForTimeout(N)` (Playwright) where N > 0
 *
 * Intentionally allows `setTimeout(resolve, 0)` since that's a microtask flush
 * pattern, not a hard wait. A genuinely necessary settle window (e.g. asserting
 * that an action did NOT trigger a state change) can opt out with an
 * `// oxlint-disable-next-line test-guardrails/no-hard-wait` directive and a
 * rationale.
 *
 * Scope: e2e test files only (configured via oxlintrc overrides).
 */
/** @type {OxlintRule} */
const noHardWait = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow fixed sleeps (setTimeout / page.waitForTimeout) in e2e tests - use web-first assertions instead",
    },
    messages: {
      noHardWait:
        "Use web-first assertions (expect().toHaveClass etc.) instead of a fixed {{ source }} sleep in e2e tests.",
    },
    schema: [],
  },
  create(context) {
    return {
      // page.waitForTimeout(N) where N > 0
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== "MemberExpression" ||
          callee.property.type !== "Identifier" ||
          callee.property.name !== "waitForTimeout"
        ) {
          return;
        }
        const delay = node.arguments?.[0];
        if (delay?.type === "Literal" && typeof delay.value === "number" && delay.value > 0) {
          context.report({ node, messageId: "noHardWait", data: { source: "page.waitForTimeout" } });
        }
      },
      // await new Promise(resolve => setTimeout(resolve, N)) where N > 0
      AwaitExpression(node) {
        const inner = node.argument;
        if (inner?.type !== "NewExpression") return;
        if (inner.callee.type !== "Identifier" || inner.callee.name !== "Promise") return;

        const args = inner.arguments;
        if (args?.length !== 1) return;

        const callback = args[0];
        if (callback?.type !== "ArrowFunctionExpression" && callback?.type !== "FunctionExpression") return;

        const callExpr = extractSingleCallFromBody(callback.body);
        if (!callExpr) return;

        if (callExpr.callee.type !== "Identifier" || callExpr.callee.name !== "setTimeout") return;
        if (callExpr.arguments?.length < 2) return;

        const delay = callExpr.arguments[1];
        if (delay.type === "Literal" && typeof delay.value === "number" && delay.value > 0) {
          context.report({ node, messageId: "noHardWait", data: { source: "setTimeout" } });
        }
      },
    };
  },
};

/** @type {import('./oxlint-plugin.js').OxlintPlugin} */
export default {
  meta: { name: "test-guardrails" },
  rules: {
    "no-hard-wait": noHardWait,
  },
};
