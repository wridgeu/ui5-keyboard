import { expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutDefinition } from "../../src/types.js";
import { requireKey, setupWithLayout } from "../helpers/fixtures.js";

const DOM = KioskKeyboard.DOM;

// #169: pressing the base ß key with CapsLock engaged emits the capital sharp S
// ẞ (U+1E9E) directly, not only via the accent-variant popup. One-shot Shift on
// the same key still yields its physical "?" symbol (the #162 invariant), and the
// cap tracks what it types.
//
// The layout mirrors qwertz-de's ß key: base "ß" with an explicit "?" shiftValue,
// which under CapsLock must be bypassed in favour of ẞ.
const LAYOUT: LayoutDefinition = [
  [
    { value: "ß", shiftValue: "?" },
    { value: "{shift}", type: "modifier" },
  ],
];

/** The rendered visible label text of a key. */
function labelOf(kb: KioskKeyboard, value: string): string {
  return requireKey(kb, value).querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`)?.textContent ?? "";
}

describe("CapsLock emits ẞ from the base ß key (#169)", () => {
  it("CapsLock + ß inserts ẞ and relabels the cap to ẞ", async () => {
    const { kb, input } = await setupWithLayout(LAYOUT);

    // Two rapid {shift} clicks engage CapsLock (double-click within the window).
    requireKey(kb, "{shift}").click();
    requireKey(kb, "{shift}").click();
    await renderFinished();

    expect(labelOf(kb, "ß"), "the cap shows ẞ under CapsLock").to.equal("ẞ");

    requireKey(kb, "ß").click();
    expect(input.value, "CapsLock + ß inserts ẞ, not ? and not SS").to.equal("ẞ");
  });

  it("Shift (one-shot) + ß still inserts ? (the #162 invariant)", async () => {
    const { kb, input } = await setupWithLayout(LAYOUT);

    requireKey(kb, "{shift}").click();
    await renderFinished();

    expect(labelOf(kb, "ß"), "the cap shows the physical ? symbol under Shift").to.equal("?");

    requireKey(kb, "ß").click();
    expect(input.value, "one-shot Shift keeps the physical ? symbol").to.equal("?");
  });
});
