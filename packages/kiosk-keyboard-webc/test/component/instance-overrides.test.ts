import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import {
  registerLayout,
  resetCustomLayouts,
  registerLocaleLayout,
  resetLocaleLayouts,
} from "../../src/core/layout-registry.js";
import { clearCustomMiddleware } from "../../src/core/middleware-registry.js";
import type { LayoutDefinition } from "../../src/types.js";

const DOM = KioskKeyboard.DOM;
const nextRender = renderFinished;

function readDataKeys(el: KioskKeyboard): string[][] {
  const rows = el.shadowRoot!.querySelectorAll(DOM.selectors.row);
  return Array.from(rows).map((row) =>
    Array.from(row.querySelectorAll<HTMLElement>(DOM.selectors.key)).map((k) => k.dataset.key!),
  );
}

const layoutA: LayoutDefinition = [[{ value: "ax" }, { value: "bx" }]];
const layoutB: LayoutDefinition = [[{ value: "global" }]];

describe("kiosk-keyboard - instance overrides", () => {
  afterEach(() => {
    resetCustomLayouts();
    resetLocaleLayouts();
    clearCustomMiddleware();
  });

  it("renders an instance-only layout that is not in the global registry", async () => {
    const el = await fixture<KioskKeyboard>(html`
      <kiosk-keyboard layout="warehouse-pos"></kiosk-keyboard>
    `);
    el.instanceLayouts = { "warehouse-pos": layoutA };
    await nextRender();

    expect(readDataKeys(el)).to.deep.equal([["ax", "bx"]]);
  });

  it("instance map shadows a global registration of the same name", async () => {
    registerLayout("shared", layoutB);

    const el = await fixture<KioskKeyboard>(html`
      <kiosk-keyboard layout="shared"></kiosk-keyboard>
    `);
    el.instanceLayouts = { shared: layoutA };
    await nextRender();

    expect(readDataKeys(el)).to.deep.equal([["ax", "bx"]]);
  });

  it("falls through to the global registry when instance map lacks the active layout", async () => {
    registerLayout("only-global", layoutB);

    const el = await fixture<KioskKeyboard>(html`
      <kiosk-keyboard layout="only-global"></kiosk-keyboard>
    `);
    el.instanceLayouts = { unrelated: layoutA };
    await nextRender();

    expect(readDataKeys(el)).to.deep.equal([["global"]]);
  });

  it("instance locale map can resolve to an instance-only layout name", async () => {
    const original = navigator.language;
    Object.defineProperty(navigator, "language", { value: "de", configurable: true });
    try {
      // Properties must be assigned before the element connects so onEnterDOM
      // sees them when it resolves _baseLayout.
      const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
      el.instanceLayouts = { "warehouse-de": layoutA };
      el.instanceLocaleLayouts = { de: "warehouse-de" };
      document.body.appendChild(el);
      await nextRender();
      try {
        expect(readDataKeys(el)).to.deep.equal([["ax", "bx"]]);
      } finally {
        el.remove();
      }
      // Touch suppressed-locale to silence the lint about unused.
      void registerLocaleLayout;
    } finally {
      Object.defineProperty(navigator, "language", { value: original, configurable: true });
    }
  });

  it("instance overrides do not leak into the global registry", async () => {
    const el = await fixture<KioskKeyboard>(html`
      <kiosk-keyboard layout="instance-only"></kiosk-keyboard>
    `);
    el.instanceLayouts = { "instance-only": layoutA };
    await nextRender();

    const globalNames = KioskKeyboard.getRegisteredLayoutNames();
    expect(globalNames).to.not.include("instance-only");
  });
});
