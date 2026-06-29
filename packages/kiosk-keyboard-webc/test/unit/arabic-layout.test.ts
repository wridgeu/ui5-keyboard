import { describe, it, expect } from "vitest";
import arabic from "../../src/layouts/arabic.js";

describe("arabic layout structure", () => {
  it("has exactly 5 rows", () => {
    expect(arabic).toHaveLength(5);
  });

  it.each([
    [0, 11, "row 1 has 11 keys (10 digits + backspace)"],
    [1, 11, "row 2 has 11 keys (Arabic letters top row)"],
    [2, 11, "row 3 has 11 keys (Arabic letters home row)"],
    [3, 11, "row 4 has 11 keys (shift + 8 letters + enter)"],
    [4, 5, "row 5 has 5 keys (numeric switch + comma + space + period + fn)"],
  ] as [number, number, string][])("$2", (rowIndex, expectedLength) => {
    expect(arabic[rowIndex]).toHaveLength(expectedLength);
  });

  it("digit row has Western Arabic numerals with Arabic-Indic shift values", () => {
    const digits = arabic[0].slice(0, 10);
    const westernDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    const indicDigits = [
      "\u0661",
      "\u0662",
      "\u0663",
      "\u0664",
      "\u0665",
      "\u0666",
      "\u0667",
      "\u0668",
      "\u0669",
      "\u0660",
    ];
    digits.forEach((key, i) => {
      expect(key.value).toBe(westernDigits[i]);
      expect(key.shiftValue).toBe(indicDigits[i]);
    });
  });

  it("letter rows contain Arabic characters (U+0600-U+06FF range)", () => {
    const arabicRange = /^[\u0600-\u06FF]+$/;
    // Rows 2, 3, and 4 contain Arabic letter keys (among special keys)
    const specialValues = new Set(["{backspace}", "{enter}", "{shift}", " ", "{layout:numeric}", "{layout:fkeys}"]);

    for (const rowIndex of [1, 2, 3]) {
      for (const key of arabic[rowIndex]) {
        if (specialValues.has(key.value)) continue;
        expect(key.value, `row ${rowIndex + 1} key value "${key.value}"`).toMatch(arabicRange);
      }
    }
  });

  it("shift layer includes Arabic diacritical marks (tashkeel)", () => {
    // Row 2 shift values should include diacritical marks
    const shiftValues = arabic[1].map((k) => k.shiftValue).filter(Boolean) as string[];
    const diacritics = ["\u0651", "\u064B", "\u064C", "\u064D", "\u064E", "\u064F", "\u0650", "\u0652"];
    for (const d of diacritics) {
      expect(shiftValues).toContain(d);
    }
  });

  it("has backspace, enter, shift, and space with correct types", () => {
    const allKeys = arabic.flat();
    expect(allKeys.find((k) => k.value === "{backspace}")!.type).toBe("action");
    expect(allKeys.find((k) => k.value === "{enter}")!.type).toBe("action");
    expect(allKeys.find((k) => k.value === "{shift}")!.type).toBe("modifier");
    expect(allKeys.find((k) => k.value === " ")!.type).toBe("space");
  });

  it("has layout switches for numeric and fkeys", () => {
    const allKeys = arabic.flat();
    expect(allKeys.find((k) => k.value === "{layout:numeric}")).toBeDefined();
    expect(allKeys.find((k) => k.value === "{layout:fkeys}")).toBeDefined();
  });

  it("bottom row comma key uses Arabic comma U+060C", () => {
    const commaKey = arabic[4][1];
    expect(commaKey.value).toBe("\u060C");
  });
});
