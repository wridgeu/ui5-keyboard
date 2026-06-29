import { describe, it, expect } from "vitest";
import qwertyEs from "../../src/layouts/qwerty-es.js";

describe("qwerty-es layout structure", () => {
  it("has exactly 5 rows", () => {
    expect(qwertyEs).toHaveLength(5);
  });

  it.each([
    [0, 11, "row 1 has 11 keys (10 digits + backspace)"],
    [1, 10, "row 2 has 10 keys (Q-P)"],
    [2, 10, "row 3 has 10 keys (A-L + ñ)"],
    [3, 9, "row 4 has 9 keys (shift + Z-M + enter)"],
    [4, 6, "row 5 has 6 keys"],
  ] as [number, number, string][])("$2", (rowIndex, expectedLength) => {
    expect(qwertyEs[rowIndex]).toHaveLength(expectedLength);
  });

  it("has dedicated ñ key on the home row", () => {
    const homeRow = qwertyEs[2];
    const lastKey = homeRow[homeRow.length - 1];
    expect(lastKey.value).toBe("\u00F1"); // ñ
  });

  it("accented vowels are on the shift layer", () => {
    const allKeys = qwertyEs.flat();
    const expectedShifts: Record<string, string> = {
      a: "\u00E1", // á
      e: "\u00E9", // é
      i: "\u00ED", // í
      o: "\u00F3", // ó
      u: "\u00FA", // ú
    };

    for (const [base, expectedAccent] of Object.entries(expectedShifts)) {
      const key = allKeys.find((k) => k.value === base);
      expect(key, `key for "${base}" should exist`).toBeDefined();
      expect(key!.shiftValue, `shift of "${base}" should be "${expectedAccent}"`).toBe(expectedAccent);
    }
  });

  it("has inverted punctuation ¿ with ¡ on shift", () => {
    const allKeys = qwertyEs.flat();
    const invQuestion = allKeys.find((k) => k.value === "\u00BF");
    expect(invQuestion, "¿ key exists").toBeDefined();
    expect(invQuestion!.shiftValue).toBe("\u00A1"); // ¡
  });

  it("has Spanish number row shift symbols", () => {
    const row1 = qwertyEs[0];
    expect(row1[1].shiftValue).toBe('"'); // 2 → "
    expect(row1[5].shiftValue).toBe("&"); // 6 → &
    expect(row1[6].shiftValue).toBe("/"); // 7 → /
    expect(row1[9].shiftValue).toBe("="); // 0 → =
  });

  it("has backspace, enter, shift, and space with correct types", () => {
    const allKeys = qwertyEs.flat();
    expect(allKeys.find((k) => k.value === "{backspace}")!.type).toBe("action");
    expect(allKeys.find((k) => k.value === "{enter}")!.type).toBe("action");
    expect(allKeys.find((k) => k.value === "{shift}")!.type).toBe("modifier");
    expect(allKeys.find((k) => k.value === " ")!.type).toBe("space");
  });

  it("has comma/semicolon and period/colon on bottom row", () => {
    const allKeys = qwertyEs.flat();
    const comma = allKeys.find((k) => k.value === ",");
    const period = allKeys.find((k) => k.value === ".");
    expect(comma!.shiftValue).toBe(";");
    expect(period!.shiftValue).toBe(":");
  });
});
