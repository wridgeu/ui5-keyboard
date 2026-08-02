import { describe, it, expect } from "vitest";
import fkeyRow from "../../src/layouts/fkey-row.js";
import fkeyRowCompact from "../../src/layouts/fkey-row-compact.js";
import fkeys from "../../src/layouts/fkeys.js";
import { classifyRow } from "../../src/core/dom-utils.js";

const values = (rows: typeof fkeyRowCompact) => rows.map((row) => row.map((key) => key.value));

describe("fkeyRowCompact", () => {
  it("splits the twelve function keys into F1-F6 over F7-F12", () => {
    expect(values(fkeyRowCompact)).toEqual([
      ["{fkey:F1}", "{fkey:F2}", "{fkey:F3}", "{fkey:F4}", "{fkey:F5}", "{fkey:F6}"],
      ["{fkey:F7}", "{fkey:F8}", "{fkey:F9}", "{fkey:F10}", "{fkey:F11}", "{fkey:F12}"],
    ]);
  });

  it("carries every fkeyRow key exactly once", () => {
    const flat = values(fkeyRowCompact).flat();

    expect(flat).toHaveLength(fkeyRow.length);
    expect(new Set(flat)).toEqual(new Set(fkeyRow.map((key) => key.value)));
  });

  // Arrow-key navigation moves on layout coordinates, so a column shared between
  // the two rows is what makes F1 and F7 reachable from one another. A single
  // twelve-key row wrapped in CSS stays one logical row and cannot provide it.
  it("seats each second-row key directly below its first-row counterpart", () => {
    const [first, second] = values(fkeyRowCompact);

    expect(second).toHaveLength(first!.length);
    expect(second![0]).toBe("{fkey:F7}");
  });

  it("classifies both rows as fkey", () => {
    expect(fkeyRowCompact.map((row) => classifyRow(row))).toEqual(["fkey", "fkey"]);
  });

  // The standalone layout is built from this module, so the two cannot drift.
  it("supplies the first two rows of the built-in fkeys layout", () => {
    expect(fkeys.slice(0, 2)).toEqual(fkeyRowCompact);
  });
});
