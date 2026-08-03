import { expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type CustomLayout from "../../src/CustomLayout.js";
import type { LayoutDefinition } from "../../src/types.js";
import { customLayout } from "../helpers/fixtures.js";

const DOM = KioskKeyboard.DOM;

const layoutA: LayoutDefinition = [[{ value: "ax" }, { value: "bx" }]];

function readDataKeys(el: KioskKeyboard): string[][] {
  const rows = el.shadowRoot!.querySelectorAll(DOM.selectors.row);
  return Array.from(rows).map((row) =>
    Array.from(row.querySelectorAll<HTMLElement>(DOM.selectors.key)).map((k) => k.dataset.key!),
  );
}

/**
 * Builds the whole subtree - host plus its custom layouts - before the host is put
 * into the DOM, and records the rendered keys of every paint the host performs.
 *
 * The recorded first entry is what a consumer actually sees: a settled-state assertion
 * would pass just as well on a keyboard that painted the built-in fallback first and
 * corrected itself a frame later, which is a visible flash on a kiosk screen.
 */
async function paintsOf(
  attributes: Record<string, string>,
  ...children: CustomLayout[]
): Promise<{ el: KioskKeyboard; paints: string[][][] }> {
  const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  el.append(...children);

  const paints: string[][][] = [];
  const onAfterRendering = el.onAfterRendering.bind(el);
  el.onAfterRendering = (): void => {
    paints.push(readDataKeys(el));
    onAfterRendering();
  };

  document.body.appendChild(el);
  await renderFinished();
  return { el, paints };
}

/** Runs `body` with the browser locale reported as `language`, restoring it afterwards. */
async function withBrowserLocale(language: string, body: () => Promise<void>): Promise<void> {
  const originalLanguage = navigator.language;
  const originalLanguages = navigator.languages;
  // getLocale() reads the browser locale from navigator.languages[0], falling back
  // to navigator.language, so both have to be overridden.
  Object.defineProperty(navigator, "language", { value: language, configurable: true });
  Object.defineProperty(navigator, "languages", { value: [language], configurable: true });
  try {
    await body();
  } finally {
    Object.defineProperty(navigator, "language", { value: originalLanguage, configurable: true });
    Object.defineProperty(navigator, "languages", { value: originalLanguages, configurable: true });
  }
}

describe("kiosk-keyboard - custom layouts on the first paint", () => {
  it("renders a slotted custom layout's rows on the first paint", async () => {
    const { el, paints } = await paintsOf(
      { layout: "warehouse-pos" },
      customLayout({ name: "warehouse-pos", rows: layoutA }),
    );
    try {
      expect(paints.length, "the keyboard painted at least once").to.be.greaterThan(0);
      expect(paints[0], "the declared rows are on screen from the first frame").to.deep.equal([["ax", "bx"]]);
    } finally {
      el.remove();
    }
  });

  it("resolves a slotted custom layout's locales on the first paint", async () => {
    await withBrowserLocale("pl", async () => {
      // No `layout` attribute: the default layout comes from the locale, which only
      // the slotted custom layout maps.
      const { el, paints } = await paintsOf({}, customLayout({ name: "pl-warehouse", rows: layoutA, locales: "pl" }));
      try {
        expect(paints.length, "the keyboard painted at least once").to.be.greaterThan(0);
        expect(paints[0], "the locale-resolved layout is on screen from the first frame").to.deep.equal([["ax", "bx"]]);
      } finally {
        el.remove();
      }
    });
  });
});
