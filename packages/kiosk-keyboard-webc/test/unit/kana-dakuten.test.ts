import { describe, it, expect, beforeEach } from "vitest";
import { _resetMiddleware, getMiddlewareForLayout } from "../../src/core/middleware-registry.js";
import "../../src/middleware/kana-dakuten.js";

describe("kana-dakuten middleware", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    input.value = "";
    input.setSelectionRange(0, 0);
  });

  it("registers itself for ja-kana layout", () => {
    const mw = getMiddlewareForLayout("ja-kana");
    expect(mw).not.toBeNull();
  });

  it("passes through regular kana (not dakuten/handakuten)", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    const consumed = mw.handleKey("\u304B", input); // か
    expect(consumed).toBe(false);
  });

  it("composes ka + dakuten into ga", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    input.value = "\u304B"; // か
    input.setSelectionRange(1, 1);
    const consumed = mw.handleKey("\u309B", input); // ゛
    expect(consumed).toBe(true);
    expect(input.value).toBe("\u304C"); // が
  });

  it("composes ha + handakuten into pa", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    input.value = "\u306F"; // は
    input.setSelectionRange(1, 1);
    const consumed = mw.handleKey("\u309C", input); // ゜
    expect(consumed).toBe(true);
    expect(input.value).toBe("\u3071"); // ぱ
  });

  it("composes ha + dakuten into ba", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    input.value = "\u306F"; // は
    input.setSelectionRange(1, 1);
    mw.handleKey("\u309B", input); // ゛
    expect(input.value).toBe("\u3070"); // ば
  });

  it("does not compose when preceding char has no dakuten form", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    input.value = "\u3042"; // あ
    input.setSelectionRange(1, 1);
    const consumed = mw.handleKey("\u309B", input); // ゛
    expect(consumed).toBe(false);
  });

  it("does not compose when input is empty", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    const consumed = mw.handleKey("\u309B", input); // ゛
    expect(consumed).toBe(false);
  });

  it("passes through backspace without consuming", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    const consumed = mw.handleKey("{backspace}", input);
    expect(consumed).toBe(false);
  });

  it("passes through enter without consuming", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    const consumed = mw.handleKey("{enter}", input);
    expect(consumed).toBe(false);
  });

  it("commit and reset are no-ops", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    expect(mw.commit()).toBeNull();
    mw.reset();
  });
});
