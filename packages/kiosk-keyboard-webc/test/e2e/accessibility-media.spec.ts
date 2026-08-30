import { test, expect, type Locator } from "@playwright/test";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/core/dom-contract.js";
import { openPage, keyboardRoot, key, expectVisualMatch } from "./helpers.js";

// Accessibility media-query visual regression. Media must be emulated before
// navigation so the component renders in the target mode from the start.

// reduced-motion is intentionally not snapshotted: it only sets transition/
// transform to none, which has no effect on a settled screenshot (animations
// are already disabled), so the baseline is byte-identical to webc-qwerty.png.
// What it suppresses is asserted on computed styles below.

test.afterEach(async ({ page }) => {
  await page.emulateMedia({ forcedColors: null, reducedMotion: null });
});

test("webc-qwerty-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page, "/test/pages/visual.html");
  await expectVisualMatch(keyboardRoot(page, "kb-qwerty"), "webc-qwerty-forced-colors.png");
});

// The variant-hint ::after paints only under `accent-variants`, so it needs its
// own forced-colors capture (the qwerty fixture above carries no variant keys).
test("webc-accent-variants-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page, "/test/pages/visual.html");
  await expectVisualMatch(keyboardRoot(page, "kb-accent-variants"), "webc-accent-variants-forced-colors.png");
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
// outrank the transient interaction states painted on the same key: `:hover` and
// `:focus-visible` both declare `box-shadow` on `.kiosk-key` at (0,2,0) and the
// `@media (hover: none)` block re-declares hover later still, all of which a lone
// `--caps-lock` class loses to. Polled rather than read once: the ring declares
// `transition: box-shadow 0.1s ease`, so an immediate read returns the
// pre-transition value.
const CAPS_RING = /0px 0px 0px 2px/;

const latchCapsLock = (shiftKey: Locator) =>
  shiftKey.evaluate((el, classes) => el.classList.add(classes.shift, classes.caps), {
    shift: DOM.classes.keyShiftActive,
    caps: DOM.classes.keyCapsLock,
  });

test("webc-caps-lock-ring-survives-hover-and-focus", async ({ page }) => {
  await openPage(page, "/test/pages/visual.html");
  const shiftKey = key(page, "kb-qwerty", "{shift}");
  const boxShadow = () => shiftKey.evaluate((el) => getComputedStyle(el).boxShadow);

  await latchCapsLock(shiftKey);
  await expect.poll(boxShadow).toMatch(CAPS_RING);

  await shiftKey.hover();
  await expect.poll(boxShadow).toMatch(CAPS_RING);

  await shiftKey.evaluate((el: HTMLElement) => el.focus());
  await expect.poll(boxShadow).toMatch(CAPS_RING);
});

// The ring carries the only `transition` a latched key has, and it declares it
// at (0,3,0): reduced motion suppresses it only because the reduce block matches
// the same compound. The ring assertion keeps the timing one honest - a harness
// serving no component CSS reports `0s` for every key.
test("webc-caps-lock-ring-does-not-animate-under-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPage(page, "/test/pages/visual.html");
  const shiftKey = key(page, "kb-qwerty", "{shift}");

  await latchCapsLock(shiftKey);
  await expect(shiftKey).toHaveCSS("box-shadow", CAPS_RING);
  await expect(shiftKey).toHaveCSS("transition-duration", "0s");
});

// Under forced colors `box-shadow` is dropped, so the latch signal moves to the
// border. It must not move onto `outline`, which the same key needs for its
// focus indicator: the outline assertions prove `:focus-visible` really engaged,
// so the border assertion below cannot pass vacuously.
test("webc-caps-lock-indicator-survives-focus-in-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page, "/test/pages/visual.html");
  const shiftKey = key(page, "kb-qwerty", "{shift}");
  const styles = () =>
    shiftKey.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { border: computed.borderTopColor, outline: computed.outlineStyle };
    });

  await shiftKey.evaluate((el, cls) => el.classList.add(cls), DOM.classes.keyShiftActive);
  const shiftOnly = await styles();

  await latchCapsLock(shiftKey);
  const latched = await styles();
  expect(latched.border, "the latched key is bordered apart from a plain shift key").not.toBe(shiftOnly.border);
  expect(latched.outline, "the resting key draws no outline").toBe("none");

  await shiftKey.evaluate((el: HTMLElement) => el.focus());
  const focused = await styles();
  expect(focused.outline, "focus draws the focus outline").not.toBe("none");
  expect(focused.border, "the latch signal survives focus").toBe(latched.border);
});

// A latched Shift carries the emphasized fill, so its transient states have to
// come from the emphasized tokens too. Every shipped SAP theme resolves the
// emphasized, Lite and plain active backgrounds to one colour, so the arm is
// asserted through the token a consumer would theme: an injected value reaches a
// pressed latched Shift only if that key reads the emphasized active arm.
const INJECTED_EMPHASIZED_ACTIVE = "rgb(1, 2, 3)";

test("webc-latched-shift-presses-on-the-emphasized-active-token", async ({ page }) => {
  await openPage(page, "/test/pages/visual.html");
  await page.locator("#kb-qwerty").evaluate((host: HTMLElement, value) => {
    host.style.setProperty("--sapButton_Emphasized_Active_Background", value);
  }, INJECTED_EMPHASIZED_ACTIVE);

  // The base key transitions `background` over 100ms, so a read taken in the
  // same task still reports the resting fill.
  const pressAndRead = (k: Locator, classes: string[]) =>
    k.evaluate(async (el, cls) => {
      el.classList.add(...cls);
      await Promise.allSettled(el.getAnimations().map((a) => a.finished));
      return getComputedStyle(el).backgroundColor;
    }, classes);

  const action = await pressAndRead(key(page, "kb-qwerty", "{enter}"), [DOM.classes.keyPressed]);
  const plain = await pressAndRead(key(page, "kb-qwerty", "z"), [DOM.classes.keyPressed]);
  const shift = await pressAndRead(key(page, "kb-qwerty", "{shift}"), [
    DOM.classes.keyShiftActive,
    DOM.classes.keyPressed,
  ]);

  expect(action, "the injected token crosses the shadow boundary into the emphasized arm").toBe(
    INJECTED_EMPHASIZED_ACTIVE,
  );
  expect(plain, "a plain key presses on its own active token").not.toBe(INJECTED_EMPHASIZED_ACTIVE);
  expect(shift, "a pressed latched Shift presses on the emphasized active token").toBe(INJECTED_EMPHASIZED_ACTIVE);
});

// The emphasized fill leaves too little contrast for the default focus colour,
// which is why `--action` swaps in the contrast one on the same background.
test("webc-latched-shift-draws-the-contrast-focus-ring", async ({ page }) => {
  await openPage(page, "/test/pages/visual.html");
  const shiftKey = key(page, "kb-qwerty", "{shift}");
  await shiftKey.evaluate((el, cls) => el.classList.add(cls), DOM.classes.keyShiftActive);

  const focusAndRead = (k: Locator) =>
    k.evaluate((el: HTMLElement) => {
      el.focus();
      const computed = getComputedStyle(el);
      return { style: computed.outlineStyle, color: computed.outlineColor };
    });

  const resting = await shiftKey.evaluate((el) => getComputedStyle(el).outlineStyle);
  const shift = await focusAndRead(shiftKey);
  const action = await focusAndRead(key(page, "kb-qwerty", "{enter}"));
  const plain = await focusAndRead(key(page, "kb-qwerty", "z"));

  expect(resting, "the latched Shift draws no outline at rest").toBe("none");
  expect(shift.style, "focus draws the focus outline").not.toBe("none");
  expect(action.color, "the contrast and default focus colours differ in the loaded theme").not.toBe(plain.color);
  expect(shift.color, "a focused latched Shift draws the contrast ring").toBe(action.color);
});
