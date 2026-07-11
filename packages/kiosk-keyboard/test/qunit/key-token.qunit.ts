import { parseKeyAction, LAYOUT_BASE } from "ui5/kiosk/internal/key-token";

// Unit coverage for the sole brace-token parser. `parseKeyAction` turns a key's
// authored `value` string into a typed KeyAction exactly once; every consumer
// (dispatch, composition, styling, highlight) reads the typed result instead of
// re-parsing the string.

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

QUnit.test("a token missing its closing brace is a char, not a truncated action", (assert) => {
  assert.deepEqual(
    parseKeyAction("{layout:base"),
    { kind: "char", text: "{layout:base" },
    "unterminated {layout: is literal, not a target losing its last char",
  );
  assert.deepEqual(
    parseKeyAction("{fkey:F5"),
    { kind: "char", text: "{fkey:F5" },
    "unterminated {fkey: is literal, not a name losing its last char",
  );
});

QUnit.test("an empty {layout:} / {fkey:} arg is unknown, not an empty-target action", (assert) => {
  assert.deepEqual(parseKeyAction("{layout:}"), { kind: "unknown", raw: "{layout:}" }, "empty layout target");
  assert.deepEqual(parseKeyAction("{fkey:}"), { kind: "unknown", raw: "{fkey:}" }, "empty fkey name");
  assert.deepEqual(
    parseKeyAction("{layout: }"),
    { kind: "unknown", raw: "{layout: }" },
    "whitespace-only layout target trims to empty and is unknown",
  );
});
