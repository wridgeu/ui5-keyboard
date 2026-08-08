import { test, expect } from "@playwright/test";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/core/dom-contract.js";
import { openPage, keyboardRoot, key } from "./helpers.js";

// Accessibility media-query visual regression. Media must be emulated before
// navigation so the component renders in the target mode from the start.

// reduced-motion is intentionally not snapshotted: it only sets transition/
// transform to none, which has no effect on a settled screenshot (animations
// are already disabled), so the baseline is byte-identical to webc-qwerty.png.

test.afterEach(async ({ page }) => {
  await page.emulateMedia({ forcedColors: null });
});

test("webc-qwerty-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page, "/test/pages/visual.html");
  await expect(keyboardRoot(page, "kb-qwerty")).toHaveScreenshot("webc-qwerty-forced-colors.png");
});

// The variant-hint ::after paints only under `accent-variants`, so it needs its
// own forced-colors capture (the qwerty fixture above carries no variant keys).
test("webc-accent-variants-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page, "/test/pages/visual.html");
  await expect(keyboardRoot(page, "kb-accent-variants")).toHaveScreenshot("webc-accent-variants-forced-colors.png");
});

// The active/highlight arm inverts the hint to HighlightText so it stays
// visible where the key itself paints on Highlight. Asserted on the computed
// pseudo-element rather than captured: the variant fixture has no target input
// to drive a physical-key highlight, and holding a pointer down to force
// `:active` also arms the long-press variant popup.
test("webc-accent-variants-forced-colors-highlight", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page, "/test/pages/visual.html");
  const variantKey = key(page, "kb-accent-variants", "a");
  await expect(variantKey).toHaveAttribute(DOM.attributes.hasVariants, "");
  const restingHint = await variantKey.evaluate((el) => getComputedStyle(el, "::after").backgroundColor);
  const highlighted = await variantKey.evaluate((el, highlightClass) => {
    el.classList.add(highlightClass);
    return { hint: getComputedStyle(el, "::after").backgroundColor, text: getComputedStyle(el).color };
  }, DOM.classes.keyHighlight);
  expect(highlighted.hint).toBe(highlighted.text);
  expect(highlighted.hint).not.toBe(restingHint);
});

// The Caps Lock ring is the only signal that the mode is latched, so it has to
// outrank the transient interaction states painted on the same key. `:hover` and
// `:focus-visible` both declare `box-shadow` on `.kiosk-key` at (0,2,0) while the
// ring's own selector is a lone class at (0,1,0), and the `@media (hover: none)`
// block re-declares hover later still, so before the compound selector the ring
// vanished exactly while Caps Lock was on. Polled rather than read once: the ring
// declares `transition: box-shadow 0.1s ease`, so an immediate read returns the
// pre-transition value.
const CAPS_RING = /0px 0px 0px 2px/;

test("webc-caps-lock-ring-survives-hover-and-focus", async ({ page }) => {
  await openPage(page, "/test/pages/visual.html");
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
