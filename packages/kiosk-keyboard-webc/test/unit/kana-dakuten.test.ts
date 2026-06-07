import { describe, it, expect, beforeEach } from "vitest";
import { getMiddlewareFactory } from "../../src/core/middleware-registry.js";

describe("kana-dakuten middleware", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    input.value = "";
    input.setSelectionRange(0, 0);
  });

  it("is registered as a built-in for ja-kana layout", () => {
    expect(getMiddlewareFactory("ja-kana")).not.toBeNull();
  });

  it("passes through regular kana (not dakuten/handakuten)", () => {
    const mw = getMiddlewareFactory("ja-kana")!()!;
    const consumed = mw.handleKey("\u304B", input); // か
    expect(consumed).toBe(false);
  });

  it("composes ka + dakuten into ga", () => {
    const mw = getMiddlewareFactory("ja-kana")!()!;
    input.value = "\u304B"; // か
    input.setSelectionRange(1, 1);
    const consumed = mw.handleKey("\u309B", input); // ゛
    expect(consumed).toBe(true);
    expect(input.value).toBe("\u304C"); // が
  });

  it("composes ha + handakuten into pa", () => {
    const mw = getMiddlewareFactory("ja-kana")!()!;
    input.value = "\u306F"; // は
    input.setSelectionRange(1, 1);
    const consumed = mw.handleKey("\u309C", input); // ゜
    expect(consumed).toBe(true);
    expect(input.value).toBe("\u3071"); // ぱ
  });

  it("composes ha + dakuten into ba", () => {
    const mw = getMiddlewareFactory("ja-kana")!()!;
    input.value = "\u306F"; // は
    input.setSelectionRange(1, 1);
    mw.handleKey("\u309B", input); // ゛
    expect(input.value).toBe("\u3070"); // ば
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

  it("passes through backspace without consuming", () => {
    const mw = getMiddlewareFactory("ja-kana")!()!;
    const consumed = mw.handleKey("{backspace}", input);
    expect(consumed).toBe(false);
  });

  it("passes through enter without consuming", () => {
    const mw = getMiddlewareFactory("ja-kana")!()!;
    const consumed = mw.handleKey("{enter}", input);
    expect(consumed).toBe(false);
  });

  it("commit and reset are no-ops", () => {
    const mw = getMiddlewareFactory("ja-kana")!()!;
    expect(mw.commit()).toBeNull();
    mw.reset();
  });
});
