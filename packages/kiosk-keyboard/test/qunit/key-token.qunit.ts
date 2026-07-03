import { parseKeyAction, classifyKeyToken, parseLayoutToken, LAYOUT_BASE } from "ui5/kiosk/internal/key-token";

// Unit coverage for the sole brace-token parser. `parseKeyAction` turns a key's
// authored `value` string into a typed KeyAction exactly once; every consumer
// (dispatch, composition, styling, highlight) reads the typed result instead of
// re-parsing the string. `classifyKeyToken` / `parseLayoutToken` are thin
// adapters kept only until their call sites migrate.

QUnit.module("key-token - parseKeyAction");

QUnit.test("exact-match action tokens", (assert) => {
  assert.deepEqual(parseKeyAction("{shift}"), { kind: "shift" }, "{shift}");
  assert.deepEqual(parseKeyAction("{backspace}"), { kind: "backspace" }, "{backspace}");
  assert.deepEqual(parseKeyAction("{enter}"), { kind: "enter" }, "{enter}");
});

QUnit.test("{layout:NAME} extracts a trimmed, lowercased target", (assert) => {
  assert.deepEqual(parseKeyAction("{layout:numeric}"), { kind: "layout", target: "numeric" }, "plain name");
  assert.deepEqual(parseKeyAction("{layout:Base}"), { kind: "layout", target: LAYOUT_BASE }, "mixed case lowercased");
  assert.deepEqual(
    parseKeyAction("{layout: qwertz-de }"),
    { kind: "layout", target: "qwertz-de" },
    "surrounding space trimmed",
  );
});

QUnit.test("{fkey:NAME} extracts a trimmed but case-preserved name", (assert) => {
  assert.deepEqual(parseKeyAction("{fkey:F5}"), { kind: "fkey", name: "F5" }, "F-key case preserved");
  assert.deepEqual(
    parseKeyAction("{fkey: ArrowLeft }"),
    { kind: "fkey", name: "ArrowLeft" },
    "trimmed, case preserved",
  );
});

QUnit.test("literal characters and the space key are char actions", (assert) => {
  assert.deepEqual(parseKeyAction("a"), { kind: "char", text: "a" }, "letter");
  assert.deepEqual(parseKeyAction(" "), { kind: "char", text: " " }, "space");
  assert.deepEqual(parseKeyAction("?"), { kind: "char", text: "?" }, "punctuation");
});

QUnit.test("unrecognized full brace tokens are unknown; lone braces are char", (assert) => {
  assert.deepEqual(
    parseKeyAction("{bcksp}"),
    { kind: "unknown", raw: "{bcksp}" },
    "typo token is unknown, not literal",
  );
  assert.deepEqual(parseKeyAction("{"), { kind: "char", text: "{" }, "lone open brace is a char");
  assert.deepEqual(parseKeyAction("}"), { kind: "char", text: "}" }, "lone close brace is a char");
});

QUnit.module("key-token - legacy adapters (parity)");

QUnit.test("classifyKeyToken returns the KeyAction kind", (assert) => {
  assert.strictEqual(classifyKeyToken("{shift}"), "shift", "shift");
  assert.strictEqual(classifyKeyToken("{layout:x}"), "layout", "layout");
  assert.strictEqual(classifyKeyToken("{fkey:F1}"), "fkey", "fkey");
  assert.strictEqual(classifyKeyToken("{bogus}"), "unknown", "unknown");
  assert.strictEqual(classifyKeyToken("a"), "char", "char");
});

QUnit.test("parseLayoutToken returns the layout target or null", (assert) => {
  assert.strictEqual(parseLayoutToken("{layout:Numeric}"), "numeric", "lowercased target");
  assert.strictEqual(parseLayoutToken("{fkey:F1}"), null, "non-layout token is null");
  assert.strictEqual(parseLayoutToken("a"), null, "char is null");
});
