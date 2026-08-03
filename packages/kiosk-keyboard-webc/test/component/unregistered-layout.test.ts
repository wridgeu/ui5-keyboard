import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutDefinition } from "../../src/types.js";
import { customLayout } from "../helpers/fixtures.js";

const DOM = KioskKeyboard.DOM;
const nextRender = renderFinished;

function readDataKeys(el: KioskKeyboard): string[][] {
  const rows = el.shadowRoot!.querySelectorAll(DOM.selectors.row);
  return Array.from(rows).map((row) =>
    Array.from(row.querySelectorAll<HTMLElement>(DOM.selectors.key)).map((k) => k.dataset.key!),
  );
}

const layoutA: LayoutDefinition = [[{ value: "ax" }, { value: "bx" }]];

/** Runs `body` with `console.warn` captured into the array it receives, restoring it afterwards. */
async function withCapturedWarnings(body: (messages: string[]) => Promise<void>): Promise<void> {
  const original = console.warn;
  const messages: string[] = [];
  console.warn = (message: unknown): void => {
    messages.push(String(message));
  };
  try {
    await body(messages);
  } finally {
    console.warn = original;
  }
}

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
