import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import { queryKey, requireKey } from "../helpers/fixtures.js";

const nextRender = renderFinished;

/**
 * reset() contract for the web-component twin, matching the UI5 twin: it
 * restores a fresh input context on a reused instance (clears the shift/caps
 * latch, returns to the base layout) without touching the bound target value.
 * This is the #199 case the demo's reused loadFragment dialog hit. Asserted
 * through the casing of the next typed key and the rendered surface, not
 * internal state.
 */
describe("kiosk-keyboard - reset() restores a fresh input context (#199)", () => {
  async function setup(): Promise<{ kb: KioskKeyboard; input: HTMLInputElement }> {
    const container = await fixture(html`
      <div>
        <input id="reset-target" type="text" />
        <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
      </div>
    `);
    const input = container.querySelector<HTMLInputElement>("#reset-target")!;
    const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
    kb.setTargetElement(input);
    await nextRender();
    return { kb, input };
  }

  it("clears a one-shot armed Shift so the next key types lowercase", async () => {
    const { kb, input } = await setup();
    requireKey(kb, "{shift}").click();
    await nextRender();

    kb.reset();
    await nextRender();

    requireKey(kb, "q").click();
    expect(input.value, "shift is disarmed after reset").to.equal("q");
  });

  it("clears a latched Caps Lock", async () => {
    const { kb, input } = await setup();
    // Two rapid {shift} clicks latch Caps Lock (double-click within the window).
    requireKey(kb, "{shift}").click();
    requireKey(kb, "{shift}").click();
    await nextRender();

    // Two consecutive uppercase keys prove the latch is sticky - a one-shot
    // Shift would disarm after the first - so the reset below can only stay
    // green by clearing a real Caps Lock rather than an already-off state.
    requireKey(kb, "q").click();
    requireKey(kb, "q").click();
    expect(input.value, "caps lock latches uppercase across keys").to.equal("QQ");

    kb.reset();
    await nextRender();

    requireKey(kb, "q").click();
    expect(input.value, "caps lock is cleared after reset").to.equal("QQq");
  });

  it("returns to the base layout after a secondary-layout switch", async () => {
    const { kb } = await setup();
    kb.layout = "numeric";
    await nextRender();

    kb.reset();
    await nextRender();

    // Back on the base layout, the alphabetic "q" key is rendered again.
    expect(queryKey(kb, "q"), "reset returns to the base layout").to.not.be.null;
  });

  it("does not touch the already-typed target value", async () => {
    const { kb, input } = await setup();
    requireKey(kb, "q").click();
    requireKey(kb, "q").click();
    expect(input.value, "text is typed into the target").to.equal("qq");

    kb.reset();
    await nextRender();
    expect(input.value, "reset leaves the bound target value untouched").to.equal("qq");
  });
});
