import { describe, it, expect, beforeEach } from "vitest";
import { getMiddlewareFactory } from "../../src/core/middleware-registry.js";

describe("kana-dakuten middleware", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    input.value = "";
    input.setSelectionRange(0, 0);
  });

  it("passes through keys other than dakuten/handakuten", () => {
    const mw = getMiddlewareFactory("ja-kana")!()!;
    for (const key of ["\u304B", "{backspace}", "{enter}"]) {
      expect(mw.handleKey(key, input), key).toBe(false); // か, backspace, enter
    }
  });

  it("composes a kana + dakuten into its voiced form", () => {
    const mw = getMiddlewareFactory("ja-kana")!()!;
    input.value = "\u304B"; // か
    input.setSelectionRange(1, 1);
    const consumed = mw.handleKey("\u309B", input); // ゛
    expect(consumed).toBe(true);
    expect(input.value).toBe("\u304C"); // が

    input.value = "\u306F"; // は
    input.setSelectionRange(1, 1);
    mw.handleKey("\u309B", input); // ゛
    expect(input.value).toBe("\u3070"); // ば
  });

  it("composes ha + handakuten into pa", () => {
    const mw = getMiddlewareFactory("ja-kana")!()!;
    input.value = "\u306F"; // は
    input.setSelectionRange(1, 1);
    const consumed = mw.handleKey("\u309C", input); // ゜
    expect(consumed).toBe(true);
    expect(input.value).toBe("\u3071"); // ぱ
  });

  it("does not compose when preceding char has no dakuten form", () => {
    const mw = getMiddlewareFactory("ja-kana")!()!;
    input.value = "\u3042"; // あ
    input.setSelectionRange(1, 1);
    const consumed = mw.handleKey("\u309B", input); // ゛
    expect(consumed).toBe(false);
  });

  it("does not compose when input is empty", () => {
    const mw = getMiddlewareFactory("ja-kana")!()!;
    const consumed = mw.handleKey("\u309B", input); // ゛
    expect(consumed).toBe(false);
  });

  it("commit and reset are no-ops", () => {
    const mw = getMiddlewareFactory("ja-kana")!()!;
    expect(mw.commit()).toBeNull();
    mw.reset();
  });
});
