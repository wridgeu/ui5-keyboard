import { describe, it, expect } from "vitest";
import navRow from "../../src/layouts/nav-row.js";
import navRowCompact from "../../src/layouts/nav-row-compact.js";
import { classifyRow } from "../../src/core/dom-utils.js";

const values = (rows: typeof navRowCompact) => rows.map((row) => row.map((key) => key.value));

describe("navRowCompact", () => {
  // Pins the slice boundaries against navRow's source order: reordering navRow
  // without revisiting the slices would silently rearrange the compact form.
  // Arrow-key navigation moves on layout coordinates, so the column Up shares
  // with Down is what makes the two reachable from one another.
  it("arranges the eight nav keys as a position row over an arrow row", () => {
    expect(values(navRowCompact)).toEqual([
      ["{fkey:Home}", "{fkey:ArrowUp}", "{fkey:End}", "{fkey:PageUp}"],
      ["{fkey:ArrowLeft}", "{fkey:ArrowDown}", "{fkey:ArrowRight}", "{fkey:PageDown}"],
    ]);
  });

  it("carries every navRow key exactly once", () => {
    const flat = values(navRowCompact).flat();

    expect(flat).toHaveLength(navRow.length);
    expect(new Set(flat)).toEqual(new Set(navRow.map((key) => key.value)));
  });

  it("classifies both rows as nav", () => {
    expect(navRowCompact.map((row) => classifyRow(row))).toEqual(["nav", "nav"]);
  });
});
