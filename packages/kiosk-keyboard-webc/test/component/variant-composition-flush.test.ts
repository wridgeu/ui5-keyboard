import { expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import type { LayoutDefinition } from "../../src/types.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import { createHangulComposeMiddleware } from "../../src/middleware/hangul-compose.js";
import { requireKey, setupWithLayout } from "../helpers/fixtures.js";

const DOM = KioskKeyboard.DOM;

// Committing an accent variant mid-composition routes the glyph through the
// same composition path a pressed key uses. The real Hangul middleware, on a
// non-jamo glyph like "ä", finalizes its live preedit and declines the key, so
// the keyboard falls back to a literal insert: the in-progress syllable keeps
// its composed text and the next composition key starts fresh AFTER the accent
// instead of reaching back over it. Driven through the REAL Hangul middleware
// to exercise a live in-place preedit.

const HOLD_MS = 550; // comfortably past the 450ms hold threshold
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// A layout that carries the Hangul jamo needed to compose 가 → 가나 AND a Latin
// base key with an accent variant, so a variant commit lands mid-composition.
const HANGUL_VARIANT_LAYOUT: LayoutDefinition = [
  [{ value: "ㄱ" }, { value: "ㅏ" }, { value: "ㄴ" }, { value: "a", variants: ["ä"] }],
];

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

describe("kiosk-keyboard - variant commit flushes composition", () => {
  it("finalizes the in-progress composition before inserting the variant", async () => {
    const { kb, input } = await setupWithLayout(HANGUL_VARIANT_LAYOUT, {
      middleware: createHangulComposeMiddleware,
    });

    // Compose 가 (ㄱ then ㅏ): a live LV preedit is now in the input.
    requireKey(kb, "ㄱ").click();
    requireKey(kb, "ㅏ").click();
    expect(input.value, "가 composed as a live preedit").to.equal("가");

    // Commit the accent variant ä mid-composition via the real variant path.
    await holdOpen(requireKey(kb, "a"));
    pointerUp();
    optionEls(kb)[0]!.click(); // ä
    await renderFinished();

    // The variant must have finalized 가 and inserted ä after it, not stranded
    // the accent past the still-live preedit.
    expect(input.value, "가 kept, ä inserted after it").to.equal("가ä");

    // The next jamo must start a fresh syllable AFTER the accent.
    requireKey(kb, "ㄴ").click();
    requireKey(kb, "ㅏ").click();

    expect(input.value, "next syllable composes after the accent").to.equal("가ä나");
    expect(input.selectionStart, "caret sits after the composed 나").to.equal(3);
  });
});
