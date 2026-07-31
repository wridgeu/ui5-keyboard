import { describe, it } from "node:test";
import { RuleTester } from "oxlint/plugins-dev";
import plugin from "./oxlint-plugin-comment-quality.mjs";

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

ruleTester.run("no-narrator-comment", rule("no-narrator-comment"), {
  valid: [
    "// Debounced because the resize observer fires once per frame.\nconst a = 1;",
    "// TODO: this function handles the fallback path\nconst a = 1;",
    "/** Returns the trimmed comment text. */\nconst a = 1;",
    "// This function is fast.\nconst a = 1;",
  ],
  invalid: [
    {
      code: "// This function handles the click event.\nconst a = 1;",
      errors: [{ messageId: "noNarratorComment", line: 1, column: 0, endLine: 1, endColumn: 41 }],
    },
    {
      code: "/* This class manages the popover lifecycle. */\nconst a = 1;",
      errors: [{ messageId: "noNarratorComment" }],
    },
  ],
});

ruleTester.run("no-section-divider", rule("no-section-divider"), {
  valid: ["// Falls back to the base layout.\nconst a = 1;", "//--\nconst a = 1;"],
  invalid: [
    { code: "// ------------\nconst a = 1;", errors: [{ messageId: "noSectionDivider" }] },
    { code: "// === Helpers ===\nconst a = 1;", errors: [{ messageId: "noSectionDivider" }] },
  ],
});

ruleTester.run("no-placeholder-comment", rule("no-placeholder-comment"), {
  valid: ["// Resolves the variant table.\nconst a = 1;"],
  invalid: [
    { code: "// ... rest of the implementation\nconst a = 1;", errors: [{ messageId: "noPlaceholderComment" }] },
    { code: "// omitted for brevity\nconst a = 1;", errors: [{ messageId: "noPlaceholderComment" }] },
    { code: "// implement this\nconst a = 1;", errors: [{ messageId: "noPlaceholderComment" }] },
  ],
});

ruleTester.run("no-hedging-comment", rule("no-hedging-comment"), {
  valid: ["// Should work across both themes.\nconst a = 1;"],
  invalid: [
    { code: "// hopefully this is enough\nconst a = 1;", errors: [{ messageId: "noHedgingComment" }] },
    { code: "// temporary workaround\nconst a = 1;", errors: [{ messageId: "noHedgingComment" }] },
  ],
});

ruleTester.run("no-edit-narration", rule("no-edit-narration"), {
  valid: [
    "// Renamed from the old key because the layout registry keys on the token.\nconst a = 1;",
    "// Fires a change event.\nconst a = 1;",
  ],
  invalid: [
    { code: "// renamed from getKeyLabel\nconst a = 1;", errors: [{ messageId: "noEditNarration" }] },
    { code: "// collapsed from two fields\nconst a = 1;", errors: [{ messageId: "noEditNarration" }] },
  ],
});

ruleTester.run("no-obvious-comment", rule("no-obvious-comment"), {
  valid: [
    "// TODO: the todo item label\nconst label = todo.item.label;",
    "// Legacy layout rows\nconst rows = legacyLayout.rows;",
    "/** The active locale segmenter. */\nconst segmenter = new Intl.Segmenter(activeLocale);",
    "// Falls back to the base layout.\nconst name = user.name;",
    // A blank line separates the comment from the statement, so it is not
    // describing it.
    "// Get the user name\n\nconst name = user.name;",
    // Trailing comment: only own-line comments are compared.
    "noop(); // the user name\nconst name = user.name;",
    '// Push the editor scope\nmanager.pushScope("editor");',
    // Declarations are out of scope; a doc-style summary over one is the
    // contract, not a restatement.
    "// Focus the first key\nfunction focusFirstKey(key) {}",
  ],
  invalid: [
    {
      code: "// Get the user name\nconst name = user.name;",
      errors: [{ messageId: "noObviousComment", line: 1, column: 0, endLine: 1, endColumn: 20 }],
    },
    {
      code: "// Set the shift state on the layout\nlayout.shiftState = shift;",
      errors: [{ messageId: "noObviousComment" }],
    },
    {
      // Pins ReturnStatement and the indented path.
      code: "function f(shiftState) {\n  // Return the shift state\n  return shiftState;\n}",
      errors: [{ messageId: "noObviousComment" }],
    },
  ],
});

ruleTester.run("no-issue-reference-comment", rule("no-issue-reference-comment"), {
  valid: [
    "// oxlint-disable-next-line no-console -- see #187\nconst a = 1;",
    "// Docks the popover to the anchor rect.\nconst a = 1;",
  ],
  invalid: [
    { code: "// tracked in #187\nconst a = 1;", errors: [{ messageId: "noIssueReferenceComment" }] },
    {
      code: "// known limitation of the static area\nconst a = 1;",
      errors: [{ messageId: "noIssueReferenceComment" }],
    },
  ],
});
