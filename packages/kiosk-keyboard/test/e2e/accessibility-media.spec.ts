import { test, expect } from "@playwright/test";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/internal/dom-contract.js";
import { openPage, key, expectKeyboardVisualMatch } from "./helpers.js";

// Forced-colors (high contrast) visual regression (desktop + device matrix).
// Media is emulated before navigation so the control renders in the target mode.
// (prefers-reduced-motion is not tested: the keyboard has no idle animation, so
// it renders identically to the default, adding no regression coverage.)

test("kb-qwerty-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page);
  await expectKeyboardVisualMatch(page, "kb-qwerty", "kb-qwerty-forced-colors.png");
});

// The variant-hint ::after paints only under `accentVariants`, so it needs its
// own forced-colors capture (the qwerty fixture above carries no variant keys).
test("kb-accent-variants-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page);
  await expectKeyboardVisualMatch(page, "kb-accent-variants", "kb-accent-variants-forced-colors.png");
});

// The pressed/highlight arm inverts the hint to HighlightText so it stays
// visible where the key itself paints on Highlight. Asserted on the computed
// pseudo-element rather than captured: the variant fixture has no target input
// to drive a physical-key highlight, and holding a pointer down to force
// `:active` also arms the long-press variant popup.
// Every class that repaints the key on Highlight needs its own arm; a latched
// shift key with author-declared variants is as much a Highlight fill as a
// pressed one, and only an arm per class keeps the hint legible on it.
for (const stateClass of [DOM.classes.keyHighlight, DOM.classes.keyPressed, DOM.classes.keyShiftActive]) {
  test(`kb-accent-variants-forced-colors-${stateClass}`, async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openPage(page);
    const variantKey = key(page, "kb-accent-variants", "a");
    await expect(variantKey).toHaveAttribute(DOM.attributes.hasVariants, "");
    const restingHint = await variantKey.evaluate((el) => getComputedStyle(el, "::after").backgroundColor);
    const highlighted = await variantKey.evaluate((el, cls) => {
      el.classList.add(cls);
      const styles = { hint: getComputedStyle(el, "::after").backgroundColor, text: getComputedStyle(el).color };
      el.classList.remove(cls);
      return styles;
    }, stateClass);
    expect(highlighted.hint).toBe(highlighted.text);
    expect(highlighted.hint).not.toBe(restingHint);
  });
}

// The Caps Lock ring is the only signal that the mode is latched, so it has to
// outrank the transient interaction states painted on the same key. `:hover` and
// `:focus-visible` both declare `box-shadow` on `.ui5KioskKey` at (0,2,0) while
// the ring's own selector is a lone class at (0,1,0), so before the compound
// selector the ring vanished exactly while Caps Lock was on. Polled rather than
// read once: the ring declares `transition: box-shadow 0.1s ease`, so an
// immediate read returns the pre-transition value.
const CAPS_RING = /0px 0px 0px 2px/;

test("kb-caps-lock-ring-survives-hover-and-focus", async ({ page }) => {
  await openPage(page);
  const shiftKey = key(page, "kb-qwerty", "{shift}");
  const boxShadow = () => shiftKey.evaluate((el) => getComputedStyle(el).boxShadow);

  await shiftKey.evaluate((el, classes) => el.classList.add(classes.shift, classes.caps), {
    shift: DOM.classes.keyShiftActive,
    caps: DOM.classes.keyCapsLock,
  });
  await expect.poll(boxShadow).toMatch(CAPS_RING);

  await shiftKey.hover();
  await expect.poll(boxShadow).toMatch(CAPS_RING);

  await shiftKey.evaluate((el: HTMLElement) => el.focus());
  await expect.poll(boxShadow).toMatch(CAPS_RING);
});
