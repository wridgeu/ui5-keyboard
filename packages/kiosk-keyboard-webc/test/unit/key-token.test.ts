import { describe, it, expect } from "vitest";
import { parseKeyAction, LAYOUT_BASE } from "../../src/core/key-token.js";

// Unit coverage for the sole brace-token parser. `parseKeyAction` turns a key's
// authored `value` string into a typed KeyAction exactly once; every consumer
// (dispatch, composition, styling, highlight) reads the typed result instead of
// re-parsing the string.

describe("parseKeyAction", () => {
  it("parses exact-match action tokens", () => {
    expect(parseKeyAction("{shift}")).toEqual({ kind: "shift" });
    expect(parseKeyAction("{backspace}")).toEqual({ kind: "backspace" });
    expect(parseKeyAction("{enter}")).toEqual({ kind: "enter" });
  });

  it("extracts a trimmed, lowercased {layout:NAME} target", () => {
    expect(parseKeyAction("{layout:numeric}")).toEqual({ kind: "layout", target: "numeric" });
    expect(parseKeyAction("{layout:Base}")).toEqual({ kind: "layout", target: LAYOUT_BASE });
    expect(parseKeyAction("{layout: qwertz-de }")).toEqual({ kind: "layout", target: "qwertz-de" });
  });

  it("extracts a trimmed but case-preserved {fkey:NAME} name", () => {
    expect(parseKeyAction("{fkey:F5}")).toEqual({ kind: "fkey", name: "F5" });
    expect(parseKeyAction("{fkey: ArrowLeft }")).toEqual({ kind: "fkey", name: "ArrowLeft" });
  });

  it("treats literal characters and the space key as char actions", () => {
    expect(parseKeyAction("a")).toEqual({ kind: "char", text: "a" });
    expect(parseKeyAction(" ")).toEqual({ kind: "char", text: " " });
    expect(parseKeyAction("?")).toEqual({ kind: "char", text: "?" });
  });

  it("treats unrecognized full brace tokens as unknown and lone braces as char", () => {
    expect(parseKeyAction("{bcksp}")).toEqual({ kind: "unknown", raw: "{bcksp}" });
    expect(parseKeyAction("{")).toEqual({ kind: "char", text: "{" });
    expect(parseKeyAction("}")).toEqual({ kind: "char", text: "}" });
  });

  it("treats a token missing its closing brace as a char, not a truncated action", () => {
    expect(parseKeyAction("{layout:base")).toEqual({ kind: "char", text: "{layout:base" });
    expect(parseKeyAction("{fkey:F5")).toEqual({ kind: "char", text: "{fkey:F5" });
  });
});
