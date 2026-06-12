import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import { requireKey } from "../helpers/fixtures.js";

const nextRender = renderFinished;

/**
 * Shift-reset contract for a target switch, matching the UI5 twin: a real
 * switch (a different target) starts a fresh input context and disarms shift,
 * but re-targeting the SAME element is a caret reposition and preserves the
 * armed shift. Asserted through the casing of the character the next key types,
 * so the test exercises the user-visible behavior rather than internal state.
 */
describe("kiosk-keyboard - shift-reset contract on target switch", () => {
  async function setup(): Promise<{ kb: KioskKeyboard; a: HTMLInputElement; b: HTMLInputElement }> {
    const container = await fixture(html`
      <div>
        <input id="shift-a" type="text" />
        <input id="shift-b" type="text" />
        <kiosk-keyboard layout="qwerty"></kiosk-keyboard>
      </div>
    `);
    const a = container.querySelector<HTMLInputElement>("#shift-a")!;
    const b = container.querySelector<HTMLInputElement>("#shift-b")!;
    const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
    kb.setTargetElement(a);
    await nextRender();
    return { kb, a, b };
  }

  it("preserves the armed shift when re-setting the SAME target element", async () => {
    const { kb, a } = await setup();
    requireKey(kb, "{shift}").click();
    await nextRender();

    kb.setTargetElement(a); // same element: a caret reposition, not a new context
    await nextRender();

    requireKey(kb, "q").click();
    expect(a.value, "shift stays armed across a same-target re-set").to.equal("Q");
  });

  it("disarms shift when switching to a DIFFERENT target element", async () => {
    const { kb, b } = await setup();
    requireKey(kb, "{shift}").click();
    await nextRender();

    kb.setTargetElement(b); // real switch: fresh input context
    await nextRender();

    requireKey(kb, "q").click();
    expect(b.value, "shift resets on a real target switch").to.equal("q");
  });

  it("disarms shift on the auto-show focus-in path when the target changes", async () => {
    const container = await fixture(html`
      <div>
        <input id="fi-a" type="text" />
        <input id="fi-b" type="text" />
        <kiosk-keyboard layout="qwerty" docked auto-show></kiosk-keyboard>
      </div>
    `);
    const a = container.querySelector<HTMLInputElement>("#fi-a")!;
    const b = container.querySelector<HTMLInputElement>("#fi-b")!;
    const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
    await nextRender();

    // Auto-show claims input a on focus-in.
    a.focus();
    a.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await nextRender();

    requireKey(kb, "{shift}").click();
    await nextRender();

    // Focusing a different input is a real switch and must disarm shift.
    b.focus();
    b.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await nextRender();

    requireKey(kb, "q").click();
    expect(b.value, "focus-in to a new target resets shift").to.equal("q");
  });
});
