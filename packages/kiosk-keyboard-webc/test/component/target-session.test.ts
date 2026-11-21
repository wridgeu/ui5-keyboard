import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import { requireKey } from "../helpers/fixtures.js";

describe("kiosk-keyboard - target switch", () => {
  it("setTargetElement commits a live preedit to the old input before switching", async () => {
    const box = await fixture<HTMLDivElement>(html`
      <div>
        <input id="ts-a" />
        <input id="ts-b" value="xyz" />
        <kiosk-keyboard layout="ko-hangul"></kiosk-keyboard>
      </div>
    `);
    const kb = box.querySelector<KioskKeyboard>("kiosk-keyboard")!;
    const a = box.querySelector<HTMLInputElement>("#ts-a")!;
    const b = box.querySelector<HTMLInputElement>("#ts-b")!;
    await renderFinished();
    kb.setTargetElement(a);
    let ends = 0;
    a.addEventListener("compositionend", () => ends++);

    requireKey(kb, "ㄱ").click();
    kb.setTargetElement(b);
    b.setSelectionRange(3, 3);
    requireKey(kb, "ㅏ").click();

    expect(b.value, "the new input is typed at its own caret").to.equal("xyzㅏ");
    expect(ends, "the old input's composition ended").to.equal(1);
  });
});
