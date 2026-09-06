import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutChangeEventDetail } from "../../src/types.js";
import { readDataKeys, requireKey } from "../helpers/fixtures.js";

const nextRender = renderFinished;

/**
 * `{layout:base}` on a keyboard whose `layout` attribute names a secondary layout
 * (#296): the ABC key returns to the alphabetic layout, and the tap that does it
 * announces that switch once - not the layout already on screen.
 */
describe("kiosk-keyboard - {layout:base} from an authored secondary layout (#296)", () => {
  it("returns to the alphabetic layout and fires one layout-change", async () => {
    const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="fkeys"></kiosk-keyboard> `);
    await nextRender();
    expect(readDataKeys(el).flat(), "precondition: the authored secondary layout renders").to.include("{fkey:F1}");

    const changes: LayoutChangeEventDetail[] = [];
    el.addEventListener("layout-change", (e) => changes.push((e as CustomEvent<LayoutChangeEventDetail>).detail));

    requireKey(el, "{layout:base}").click();
    await nextRender();

    expect(readDataKeys(el).flat(), "the alphabetic layout is on screen").to.include("q");
    expect(
      changes.map((c) => c.layout),
      "one change, naming the layout switched to",
    ).to.deep.equal(["qwerty"]);
  });
});
