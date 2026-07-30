import { describe, it } from "node:test";
import { RuleTester } from "oxlint/plugins-dev";
import plugin from "./oxlint-plugin-test-guardrails.mjs";

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

ruleTester.run("no-hard-wait", rule("no-hard-wait"), {
  valid: [
    "await new Promise((resolve) => setTimeout(resolve, 0));",
    "await new Promise((resolve) => { setTimeout(resolve, 0); });",
    "await page.waitForTimeout(0);",
    "await expect(key).toHaveClass('pressed');",
    "await new Promise((resolve) => queueMicrotask(resolve));",
  ],
  invalid: [
    { code: "await page.waitForTimeout(250);", errors: [{ messageId: "noHardWait" }] },
    { code: "await new Promise((resolve) => setTimeout(resolve, 100));", errors: [{ messageId: "noHardWait" }] },
    {
      code: "await new Promise((resolve) => { setTimeout(resolve, 100); });",
      errors: [{ messageId: "noHardWait" }],
    },
    {
      code: "await new Promise(function (resolve) { setTimeout(resolve, 50); });",
      errors: [{ messageId: "noHardWait" }],
    },
  ],
});
