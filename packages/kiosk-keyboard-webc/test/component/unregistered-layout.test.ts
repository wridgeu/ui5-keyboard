import { fixture, html, expect } from "@open-wc/testing";
import { withCapturedWarnings } from "../helpers/console.js";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutDefinition } from "../../src/types.js";
import { customLayout, readDataKeys } from "../helpers/fixtures.js";

const nextRender = renderFinished;

const layoutA: LayoutDefinition = [[{ value: "ax" }, { value: "bx" }]];

describe("kiosk-keyboard - unregistered layout", () => {
  it("warns and keeps the current layout when `layout` names nothing registered", async () => {
    await withCapturedWarnings(async (messages) => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();
      const before = readDataKeys(el);

      el.layout = "does-not-exist";
      await nextRender();

      expect(messages.some((m) => m.includes("does-not-exist"))).to.equal(true);
      // The keyboard keeps rendering the layout it had, rather than an empty surface.
      expect(readDataKeys(el)).to.deep.equal(before);
    });
  });

  it("does not warn when `layout` names a layout supplied through a custom layout", async () => {
    await withCapturedWarnings(async (messages) => {
      const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
      el.setAttribute("layout", "qwerty");
      el.appendChild(customLayout({ name: "warehouse-pos", rows: layoutA }));
      await fixture(el);
      await nextRender();

      el.layout = "warehouse-pos";
      await nextRender();

      expect(messages.some((m) => m.includes("warehouse-pos"))).to.equal(false);
      expect(readDataKeys(el)).to.deep.equal([["ax", "bx"]]);
    });
  });

  it("does not warn for a built-in layout", async () => {
    await withCapturedWarnings(async (messages) => {
      const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
      await nextRender();

      el.layout = "numeric";
      await nextRender();

      expect(messages.some((m) => m.includes("numeric"))).to.equal(false);
    });
  });
});
