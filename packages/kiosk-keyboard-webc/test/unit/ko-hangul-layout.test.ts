import { describe, it, expect } from "vitest";
import koHangul from "../../src/layouts/ko-hangul.js";

describe("ko-hangul layout structure", () => {
  it("has exactly 5 rows", () => {
    expect(koHangul).toHaveLength(5);
  });

  it("row 1 has 11 keys (10 digits + backspace)", () => {
    expect(koHangul[0]).toHaveLength(11);
  });

  it("row 2 has 10 keys (Q-P jamo)", () => {
    expect(koHangul[1]).toHaveLength(10);
  });

  it("row 3 has 9 keys (A-L jamo)", () => {
    expect(koHangul[2]).toHaveLength(9);
  });

  it("row 4 has 11 keys (shift + 7 jamo + , . + enter)", () => {
    expect(koHangul[3]).toHaveLength(11);
  });

  it("row 5 has 5 keys", () => {
    expect(koHangul[4]).toHaveLength(5);
  });

  it("all jamo values are in the Hangul Compatibility Jamo range", () => {
    const jamoRange = /^[\u3131-\u3163]$/;
    const specialKeys = new Set(["{backspace}", "{enter}", "{shift}", " "]);
    const layoutKeys = new Set(["{layout:numeric}", "{layout:qwerty}", "{layout:fkeys}"]);
    const punctuation = new Set([",", ".", "?", "<", ">"]);
    const digits = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    const symbols = new Set(["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "/"]);

    for (const row of koHangul) {
      for (const key of row) {
        for (const v of [key.value, key.shiftValue].filter(Boolean) as string[]) {
          const isValid =
            jamoRange.test(v) ||
            specialKeys.has(v) ||
            layoutKeys.has(v) ||
            punctuation.has(v) ||
            digits.has(v) ||
            symbols.has(v);
          expect(isValid, `value "${v}" (U+${v.codePointAt(0)?.toString(16)}) should be valid`).toBe(true);
        }
      }
    }
  });

  it("tense consonant shift variants follow Dubeolsik standard", () => {
    const expectedShifts: Record<string, string> = {
      "\u3142": "\u3143", // ㅂ → ㅃ
      "\u3148": "\u3149", // ㅈ → ㅉ
      "\u3137": "\u3138", // ㄷ → ㄸ
      "\u3131": "\u3132", // ㄱ → ㄲ
      "\u3145": "\u3146", // ㅅ → ㅆ
    };

    const allKeys = koHangul.flat();
    for (const [base, expectedTense] of Object.entries(expectedShifts)) {
      const key = allKeys.find((k) => k.value === base);
      expect(key, `key for ${base} should exist`).toBeDefined();
      expect(key!.shiftValue, `shift of ${base} should be ${expectedTense}`).toBe(expectedTense);
    }
  });

  it("vowel shift variants follow Dubeolsik standard", () => {
    const expectedShifts: Record<string, string> = {
      "\u3150": "\u3152", // ㅐ → ㅒ
      "\u3154": "\u3156", // ㅔ → ㅖ
    };

    const allKeys = koHangul.flat();
    for (const [base, expectedShift] of Object.entries(expectedShifts)) {
      const key = allKeys.find((k) => k.value === base);
      expect(key, `key for ${base} should exist`).toBeDefined();
      expect(key!.shiftValue, `shift of ${base} should be ${expectedShift}`).toBe(expectedShift);
    }
  });

  it("has backspace, enter, shift, and space with correct types", () => {
    const allKeys = koHangul.flat();
    expect(allKeys.find((k) => k.value === "{backspace}")!.type).toBe("action");
    expect(allKeys.find((k) => k.value === "{enter}")!.type).toBe("action");
    expect(allKeys.find((k) => k.value === "{shift}")!.type).toBe("modifier");
    expect(allKeys.find((k) => k.value === " ")!.type).toBe("space");
  });

  it("home row contains all 9 standard Dubeolsik jamo", () => {
    const homeRow = koHangul[2];
    const expectedJamo = [
      "\u3141", // ㅁ (A)
      "\u3134", // ㄴ (S)
      "\u3147", // ㅇ (D)
      "\u3139", // ㄹ (F)
      "\u314E", // ㅎ (G)
      "\u3157", // ㅗ (H)
      "\u3153", // ㅓ (J)
      "\u314F", // ㅏ (K)
      "\u3163", // ㅣ (L)
    ];

    for (let i = 0; i < expectedJamo.length; i++) {
      expect(homeRow[i].value).toBe(expectedJamo[i]);
    }
  });

  it("has layout switches for numeric, qwerty (ABC), and fkeys", () => {
    const allKeys = koHangul.flat();
    expect(allKeys.find((k) => k.value === "{layout:numeric}")).toBeDefined();
    expect(allKeys.find((k) => k.value === "{layout:fkeys}")).toBeDefined();
  });

  it("has ABC toggle pointing to qwerty for English input", () => {
    const allKeys = koHangul.flat();
    const toggle = allKeys.find((k) => k.value === "{layout:qwerty}");
    expect(toggle, "qwerty toggle key exists").toBeDefined();
    expect(toggle!.label).toBe("ABC");
    expect(toggle!.type).toBe("modifier");
  });

  it("has slash key with standard ?-on-shift ordering", () => {
    const allKeys = koHangul.flat();
    const slash = allKeys.find((k) => k.value === "/");
    expect(slash, "slash key exists").toBeDefined();
    expect(slash!.shiftValue).toBe("?");
  });
});
