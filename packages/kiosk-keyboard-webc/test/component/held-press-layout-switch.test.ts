import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import { customLayout, requireKey } from "../helpers/fixtures.js";

const DOM = KioskKeyboard.DOM;

/** Mounts a keyboard and records the `key` of every `key-press` it fires. */
async function setup(layout: string): Promise<{ kb: KioskKeyboard; typed: string[] }> {
  const kb = await fixture<KioskKeyboard>(html`<kiosk-keyboard layout="${layout}"></kiosk-keyboard>`);
  await renderFinished();
  const typed: string[] = [];
  kb.addEventListener("key-press", (e: Event) => typed.push((e as CustomEvent<{ key: string }>).detail.key));
  return { kb, typed };
}

function pressedKeys(kb: KioskKeyboard): string[] {
  return Array.from(kb.shadowRoot!.querySelectorAll<HTMLElement>(`.${DOM.classes.keyPressed}`)).map(
    (el) => el.dataset.key!,
  );
}

describe("a press held across a layout switch", () => {
  it("a mouse press held while the layout switches types nothing on release", async () => {
    const { kb, typed } = await setup("qwerty");
    const q = requireKey(kb, "q");

    q.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, button: 0, pointerId: 1 }));
    kb.layout = "numeric";
    await renderFinished();
    expect(q.dataset.key, "Precondition: the held element now carries the key at q's position").to.equal("-");

    // The browser targets the release click at the element the press began on.
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    q.click();

    expect(typed).to.deep.equal([]);
  });

  it("a keycap activated with the pointer after a cancelled press types again", async () => {
    const { kb, typed } = await setup("qwerty");
    const q = requireKey(kb, "q");

    q.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, button: 0, pointerId: 1 }));
    kb.layout = "numeric";
    await renderFinished();
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    q.click();

    const five = requireKey(kb, "5");
    five.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, button: 0, pointerId: 1 }));
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    five.click();

    expect(typed).to.deep.equal(["5"]);
  });

  it("a Space held on the (0,0) key while the layout switches types nothing on release", async () => {
    // At (0,0) the focus fallback lands on the held element itself, so no focusout
    // drops the press by accident.
    const kb = await fixture<KioskKeyboard>(html`
      <kiosk-keyboard layout="press-a">
        ${customLayout({ name: "press-a", rows: [[{ value: "a" }, { value: "b" }]] })}
        ${customLayout({ name: "press-b", rows: [[{ value: "x" }, { value: "y" }]] })}
      </kiosk-keyboard>
    `);
    await renderFinished();
    const typed: string[] = [];
    kb.addEventListener("key-press", (e: Event) => typed.push((e as CustomEvent<{ key: string }>).detail.key));
    const a = requireKey(kb, "a");
    a.focus();

    a.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    kb.layout = "press-b";
    await renderFinished();
    expect(a.dataset.key, "Precondition: the held element now carries the key at a's position").to.equal("x");
    a.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true }));

    expect(typed).to.deep.equal([]);
  });

  it("a layout key at (0,0) activated with Enter leaves no press on the new (0,0) key", async () => {
    const kb = await fixture<KioskKeyboard>(html`
      <kiosk-keyboard layout="press-a">
        ${customLayout({ name: "press-a", rows: [[{ value: "{layout:press-b}" }, { value: "a" }]] })}
        ${customLayout({ name: "press-b", rows: [[{ value: "x" }, { value: "y" }]] })}
      </kiosk-keyboard>
    `);
    await renderFinished();

    const toggle = requireKey(kb, "{layout:press-b}");
    toggle.focus();
    toggle.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await renderFinished();
    expect(toggle.dataset.key, "Precondition: the layout switched under the focused key").to.equal("x");

    expect(pressedKeys(kb), "No key of the new layout reads as pressed while Enter is still down").to.deep.equal([]);
  });
});
