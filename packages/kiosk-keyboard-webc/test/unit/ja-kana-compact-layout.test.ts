import { describe, it, expect } from "vitest";
import jaKana from "../../src/layouts/ja-kana.js";
import jaKanaCompact from "../../src/layouts/ja-kana-compact.js";
import type { KeyDefinition } from "../../src/types.js";

/** The flex-grow a key claims, which is what a row's width is measured in. */
function widthUnits(key: KeyDefinition): number {
  if (key.width === undefined) return 1;
  if (key.width === "space") return 6;
  return Number(key.width);
}

const values = (layout: readonly (readonly KeyDefinition[])[]) => new Set(layout.flat().map((key) => key.value));

describe("ja-kana-compact layout structure", () => {
  it("has exactly 5 rows", () => {
    expect(jaKanaCompact).toHaveLength(5);
  });

  it.each([
    [0, 12, "row 1 has 12 keys (11 kana + ー)"],
    [1, 12, "row 2 has 12 keys (10 kana + dakuten + handakuten)"],
    [2, 12, "row 3 has 12 keys (10 kana + け + む)"],
    [3, 11, "row 4 has 11 keys (10 kana + ろ)"],
    [4, 7, "row 5 has 7 action and layout-switch keys"],
  ] as [number, number, string][])("$2", (rowIndex, expectedLength) => {
    expect(jaKanaCompact[rowIndex]).toHaveLength(expectedLength);
  });

  // The reason the layout exists. Twelve widths is what a 320px keyboard seats at
  // the 24 CSS px spacing WCAG 2.2 SC 2.5.8 accepts once the inline target-size
  // floor is lifted below 20rem; the wide form's 12.5 and 13 do not.
  it("holds every row to twelve key widths", () => {
    for (const [index, row] of jaKanaCompact.entries()) {
      const units = row.reduce((sum, key) => sum + widthUnits(key), 0);
      expect(units, `row ${index + 1} claims at most 12 widths`).toBeLessThanOrEqual(12);
    }
  });

  it("keeps every key of the wide form but its duplicate 。", () => {
    const wide = values(jaKana);
    const compact = values(jaKanaCompact);
    // 。 is the wide form's standalone convenience key; it survives as the shift
    // layer of る, which this form keeps.
    expect([...wide].filter((value) => !compact.has(value))).toEqual(["。"]);
    expect([...compact].filter((value) => !wide.has(value))).toEqual([]);
  });

  it("carries the wide form's key definitions verbatim, the spacebar's span apart", () => {
    const wide = new Map(jaKana.flat().map((key) => [key.value, key]));
    for (const key of jaKanaCompact.flat()) {
      if (key.value === " ") {
        expect(key, "the spacebar is the wide one at a narrower span").toEqual({ ...wide.get(" "), width: "2.75" });
      } else {
        expect(key, `'${key.value}' is the wide form's own definition`).toBe(wide.get(key.value));
      }
    }
  });
});
