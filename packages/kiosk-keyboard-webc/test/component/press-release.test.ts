import { expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import type Popover from "@ui5/webcomponents/dist/Popover.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutDefinition } from "../../src/types.js";
import { requireKey, setupWithLayout } from "../helpers/fixtures.js";

const DOM = KioskKeyboard.DOM;
const HOLD_MS = 700; // past both the 450ms hold threshold and the first repeat tick
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await renderFinished();
  }
}

function touchDown(el: HTMLElement): void {
  el.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, composed: true, button: 0, pointerId: 1, pointerType: "touch" }),
  );
}

/** Roving-tabindex activation of a focused keycap. */
function pressEnter(el: HTMLElement): void {
  el.focus();
  el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, composed: true }));
  el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true, cancelable: true, composed: true }));
}

function popoverOpen(kb: KioskKeyboard): boolean {
  return kb.shadowRoot!.querySelector<Popover>(DOM.selectors.variantPopover)?.open === true;
}

const BACKSPACE_LAYOUT: LayoutDefinition = [[{ value: "a" }, { value: "{backspace}" }]];
const VARIANT_LAYOUT: LayoutDefinition = [[{ value: "a", variants: ["ä", "à"] }, { value: "b" }]];

describe("kiosk-keyboard - a press's release decides its own trailing click", () => {
  async function heldBackspace(): Promise<{ kb: KioskKeyboard; input: HTMLInputElement; held: number }> {
    const { kb, input } = await setupWithLayout(BACKSPACE_LAYOUT);
    input.value = "abcdefghijklmnop";
    input.setSelectionRange(input.value.length, input.value.length);
    touchDown(requireKey(kb, "{backspace}"));
    await delay(HOLD_MS);
    return { kb, input, held: input.value.length };
  }

  it("Enter on Backspace after a cancelled repeating hold deletes one grapheme", async () => {
    const { kb, input, held } = await heldBackspace();
    document.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 1, pointerType: "touch" }));
    expect(held, "precondition: the hold repeated").to.be.below(16);

    pressEnter(requireKey(kb, "{backspace}"));
    expect(input.value.length).to.equal(held - 1);
  });

  it("Enter on Backspace after a hold released onto another key deletes one grapheme", async () => {
    const { kb, input } = await heldBackspace();
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, pointerType: "touch" }));
    requireKey(kb, "a").click();
    const afterRelease = input.value.length;

    pressEnter(requireKey(kb, "{backspace}"));
    expect(input.value.length).to.equal(afterRelease - 1);
  });

  it("removing the keyboard mid-hold does not swallow the next keyboard activation", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    const container = kb.parentElement!;
    touchDown(requireKey(kb, "a"));
    await delay(HOLD_MS);
    await renderFinished();

    kb.remove();
    container.append(kb);
    await settle();
    // Disconnect drops the target with the rest of the session.
    kb.setTargetElement(input);
    input.value = "";
    pressEnter(requireKey(kb, "a"));

    expect(input.value).to.equal("a");
    expect(popoverOpen(kb), "the popup did not survive the reconnect").to.equal(false);
  });

  it("a layout change abandons an open accent popup", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    touchDown(requireKey(kb, "a"));
    await delay(HOLD_MS);
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, pointerType: "touch" }));
    await settle();
    expect(popoverOpen(kb), "precondition: the sticky popup is open").to.equal(true);

    kb.layout = "numeric";
    await settle();
    expect(popoverOpen(kb)).to.equal(false);
  });

  it("a layout write that changes nothing keeps the accent popup", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    touchDown(requireKey(kb, "a"));
    await delay(HOLD_MS);
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, pointerType: "touch" }));
    await settle();

    kb.layout = `${kb.layout}`;
    await settle();
    expect(popoverOpen(kb)).to.equal(true);
  });
});
