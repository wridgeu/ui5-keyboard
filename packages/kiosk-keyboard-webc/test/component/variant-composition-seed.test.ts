import { expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import type { LayoutDefinition } from "../../src/types.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import { createSeedComposeMiddleware } from "../helpers/seed-compose-middleware.js";
import { requireKey, setupWithLayout } from "../helpers/fixtures.js";

const DOM = KioskKeyboard.DOM;

// Layer 2: a committed accent variant must flow through the SAME composition
// pipeline as a pressed key, so a consumer middleware can SEED composition from
// it. Driven through a consumer stub (test/helpers) registered via the public
// instanceMiddleware map: its handleKey opens a bracketed preedit on the seed
// glyph, so a literal insert (the pre-routing flush) and a routed compose are
// distinguishable by the input's observable value.

const HOLD_MS = 550; // comfortably past the 450ms hold threshold
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// "e" carries the accent variant "é" that seeds composition; "x" extends it.
const SEED_VARIANT_LAYOUT: LayoutDefinition = [[{ value: "e", variants: ["é"] }, { value: "x" }]];

function pointerDown(el: HTMLElement): void {
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, button: 0, pointerId: 1 }));
}
function pointerUp(): void {
  document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
}

function optionEls(kb: KioskKeyboard): HTMLElement[] {
  return [...kb.shadowRoot!.querySelectorAll<HTMLElement>(DOM.selectors.variantOption)];
}

/** Press and hold a key long enough to open its variant popup. */
async function holdOpen(keyEl: HTMLElement): Promise<void> {
  pointerDown(keyEl);
  await delay(HOLD_MS);
  await renderFinished();
}

describe("kiosk-keyboard - committed variant seeds composition", () => {
  it("routes the variant through the middleware so it can start a preedit", async () => {
    const { kb, input } = await setupWithLayout(SEED_VARIANT_LAYOUT);
    kb.instanceMiddleware = { spike: createSeedComposeMiddleware("é") };
    await renderFinished();

    // Commit the accent variant é via the real long-press variant path.
    await holdOpen(requireKey(kb, "e"));
    pointerUp();
    optionEls(kb)[0]!.click(); // é
    await renderFinished();

    // Routed through the middleware, é opened a live bracketed preedit. A literal
    // insert (the pre-routing flush) would have stranded a bare "é" here.
    expect(input.value, "committed variant seeded a composition preedit").to.equal("⟦é⟧");
    expect(input.selectionStart, "caret sits at the end of the preedit").to.equal(3);

    // A following key must continue that same composition, proving the variant
    // truly joined the pipeline rather than being finalized before it.
    requireKey(kb, "x").click();

    expect(input.value, "the next key extends the seeded composition").to.equal("⟦éx⟧");
    expect(input.selectionStart, "caret tracks the extended preedit").to.equal(4);
  });
});
