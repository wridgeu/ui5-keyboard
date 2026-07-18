import { expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutDefinition } from "../../src/types.js";
import { requireKey, setupWithLayout } from "../helpers/fixtures.js";

const DOM = KioskKeyboard.DOM;

// #176: CapsLock is an uppercase mode, not a Shift alias. A key whose shiftValue
// is uncased (the arabic layout's Arabic-Indic digit row, an ASCII symbol row)
// keeps its base under CapsLock; a key whose shiftValue is a cased letter (the
// qwerty-es accent keys) has that letter uppercased. One-shot Shift still types
// the shiftValue verbatim in both cases (the #162 invariant), and each cap
// tracks what it types.
const LAYOUT: LayoutDefinition = [
  [
    { value: "1", shiftValue: "١" },
    { value: "e", shiftValue: "é" },
    { value: "{shift}", type: "modifier" },
  ],
];

/** The rendered visible label text of a key. */
function labelOf(kb: KioskKeyboard, value: string): string {
  return requireKey(kb, value).querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`)?.textContent ?? "";
}

/** Engages CapsLock via two rapid {shift} clicks (double-click within the window). */
async function engageCapsLock(kb: KioskKeyboard): Promise<void> {
  requireKey(kb, "{shift}").click();
  requireKey(kb, "{shift}").click();
  await renderFinished();
}

describe("CapsLock is uppercase-mode, not a Shift alias (#176)", () => {
  it("CapsLock + a digit key keeps the digit, cap and emit agreeing", async () => {
    const { kb, input } = await setupWithLayout(LAYOUT);

    await engageCapsLock(kb);

    expect(labelOf(kb, "1"), "the cap keeps the digit under CapsLock").to.equal("1");

    requireKey(kb, "1").click();
    expect(input.value, "CapsLock + 1 inserts 1, not the Arabic-Indic ١").to.equal("1");
  });

  it("CapsLock + an accented-letter shiftValue uppercases it", async () => {
    const { kb, input } = await setupWithLayout(LAYOUT);

    await engageCapsLock(kb);

    expect(labelOf(kb, "e"), "the cap shows the uppercased accent").to.equal("É");

    requireKey(kb, "e").click();
    expect(input.value, "CapsLock + e inserts É, keeping accent access").to.equal("É");
  });

  it("Shift (one-shot) + a digit key still inserts its shiftValue (the #162 invariant)", async () => {
    const { kb, input } = await setupWithLayout(LAYOUT);

    requireKey(kb, "{shift}").click();
    await renderFinished();

    expect(labelOf(kb, "1"), "the cap shows the Arabic-Indic digit under Shift").to.equal("١");

    requireKey(kb, "1").click();
    expect(input.value, "one-shot Shift keeps the Arabic-Indic digit").to.equal("١");
  });
});
