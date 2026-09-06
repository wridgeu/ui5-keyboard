import { test, expect, type Locator } from "@playwright/test";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/internal/dom-contract.js";
import { openPage, key, expectKeyboardVisualMatch } from "./helpers.js";

// Forced-colors (high contrast) visual regression (desktop + device matrix).
// Media is emulated before navigation so the control renders in the target mode.
// (prefers-reduced-motion is not snapshotted: the keyboard has no idle
// animation, so it renders identically to the default; what it suppresses is
// asserted on computed styles below.)

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
// outrank the transient interaction states painted on the same key: `:hover` and
// `:focus-visible` both declare `box-shadow` on `.ui5KioskKey` at (0,2,0), which
// a lone `--capsLock` class loses to. Polled rather than read once: the ring
// declares `transition: box-shadow 0.1s ease`, so an immediate read returns the
// pre-transition value.
const CAPS_RING = /0px 0px 0px 2px/;

const latchCapsLock = (shiftKey: Locator) =>
  shiftKey.evaluate((el, classes) => el.classList.add(classes.shift, classes.caps), {
    shift: DOM.classes.keyShiftActive,
    caps: DOM.classes.keyCapsLock,
  });

test("kb-caps-lock-ring-survives-hover-and-focus", async ({ page }) => {
  await openPage(page);
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
// serving no theme CSS reports `0s` for every key.
test("kb-caps-lock-ring-does-not-animate-under-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPage(page);
  const shiftKey = key(page, "kb-qwerty", "{shift}");

  await latchCapsLock(shiftKey);
  await expect(shiftKey).toHaveCSS("box-shadow", CAPS_RING);
  await expect(shiftKey).toHaveCSS("transition-duration", "0s");
});

// Under forced colors `box-shadow` is dropped, so the latch signal moves to the
// border. It must not move onto `outline`, which the same key needs for its
// focus indicator: the outline assertions prove `:focus-visible` really engaged,
// so the border assertion below cannot pass vacuously. The resting border is the
// `ButtonText` system color, read off a probe painted with the keyword because
// the emulated palette resolves it to an rgb value only at computed time. That
// palette gives `ButtonText` and `CanvasText` one value, so the line tells the
// resting key apart from the `Highlight` and `GrayText` arms, not from the UA
// fallback.
test("kb-caps-lock-indicator-survives-focus-in-forced-colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openPage(page);
  const shiftKey = key(page, "kb-qwerty", "{shift}");
  const styles = () =>
    shiftKey.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { border: computed.borderTopColor, outline: computed.outlineStyle };
    });

  const buttonText = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.color = "ButtonText";
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  const resting = await styles();
  expect(resting.border, "the resting key is bordered in the ButtonText system color").toBe(buttonText);

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

// A mouse press lands under the pointer, so `:hover` and the pressed arm match the
// same key at once and tie on specificity, leaving source order to decide the fill.
// Both keys are covered because the tie repeats at two specificities: `--action` at
// (0,2,0), the latched-Shift pair at (0,3,0). The hover-versus-press assertion is
// what keeps the second one honest - a theme painting the two fills alike would
// satisfy it with the cascade broken.
test("kb-press-outranks-hover-under-a-pointer", async ({ page }) => {
  await openPage(page);
  test.skip(!(await page.evaluate(() => matchMedia("(hover: hover)").matches)), "no hover on this device profile");

  // Both arms transition `background` over 100ms, so a read taken in the same
  // task still reports the outgoing fill.
  const background = (k: Locator) =>
    k.evaluate(async (el) => {
      await Promise.allSettled(el.getAnimations().map((a) => a.finished));
      return getComputedStyle(el).backgroundColor;
    });
  const setPressed = (k: Locator, on: boolean) =>
    k.evaluate((el, arg) => el.classList.toggle(arg.cls, arg.on), { cls: DOM.classes.keyPressed, on });

  for (const { dataKey, latched } of [
    { dataKey: "{enter}", latched: [] as string[] },
    { dataKey: "{shift}", latched: [DOM.classes.keyShiftActive] },
  ]) {
    const target = key(page, "kb-qwerty", dataKey);
    await target.evaluate((el, cls) => el.classList.add(...cls), latched);

    await page.mouse.move(0, 0);
    await setPressed(target, true);
    const pressedOnly = await background(target);

    await setPressed(target, false);
    await target.hover();
    const hoverOnly = await background(target);

    await setPressed(target, true);
    const hoveredAndPressed = await background(target);

    expect(hoverOnly, `${dataKey} paints a hover fill distinct from its press fill`).not.toBe(pressedOnly);
    expect(hoveredAndPressed, `${dataKey} keeps its press fill under the pointer`).toBe(pressedOnly);
  }
});
