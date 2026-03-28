import { describe, it, expect } from "vitest";
import jaKana from "../../src/layouts/ja-kana.js";

describe("ja-kana layout structure", () => {
  it("has exactly 5 rows", () => {
    expect(jaKana).toHaveLength(5);
  });

  it("row 1 has 12 keys (10 kana + ほ + backspace)", () => {
    expect(jaKana[0]).toHaveLength(12);
  });

  it("row 2 has 12 keys (10 kana + dakuten + handakuten)", () => {
    expect(jaKana[1]).toHaveLength(12);
  });

  it("row 3 has 12 keys (10 kana + け + む)", () => {
    expect(jaKana[2]).toHaveLength(12);
  });

  it("row 4 has 12 keys (shift + 9 kana + enter)", () => {
    expect(jaKana[3]).toHaveLength(12);
  });

  it("row 5 has 6 keys", () => {
    expect(jaKana[4]).toHaveLength(6);
  });

  it("all base-layer values are hiragana, special keys, or punctuation", () => {
    const hiraganaRange = /^[\u3040-\u309F]$/;
    const specialKeys = new Set(["{backspace}", "{enter}", "{shift}", " "]);
    const punctuation = new Set(["\u309B", "\u309C", "\u30FC", "\u3002"]);
    const layoutKeys = new Set(["{layout:numeric}", "{layout:ja-romaji}", "{layout:fkeys}"]);

    for (const row of jaKana) {
      for (const key of row) {
        const v = key.value;
        const isValid = hiraganaRange.test(v) || specialKeys.has(v) || punctuation.has(v) || layoutKeys.has(v);
        expect(isValid, `key value "${v}" (U+${v.codePointAt(0)?.toString(16)}) should be valid`).toBe(true);
      }
    }
  });

  it("small kana shift variants are on the correct keys", () => {
    const expectedShifts: Record<string, string> = {
      "\u3042": "\u3041", // あ → ぁ
      "\u3046": "\u3045", // う → ぅ
      "\u3048": "\u3047", // え → ぇ
      "\u304A": "\u3049", // お → ぉ
      "\u3084": "\u3083", // や → ゃ
      "\u3086": "\u3085", // ゆ → ゅ
      "\u3088": "\u3087", // よ → ょ
      "\u308F": "\u3092", // わ → を
      "\u3044": "\u3043", // い → ぃ
      "\u3064": "\u3063", // つ → っ
    };

    const allKeys = jaKana.flat();
    for (const [base, expectedSmall] of Object.entries(expectedShifts)) {
      const key = allKeys.find((k) => k.value === base);
      expect(key, `key for ${base} should exist`).toBeDefined();
      expect(key!.shiftValue, `shift of ${base} should be ${expectedSmall}`).toBe(expectedSmall);
    }
  });

  it("dakuten and handakuten are on the base layer", () => {
    const allKeys = jaKana.flat();
    const dakuten = allKeys.find((k) => k.value === "\u309B");
    const handakuten = allKeys.find((k) => k.value === "\u309C");
    expect(dakuten, "dakuten key exists").toBeDefined();
    expect(handakuten, "handakuten key exists").toBeDefined();
  });

  it("has layout toggle pointing to ja-romaji", () => {
    const allKeys = jaKana.flat();
    const toggle = allKeys.find((k) => k.value === "{layout:ja-romaji}");
    expect(toggle, "ja-romaji toggle key exists").toBeDefined();
    expect(toggle!.type).toBe("modifier");
  });

  it("has backspace, enter, shift, and space with correct types", () => {
    const allKeys = jaKana.flat();
    expect(allKeys.find((k) => k.value === "{backspace}")!.type).toBe("action");
    expect(allKeys.find((k) => k.value === "{enter}")!.type).toBe("action");
    expect(allKeys.find((k) => k.value === "{shift}")!.type).toBe("modifier");
    expect(allKeys.find((k) => k.value === " ")!.type).toBe("space");
  });

  it("row 4 punctuation keys have JIS shift variants", () => {
    const row4 = jaKana[3];
    const ne = row4.find((k) => k.value === "\u306D");
    const ru = row4.find((k) => k.value === "\u308B");
    const me = row4.find((k) => k.value === "\u3081");
    expect(ne!.shiftValue).toBe("\u3001");
    expect(ru!.shiftValue).toBe("\u3002");
    expect(me!.shiftValue).toBe("\u30FB");
  });
});
