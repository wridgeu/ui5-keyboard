import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";

const nextRender = renderFinished;

// Runs in the `coarse-pointer` group of web-test-runner.config.mjs, whose browser
// context emulates touch so `(pointer: coarse)` matches. On a fine pointer `Auto`
// opens too, which leaves `Custom` indistinguishable from it.
describe("kiosk-keyboard - mobileKeyboard on a coarse pointer", () => {
  async function mountDocked(mode: string): Promise<KioskKeyboard> {
    const el = await fixture<KioskKeyboard>(html`
      <kiosk-keyboard layout="qwerty" docked mobile-keyboard="${mode}"></kiosk-keyboard>
    `);
    await nextRender();
    return el;
  }

  it("mobileKeyboard='Auto' defers to the native keyboard", async () => {
    expect(matchMedia("(pointer: coarse)").matches, "precondition: the group emulates touch").to.equal(true);
    const el = await mountDocked("Auto");
    el.show();
    await nextRender();
    expect(el.open).to.be.false;
  });

  it("mobileKeyboard='Custom' opens the docked keyboard anyway", async () => {
    const el = await mountDocked("Custom");
    el.show();
    await nextRender();
    expect(el.open).to.be.true;
  });
});
