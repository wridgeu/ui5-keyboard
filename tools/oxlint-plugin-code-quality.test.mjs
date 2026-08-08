import { describe, it } from "node:test";
import { RuleTester } from "oxlint/plugins-dev";
import plugin from "./oxlint-plugin-code-quality.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();
/**
 * Looks a rule up by name so a typo fails loudly instead of handing
 * `undefined` to the tester.
 */
function rule(name) {
  const found = plugin.rules[name];
  if (!found) throw new Error(`No such rule: ${name}`);
  return found;
}

// Fixtures are built at runtime so this file's own source stays free of the
// characters `no-em-dash` bans.
const EM_DASH = String.fromCodePoint(0x2014);
const EN_DASH = String.fromCodePoint(0x2013);

const tsTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tsTester.run("no-double-type-assertion", rule("no-double-type-assertion"), {
  valid: ["const a = b as Keyboard;", "const a = b as unknown;"],
  invalid: [{ code: "const a = b as unknown as Keyboard;", errors: [{ messageId: "noDoubleTypeAssertion" }] }],
});

ruleTester.run("no-console-only-catch", rule("no-console-only-catch"), {
  valid: [
    "try { f(); } catch (e) { console.error(e); throw e; }",
    "try { f(); } catch (e) { report(e); }",
    "try { f(); } catch { }",
  ],
  invalid: [{ code: "try { f(); } catch (e) { console.error(e); }", errors: [{ messageId: "noConsoleOnlyCatch" }] }],
});

ruleTester.run("no-redundant-boolean-return", rule("no-redundant-boolean-return"), {
  valid: ["function f(x) { if (x) { return 1; } else { return 0; } }", "function f(x) { if (x) { return true; } }"],
  invalid: [
    {
      code: "function f(x) { if (x) { return true; } else { return false; } }",
      output: "function f(x) { return !!(x); }",
      errors: [{ messageId: "noRedundantBooleanReturn" }],
    },
    {
      code: "function f(x) { if (x) { return false; } else { return true; } }",
      output: "function f(x) { return !(x); }",
      errors: [{ messageId: "noRedundantBooleanReturn" }],
    },
    {
      // Same-value branches are dead code, reported without a fix.
      code: "function f(x) { if (x) { return true; } else { return true; } }",
      output: null,
      errors: [{ messageId: "noRedundantBooleanReturn" }],
    },
  ],
});

ruleTester.run("no-em-dash", rule("no-em-dash"), {
  valid: ['const s = "a-b";'],
  invalid: [
    {
      code: `const s = "a${EM_DASH}b";`,
      output: 'const s = "a-b";',
      errors: [{ messageId: "emDashInString" }],
    },
    {
      code: `const s = \`a${EN_DASH}b\`;`,
      output: "const s = `a-b`;",
      errors: [{ messageId: "emDashInString" }],
    },
    {
      code: `// a${EM_DASH}b\nconst s = 1;`,
      output: "// a-b\nconst s = 1;",
      errors: [{ messageId: "emDashInComment" }],
    },
  ],
});
