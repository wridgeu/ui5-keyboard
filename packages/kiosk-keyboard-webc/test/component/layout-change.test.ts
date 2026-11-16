import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutChangeEventDetail, LayoutDefinition } from "../../src/types.js";
import { customLayout, requireKey } from "../helpers/fixtures.js";
import { withCapturedWarnings } from "../helpers/console.js";

const rows: LayoutDefinition = [[{ value: "ax" }, { value: "bx" }]];

/** Lets a slot change reach the fold and the deferred refresh it queues. */
async function settle(): Promise<void> {
  await renderFinished();
  await new Promise((resolve) => setTimeout(resolve));
  await renderFinished();
}

function record(el: KioskKeyboard): LayoutChangeEventDetail[] {
  const changes: LayoutChangeEventDetail[] = [];
  el.addEventListener("layout-change", (e) => changes.push((e as CustomEvent<LayoutChangeEventDetail>).detail));
  return changes;
}

describe("kiosk-keyboard - layout-change reports the intent and the effective layout", () => {
  it("reports the fallback for a not-yet-slotted request, then the layout once it is slotted", async () => {
    await withCapturedWarnings(async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await settle();
      const changes = record(el);

      el.layout = "late1";
      await settle();
      expect(el.effectiveLayout, "precondition: the fallback renders").to.equal("qwerty");

      el.appendChild(customLayout({ name: "late1", rows }));
      await settle();

      expect(el.effectiveLayout).to.equal("late1");
      expect(changes).to.deep.equal([
        { layout: "late1", effectiveLayout: "qwerty", reason: "api" },
        { layout: "late1", effectiveLayout: "late1", reason: "layouts" },
      ]);
    });
  });

  it("fires once when the requested layout is removed from the slot", async () => {
    await withCapturedWarnings(async () => {
      const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
      el.setAttribute("layout", "late1");
      const child = customLayout({ name: "late1", rows });
      el.appendChild(child);
      await fixture(el);
      await settle();
      expect(el.effectiveLayout, "precondition: the slotted layout renders").to.equal("late1");
      const changes = record(el);

      child.remove();
      await settle();

      expect(el.effectiveLayout).to.equal("qwerty");
      expect(el.layout, "the intent outlives its layout").to.equal("late1");
      expect(changes).to.deep.equal([{ layout: "late1", effectiveLayout: "qwerty", reason: "layouts" }]);
    });
  });

  it("fires once when a keyboardType constraint takes effect, and once when it lifts", async () => {
    const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwertz-de"></kiosk-keyboard> `);
    await settle();
    const changes = record(el);

    el.keyboardType = "Numeric";
    await settle();
    expect(el.effectiveLayout).to.equal("numeric");
    el.keyboardType = "Full";
    await settle();
    expect(el.effectiveLayout).to.equal("qwertz-de");
    expect(changes).to.deep.equal([
      { layout: "qwertz-de", effectiveLayout: "numeric", reason: "keyboardType" },
      { layout: "qwertz-de", effectiveLayout: "qwertz-de", reason: "keyboardType" },
    ]);
  });

  it("reports an auto-detected keyboardType the same way", async () => {
    const container = await fixture(html`
      <div>
        <input id="lc-num-input" type="number" />
        <kiosk-keyboard layout="qwertz-de" docked auto-show auto-type controls="lc-num-input"></kiosk-keyboard>
      </div>
    `);
    const input = container.querySelector<HTMLInputElement>("#lc-num-input")!;
    const el = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
    await settle();
    const changes = record(el);

    input.focus();
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await settle();

    expect(el.layout, "detection leaves the intent alone").to.equal("qwertz-de");
    expect(changes).to.deep.equal([{ layout: "qwertz-de", effectiveLayout: "numpad", reason: "keyboardType" }]);
  });

  it("fires once, naming the fallback, when `layout` names a layout that never arrives", async () => {
    await withCapturedWarnings(async () => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwertz-de"></kiosk-keyboard> `);
      await settle();
      const changes = record(el);

      el.layout = "no-such-layout";
      await settle();

      expect(el.effectiveLayout).to.equal("qwerty");
      expect(changes).to.deep.equal([{ layout: "no-such-layout", effectiveLayout: "qwerty", reason: "api" }]);
    });
  });

  it("fires once, naming the layout, for a layout appended and selected in the same task", async () => {
    const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwertz-de"></kiosk-keyboard> `);
    await settle();
    const changes = record(el);

    el.appendChild(customLayout({ name: "late1", rows }));
    el.layout = "late1";
    await settle();

    expect(el.effectiveLayout, "precondition: the appended layout renders").to.equal("late1");
    expect(changes, "the fallback that never painted is not reported").to.deep.equal([
      { layout: "late1", effectiveLayout: "late1", reason: "api" },
    ]);
  });

  it("setting `layout` to the intent it holds keeps a secondary pick; reset() drops it", async () => {
    const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
    await settle();
    const changes = record(el);

    requireKey(el, "{layout:numeric}").click();
    await settle();
    el.layout = "qwerty";
    await settle();
    expect(el.effectiveLayout, "the same value is a no-op").to.equal("numeric");

    el.reset();
    await settle();
    expect(el.effectiveLayout).to.equal("qwerty");
    expect(changes).to.deep.equal([
      { layout: "qwerty", effectiveLayout: "numeric", reason: "user" },
      { layout: "qwerty", effectiveLayout: "qwerty", reason: "api" },
    ]);
  });
});
