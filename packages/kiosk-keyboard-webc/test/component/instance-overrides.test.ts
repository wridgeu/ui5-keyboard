import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { CompositionMiddleware, LayoutDefinition } from "../../src/types.js";

const DOM = KioskKeyboard.DOM;
const nextRender = renderFinished;

function readDataKeys(el: KioskKeyboard): string[][] {
  const rows = el.shadowRoot!.querySelectorAll(DOM.selectors.row);
  return Array.from(rows).map((row) =>
    Array.from(row.querySelectorAll<HTMLElement>(DOM.selectors.key)).map((k) => k.dataset.key!),
  );
}

const layoutA: LayoutDefinition = [[{ value: "ax" }, { value: "bx" }]];
const layoutB: LayoutDefinition = [[{ value: "two" }]];

describe("kiosk-keyboard - instance overrides", () => {
  it("renders an instance-only layout that is not in the built-in registry", async () => {
    const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="warehouse-pos"></kiosk-keyboard> `);
    el.instanceLayouts = { "warehouse-pos": layoutA };
    await nextRender();

    expect(readDataKeys(el)).to.deep.equal([["ax", "bx"]]);
  });

  it("instance map shadows the built-in qwerty for one element without affecting another", async () => {
    const elOverride = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
    elOverride.instanceLayouts = { qwerty: layoutA };
    await nextRender();

    const elDefault = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
    await nextRender();

    expect(readDataKeys(elOverride)).to.deep.equal([["ax", "bx"]]);
    // The other element keeps the built-in qwerty -- the override never leaked.
    expect(readDataKeys(elDefault)).to.not.deep.equal([["ax", "bx"]]);
  });

  it("falls through to the built-in registry when instance map lacks the active layout", async () => {
    const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
    el.instanceLayouts = { unrelated: layoutA };
    await nextRender();

    // Active layout is qwerty (built-in); the unrelated instance entry is ignored.
    const rows = readDataKeys(el);
    expect(rows.length).to.be.greaterThan(0);
    expect(rows).to.not.deep.equal([["ax", "bx"]]);
  });

  it("sibling elements with conflicting instance layouts each see their own override", async () => {
    const elA = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="shared"></kiosk-keyboard> `);
    elA.instanceLayouts = { shared: layoutA };

    const elB = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="shared"></kiosk-keyboard> `);
    elB.instanceLayouts = { shared: layoutB };

    await nextRender();

    expect(readDataKeys(elA)).to.deep.equal([["ax", "bx"]]);
    expect(readDataKeys(elB)).to.deep.equal([["two"]]);
  });

  it("instance locale map can resolve to an instance-only layout name", async () => {
    const originalLanguage = navigator.language;
    const originalLanguages = navigator.languages;
    // getLocale() reads the browser locale from navigator.languages[0] (falling
    // back to navigator.language), so override both to "de".
    Object.defineProperty(navigator, "language", { value: "de", configurable: true });
    Object.defineProperty(navigator, "languages", { value: ["de"], configurable: true });
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
    } finally {
      Object.defineProperty(navigator, "language", { value: originalLanguage, configurable: true });
      Object.defineProperty(navigator, "languages", { value: originalLanguages, configurable: true });
    }
  });

  it("instance overrides do not leak into the built-in registry", async () => {
    const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="instance-only"></kiosk-keyboard> `);
    el.instanceLayouts = { "instance-only": layoutA };
    await nextRender();

    const builtinNames = KioskKeyboard.getRegisteredLayoutNames();
    expect(builtinNames).to.not.include("instance-only");
  });

  it("mixed-case instance layout names resolve through lowercase lookup", async () => {
    const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
    // Mixed-case key must shadow the built-in 'qwerty' just as a lowercase
    // key would, since the lookup path normalizes to lowercase.
    el.instanceLayouts = { Qwerty: layoutA };
    await nextRender();

    expect(readDataKeys(el)).to.deep.equal([["ax", "bx"]]);
  });

  it("reassigning instanceMiddleware after first key clears the cached middleware", async () => {
    const noopMw: CompositionMiddleware = {
      handleKey: () => false,
      commit: () => null,
      reset: () => {},
    };

    let firstFactoryCalls = 0;
    const firstFactory = (): CompositionMiddleware => {
      firstFactoryCalls += 1;
      return noopMw;
    };

    const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="qwerty"></kiosk-keyboard> `);
    el.instanceMiddleware = { qwerty: firstFactory };
    await nextRender();

    const aKey = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.keyByValue("a"))!;
    const bKey = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.keyByValue("b"))!;
    const cKey = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.keyByValue("c"))!;

    // First key click lazy-creates the middleware via the first factory.
    aKey.click();
    expect(firstFactoryCalls).to.equal(1);

    // Subsequent clicks reuse the cached middleware.
    bKey.click();
    expect(firstFactoryCalls).to.equal(1);

    let secondFactoryCalls = 0;
    const secondFactory = (): CompositionMiddleware => {
      secondFactoryCalls += 1;
      return noopMw;
    };
    el.instanceMiddleware = { qwerty: secondFactory };
    await nextRender();

    // Next click resolves through the new factory.
    cKey.click();
    expect(secondFactoryCalls).to.equal(1);
    expect(firstFactoryCalls).to.equal(1);
  });
});
