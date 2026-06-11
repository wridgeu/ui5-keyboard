import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CompositionMiddleware } from "../../src/types.js";
import { getMiddlewareFactory } from "../../src/core/middleware-registry.js";

describe("middleware integration", () => {
  describe("hangul backspace decomposition end-to-end", () => {
    let input: HTMLInputElement;
    let m: CompositionMiddleware;

    beforeEach(() => {
      input = document.createElement("input");
      input.value = "";
      input.setSelectionRange(0, 0);
      m = getMiddlewareFactory("ko-hangul")!();
    });

    it("decomposes LVT -> LV -> L -> empty via sequential backspaces", () => {
      m.handleKey("\u314e", input);
      m.handleKey("\u314f", input);
      m.handleKey("\u3134", input);

      expect(input.value).toBe("\uD55C");

      m.handleKey("{backspace}", input);
      const lvChar = String.fromCharCode(0xac00 + 18 * 588 + 0 * 28);
      expect(input.value).toBe(lvChar);

      m.handleKey("{backspace}", input);
      expect(input.value).toBe("\u1112");

      m.handleKey("{backspace}", input);
      expect(input.value).toBe("");
    });

    it("after full backspace decomposition, middleware is ready for new input", () => {
      m.handleKey("\u3131", input);
      m.handleKey("\u314f", input);
      m.handleKey("{backspace}", input);
      m.handleKey("{backspace}", input);

      m.handleKey("\u3134", input);
      expect(input.value).toBe("\u1102");
    });
  });

  describe("composition state isolation between targets", () => {
    it("composing on input A then switching to input B does not corrupt A", () => {
      const inputA = document.createElement("input");
      inputA.value = "";
      inputA.setSelectionRange(0, 0);

      const inputB = document.createElement("input");
      inputB.value = "";
      inputB.setSelectionRange(0, 0);

      const m = getMiddlewareFactory("ko-hangul")!();

      m.handleKey("\u3131", inputA);
      m.handleKey("\u314f", inputA);

      m.commit();

      expect(inputA.value).toBe("\uAC00");

      m.handleKey("\u3134", inputB);
      m.handleKey("\u3153", inputB);

      expect(inputA.value).toBe("\uAC00");
      expect(inputB.value).toBe("\uB108");
    });

    it("preedit text on one target does not appear on another", () => {
      const inputA = document.createElement("input");
      inputA.value = "existing";
      inputA.setSelectionRange(8, 8);

      const inputB = document.createElement("input");
      inputB.value = "";
      inputB.setSelectionRange(0, 0);

      const m = getMiddlewareFactory("ko-hangul")!();

      m.handleKey("\u3131", inputA);
      expect(inputA.value).toBe("existing\u1100");

      m.commit();

      m.handleKey("\u3134", inputB);
      expect(inputB.value).toBe("\u1102");
      expect(inputA.value).toBe("existing\u1100");
    });
  });

  describe("two components using the same layout get independent instances", () => {
    it("typing on instance A does not affect instance B", () => {
      const inputA = document.createElement("input");
      inputA.value = "";
      inputA.setSelectionRange(0, 0);

      const inputB = document.createElement("input");
      inputB.value = "";
      inputB.setSelectionRange(0, 0);

      const factory = getMiddlewareFactory("ko-hangul")!;
      const mwA = factory();
      const mwB = factory();

      mwA.handleKey("\u3131", inputA);
      mwA.handleKey("\u314f", inputA);

      expect(inputA.value).toBe("\uAC00");
      expect(inputB.value).toBe("");

      mwB.handleKey("\u3134", inputB);
      mwB.handleKey("\u3153", inputB);

      expect(inputB.value).toBe("\uB108");
      expect(inputA.value).toBe("\uAC00");
    });

    it("resetting instance A does not affect instance B", () => {
      const inputA = document.createElement("input");
      inputA.value = "";
      inputA.setSelectionRange(0, 0);

      const inputB = document.createElement("input");
      inputB.value = "";
      inputB.setSelectionRange(0, 0);

      const factory = getMiddlewareFactory("ko-hangul")!;
      const mwA = factory();
      const mwB = factory();

      mwA.handleKey("\u3131", inputA);
      mwB.handleKey("\u3134", inputB);

      mwA.reset();

      expect(inputA.value).toBe("");
      expect(inputB.value).toBe("\u1102");
    });
  });

  describe("component destroy calls reset (not commit)", () => {
    it("reset() clears preedit text and dispatches compositionend with empty data", () => {
      const input = document.createElement("input");
      input.value = "";
      input.setSelectionRange(0, 0);

      const compositionEndSpy = vi.fn();
      input.addEventListener("compositionend", compositionEndSpy);

      const m = getMiddlewareFactory("ko-hangul")!();
      m.handleKey("\u3131", input);
      m.handleKey("\u314f", input);
      expect(input.value).toBe("\uAC00");

      compositionEndSpy.mockClear();
      m.reset();

      expect(input.value).toBe("");
      const endData = compositionEndSpy.mock.calls[0]?.[0]?.data;
      expect(endData).toBe("");
    });

    it("after reset(), middleware accepts new compositions cleanly", () => {
      const input = document.createElement("input");
      input.value = "";
      input.setSelectionRange(0, 0);

      const m = getMiddlewareFactory("ko-hangul")!();
      m.handleKey("\u3131", input);
      m.handleKey("\u314f", input);

      m.reset();

      m.handleKey("\u3134", input);
      m.handleKey("\u3153", input);
      expect(input.value).toBe("\uB108");
    });

    it("commit() dispatches compositionend and preserves the text", () => {
      const input = document.createElement("input");
      input.value = "";
      input.setSelectionRange(0, 0);

      const compositionEndSpy = vi.fn();
      input.addEventListener("compositionend", compositionEndSpy);

      const m = getMiddlewareFactory("ko-hangul")!();
      m.handleKey("\u3131", input);
      m.handleKey("\u314f", input);

      const text = m.commit();
      expect(text).toBe("\uAC00");
      expect(input.value).toBe("\uAC00");
      expect(compositionEndSpy).toHaveBeenCalled();
    });
  });

  describe("kana dakuten respects readOnly/disabled", () => {
    it("returns false and does not modify value when input is readOnly", () => {
      const input = document.createElement("input");
      input.value = "\u304B";
      input.setSelectionRange(1, 1);
      input.readOnly = true;

      const m = getMiddlewareFactory("ja-kana")!();
      const consumed = m.handleKey("\u309B", input);
      expect(consumed).toBe(false);
      expect(input.value).toBe("\u304B");
    });

    it("returns false and does not modify value when input is disabled", () => {
      const input = document.createElement("input");
      input.value = "\u304B";
      input.setSelectionRange(1, 1);
      input.disabled = true;

      const m = getMiddlewareFactory("ja-kana")!();
      const consumed = m.handleKey("\u309B", input);
      expect(consumed).toBe(false);
      expect(input.value).toBe("\u304B");
    });
  });
});
