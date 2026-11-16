import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import { customLayout } from "../helpers/fixtures.js";

const DOM = KioskKeyboard.DOM;

/**
 * Every row fits its own box, and its keys span no further than the row: a centered
 * row that overflows spills past both edges, so both are checked.
 */
function expectRowsFit(el: KioskKeyboard, label: string): void {
  const rows = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(DOM.selectors.row));
  expect(rows.length, `${label}: rows rendered`).to.be.greaterThan(0);
  rows.forEach((row, ri) => {
    expect(row.scrollWidth, `${label}: row ${ri} needs no more than its box`).to.be.at.most(row.clientWidth);
    const box = row.getBoundingClientRect();
    const keys = Array.from(row.querySelectorAll<HTMLElement>(DOM.selectors.key), (k) => k.getBoundingClientRect());
    expect(Math.min(...keys.map((k) => k.left)), `${label}: row ${ri} first key start`).to.be.at.least(box.left - 0.5);
    expect(Math.max(...keys.map((k) => k.right)), `${label}: row ${ri} last key end`).to.be.at.most(box.right + 0.5);
  });
}

describe("key floor vs. row width", () => {
  // Row widths 321-331px: above the 20rem tier, below 12 keys at 24px plus 11 gaps of 4px.
  for (const width of [347, 350, 354, 357]) {
    it(`a full 12-key row stays inside a ${width}px keyboard`, async () => {
      const el = await fixture<KioskKeyboard>(
        html`<kiosk-keyboard layout="ja-kana-compact" style="width: ${width}px"></kiosk-keyboard>`,
      );
      await renderFinished();
      const firstRow = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.row)!;
      expect(firstRow.querySelectorAll(DOM.selectors.key).length).to.equal(12);
      expect(firstRow.clientWidth, "row width sits in the band a floored row overflows").to.be.within(321, 331);
      expectRowsFit(el, `${width}px`);
    });
  }

  it("a 13-key custom row stays inside the keyboard", async () => {
    const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
    el.setAttribute("layout", "thirteen");
    el.style.width = "370px";
    el.appendChild(
      customLayout({
        name: "thirteen",
        rows: [Array.from("abcdefghijklm", (value) => ({ value }))],
      }),
    );
    await fixture(el);
    await renderFinished();
    expect(el.shadowRoot!.querySelectorAll(DOM.selectors.key).length).to.equal(13);
    expectRowsFit(el, "370px");
  });

  it("keys hold the 24px floor where a full row fits it", async () => {
    // A 6x spacebar leaves the ten 1x keys a flex share under 24px (22.75px at 400px),
    // so only the floor holds them there; the eleven floored keys still fit the row.
    const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
    el.setAttribute("layout", "spacebar");
    el.style.width = "400px";
    const row = [...Array.from("abcdefghij", (value) => ({ value })), { value: " ", width: "space" as const }];
    el.appendChild(customLayout({ name: "spacebar", rows: [row] }));
    await fixture(el);
    await renderFinished();
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const floor = Math.max(1.5 * rem, 24);
    const widths = Array.from(
      el.shadowRoot!.querySelectorAll<HTMLElement>(DOM.selectors.key),
      (k) => k.getBoundingClientRect().width,
    );
    expect(widths.length).to.equal(11);
    expect(Math.min(...widths)).to.be.at.least(floor - 0.01);
  });
});
