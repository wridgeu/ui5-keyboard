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
      // A shared instance would still write to inputA; what catches it is inputB's
      // value below, because the shared phase state absorbs mwB's first jamo.
      mwB.handleKey("\u3134", inputB);
      mwB.handleKey("\u3153", inputB);

      expect(inputB.value).toBe("\uB108");
      expect(inputA.value).toBe("\uAC00");
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

      m.commit();
      expect(compositionEndSpy).toHaveBeenCalled();
      const endData = compositionEndSpy.mock.calls[0]?.[0]?.data;
      expect(endData).toBe("\uAC00");
    });
  });

  describe("hangul compose respects readOnly/disabled", () => {
    it("returns false and does not modify value when input is readOnly", () => {
      const input = document.createElement("input");
      input.value = "ab";
      input.setSelectionRange(2, 2);
      input.readOnly = true;

      const m = getMiddlewareFactory("ko-hangul")!();
      const consumed = m.handleKey("\u314e", input);
      expect(consumed).toBe(false);
      expect(input.value).toBe("ab");
    });

    it("returns false and does not modify value when input is disabled", () => {
      const input = document.createElement("input");
      input.value = "ab";
      input.setSelectionRange(2, 2);
      input.disabled = true;

      const m = getMiddlewareFactory("ko-hangul")!();
      const consumed = m.handleKey("\u314e", input);
      expect(consumed).toBe(false);
      expect(input.value).toBe("ab");
    });

    it("declines backspace on a target that turned read-only mid-composition", () => {
      const input = document.createElement("input");
      input.value = "ab";
      input.setSelectionRange(2, 2);

      const m = getMiddlewareFactory("ko-hangul")!();
      m.handleKey("\u314e", input);
      m.handleKey("\u314f", input);
      // Precondition: 하 is a live preedit
      expect(input.value).toBe("ab\uD558");

      input.readOnly = true;
      expect(m.handleKey("{backspace}", input)).toBe(false);
      expect(input.value).toBe("ab\uD558");
    });

    it("commit() on a target that turned read-only restores the pre-composition value", () => {
      const input = document.createElement("input");
      input.value = "ab";
      input.setSelectionRange(2, 2);

      const m = getMiddlewareFactory("ko-hangul")!();
      m.handleKey("\u314e", input);
      m.handleKey("\u314f", input);
      // Precondition: 하 is a live preedit
      expect(input.value).toBe("ab\uD558");

      input.readOnly = true;
      m.commit();

      expect(input.value).toBe("ab");
    });
  });

  describe("hangul compose honours maxlength", () => {
    it("applies the target's maxlength at commit", () => {
      const input = document.createElement("input");
      input.value = "";
      input.setSelectionRange(0, 0);
      input.maxLength = 2;

      const m = getMiddlewareFactory("ko-hangul")!();
      // 한국마: three syllables typed into a field with room for two
      for (const key of ["\u314e", "\u314f", "\u3134", "\u3131", "\u315c", "\u3131", "\u3141", "\u314f"]) {
        m.handleKey(key, input);
      }
      m.commit();

      expect(input.value).toBe("\uD55C\uAD6D");
    });

    it("refuses the jamo that would open a preedit past maxlength", () => {
      const input = document.createElement("input");
      input.value = "";
      input.setSelectionRange(0, 0);
      input.maxLength = 1;

      const m = getMiddlewareFactory("ko-hangul")!();
      // \uAC04 fills the field; the following \u314F would steal the \u3134 into a second syllable.
      for (const key of ["\u3131", "\u314F", "\u3134"]) m.handleKey(key, input);
      expect(input.value, "precondition: \uAC04 is a live preedit").toBe("\uAC04");

      expect(m.handleKey("\u314F", input), "the refused key is swallowed, not passed on").toBe(true);
      expect(input.value).toBe("\uAC04");
    });

    it("keeps composing while the field still has room", () => {
      const input = document.createElement("input");
      input.value = "";
      input.setSelectionRange(0, 0);
      input.maxLength = 2;

      const m = getMiddlewareFactory("ko-hangul")!();
      for (const key of ["\u3131", "\u314F", "\u3134", "\u314F"]) m.handleKey(key, input);

      expect(input.value).toBe("\uAC00\uB098");
    });

    it("refuses the jamo that would commit one preedit and open another past maxlength", () => {
      const input = document.createElement("input");
      input.value = "";
      input.setSelectionRange(0, 0);
      input.maxLength = 1;

      const m = getMiddlewareFactory("ko-hangul")!();
      m.handleKey("ㄱ", input);
      expect(input.value, "precondition: ᄀ is a live preedit").toBe("ᄀ");

      expect(m.handleKey("ㄴ", input), "the refused key is swallowed, not passed on").toBe(true);
      expect(input.value).toBe("ᄀ");
    });

    it("counts the text a new composition replaces as room", () => {
      const input = document.createElement("input");
      input.value = "AB";
      input.setSelectionRange(0, 2);
      input.maxLength = 2;

      const m = getMiddlewareFactory("ko-hangul")!();
      m.handleKey("\u3131", input);

      expect(input.value).toBe("\u1100");
    });
  });

  describe("hangul compose replaces the selection", () => {
    it("removes the selected text instead of composing beside it", () => {
      const input = document.createElement("input");
      input.value = "ABCD";
      input.setSelectionRange(1, 3);

      const m = getMiddlewareFactory("ko-hangul")!();
      m.handleKey("\u3131", input);
      m.handleKey("\u314F", input);

      expect(input.value).toBe("A\uAC00D");
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
