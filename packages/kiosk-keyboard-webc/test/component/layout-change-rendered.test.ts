import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutChangeEventDetail, LayoutDefinition } from "../../src/types.js";
import { customLayout } from "../helpers/fixtures.js";
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

describe("kiosk-keyboard - layout-change follows the rendered layout", () => {
  it("fires once when a requested layout is slotted after the request", async () => {
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
      expect(changes).to.deep.equal([{ layout: "late1", requestedLayout: "late1", autoDetected: true }]);
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
      expect(changes).to.deep.equal([{ layout: "qwerty", requestedLayout: "late1", autoDetected: true }]);
    });
  });

  it("fires once when a keyboardType constraint takes effect, and once when it lifts", async () => {
    const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwertz-de"></kiosk-keyboard> `);
    await settle();
    const changes = record(el);

    el.keyboardType = "Numeric";
    await settle();
    expect(el.effectiveLayout).to.equal("numeric");
    expect(changes).to.deep.equal([{ layout: "numeric", requestedLayout: "qwertz-de", autoDetected: true }]);

    el.keyboardType = "Full";
    await settle();
    expect(el.effectiveLayout).to.equal("qwertz-de");
    expect(changes.slice(1)).to.deep.equal([{ layout: "qwertz-de", requestedLayout: "qwertz-de", autoDetected: true }]);
  });
});
