import { describe, it, expect, beforeEach } from "vitest";
import { getMiddlewareFactory } from "../../src/core/middleware-registry.js";
import "../../src/middleware/hangul-compose.js";

describe("hangul-compose middleware", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    input.value = "";
    input.setSelectionRange(0, 0);
  });

  function mw() {
    return getMiddlewareFactory("ko-hangul")!();
  }

  it("registers itself for ko-hangul layout", () => {
    expect(getMiddlewareFactory("ko-hangul")).not.toBeNull();
  });

  it("single L consonant shows as preedit", () => {
    const m = mw();
    const consumed = m.handleKey("\u3131", input); // ㄱ
    expect(consumed).toBe(true);
    // Preedit should show the leading jamo U+1100
    expect(input.value).toBe("\u1100");
  });

  it("L + V composes to syllable in preedit", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ
    m.handleKey("\u314f", input); // ㅏ
    // ㄱ(L=0) + ㅏ(V=0) = 가 (U+AC00)
    expect(input.value).toBe("\uAC00");
  });

  it("L + V + T composes to LVT syllable in preedit", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ
    m.handleKey("\u314f", input); // ㅏ
    m.handleKey("\u3134", input); // ㄴ
    // ㄱ(L=0) + ㅏ(V=0) + ㄴ(T=4) = 간 (U+AC00 + 0*588 + 0*28 + 4 = U+AC04)
    expect(input.value).toBe("\uAC04");
  });

  it("LVT + V steals trailing consonant", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ
    m.handleKey("\u314f", input); // ㅏ
    m.handleKey("\u3134", input); // ㄴ -> 간
    m.handleKey("\u314f", input); // ㅏ -> commits 가, preedit 나

    // 가 is committed, 나 is in preedit
    // 가 = U+AC00, 나 = ㄴ(L=2) + ㅏ(V=0) = U+AC00 + 2*588 = U+AC00 + 1176 = U+AC98 ... wait
    // 나 = 0xAC00 + 2*588 + 0*28 + 0 = 0xAC00 + 1176 = 0xB098
    expect(input.value).toBe("\uAC00\uB098");
  });

  it("LVT + L commits current and starts new", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ
    m.handleKey("\u314f", input); // ㅏ
    m.handleKey("\u3134", input); // ㄴ -> 간
    m.handleKey("\u3141", input); // ㅁ (new L)

    // 간 committed, ㅁ as preedit (U+1106)
    expect(input.value).toBe("\uAC04\u1106");
  });

  it("backspace decomposes LVT to LV", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ
    m.handleKey("\u314f", input); // ㅏ
    m.handleKey("\u3134", input); // ㄴ -> 간
    m.handleKey("{backspace}", input);
    // Should decompose to 가
    expect(input.value).toBe("\uAC00");
  });

  it("backspace decomposes LV to L", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ
    m.handleKey("\u314f", input); // ㅏ -> 가
    m.handleKey("{backspace}", input);
    // Should decompose to ㄱ (U+1100)
    expect(input.value).toBe("\u1100");
  });

  it("backspace decomposes L to empty", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ
    m.handleKey("{backspace}", input);
    expect(input.value).toBe("");
  });

  it("backspace passes through when not composing", () => {
    const m = mw();
    const consumed = m.handleKey("{backspace}", input);
    expect(consumed).toBe(false);
  });

  it("non-jamo characters pass through and commit preedit", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ -> preedit
    const consumed = m.handleKey("a", input);
    expect(consumed).toBe(false);
    // ㄱ (U+1100) should be committed
    expect(input.value).toBe("\u1100");
  });

  it("commit flushes preedit to target", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ
    m.handleKey("\u314f", input); // ㅏ -> 가
    const text = m.commit();
    expect(text).toBe("\uAC00");
    expect(input.value).toBe("\uAC00");
  });

  it("reset clears state without committing content", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ
    m.handleKey("\u314f", input); // ㅏ -> 가
    m.reset();
    // Preedit should be cleared (empty string written to preedit range, then ended)
    expect(input.value).toBe("");
  });

  it("L + L commits first and starts second", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ
    m.handleKey("\u3134", input); // ㄴ

    // ㄱ committed, ㄴ in preedit
    expect(input.value).toBe("\u1100\u1102");
  });

  it("bare vowel inserts directly without composition", () => {
    const m = mw();
    const consumed = m.handleKey("\u314f", input); // ㅏ
    expect(consumed).toBe(true);
    expect(input.value).toBe("\u314f");
  });

  it("LV + consonant-only-leading (cannot be trailing) commits and starts new", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ
    m.handleKey("\u314f", input); // ㅏ -> 가
    m.handleKey("\u3138", input); // ㄸ (cannot be trailing)

    // 가 committed, ㄸ in preedit
    expect(input.value).toBe("\uAC00\u1104");
  });

  it("LV + vowel commits current and inserts bare vowel", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ
    m.handleKey("\u314f", input); // ㅏ -> 가
    m.handleKey("\u3153", input); // ㅓ

    // 가 committed, ㅓ inserted directly
    expect(input.value).toBe("\uAC00\u3153");
  });

  it("multi-syllable composition: 한글", () => {
    const m = mw();
    // 한 = ㅎ + ㅏ + ㄴ
    m.handleKey("\u314e", input); // ㅎ
    m.handleKey("\u314f", input); // ㅏ
    m.handleKey("\u3134", input); // ㄴ -> 한

    // 글 = ㄱ + ㅡ + ㄹ
    // But ㄱ is a new L, so 한 gets committed
    m.handleKey("\u3131", input); // ㄱ -> commits 한
    m.handleKey("\u3161", input); // ㅡ
    m.handleKey("\u3139", input); // ㄹ -> 글

    // 한 = U+D55C, 글 = U+AE00 + ... let's compute:
    // ㅎ(L=18) + ㅏ(V=0) + ㄴ(T=4) = 0xAC00 + 18*588 + 0*28 + 4 = 0xAC00 + 10584 + 4 = 0xD55C
    // ㄱ(L=0) + ㅡ(V=18) + ㄹ(T=8) = 0xAC00 + 0*588 + 18*28 + 8 = 0xAC00 + 504 + 8 = 0xADFC? No...
    // 0xAC00 + 504 + 8 = 0xAC00 + 512 = 0xAE00
    // 글 = U+AE00
    expect(input.value).toBe("\uD55C\uAE00");
  });

  it("{enter} commits composition and passes through", () => {
    const m = mw();
    m.handleKey("\u3131", input); // ㄱ
    m.handleKey("\u314f", input); // ㅏ -> 가
    const consumed = m.handleKey("{enter}", input);
    expect(consumed).toBe(false);
    expect(input.value).toBe("\uAC00");
  });
});
