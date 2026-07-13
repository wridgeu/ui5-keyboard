import { expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import type Popover from "@ui5/webcomponents/dist/Popover.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutDefinition } from "../../src/types.js";
import { requireKey, setupWithLayout } from "../helpers/fixtures.js";
import { getText, setI18nResolver } from "../../src/core/i18n.js";

const DOM = KioskKeyboard.DOM;

// Long-press / right-click accent-variant popup: hold (or right-click) a key
// with variants to open a listbox, pick a glyph via click or Arrow+Enter, and
// have it inserted at the caret through the normal char path. A quick tap still
// types the base glyph; Escape/outside-tap cancels; Shift surfaces uppercase.

const HOLD_MS = 550; // comfortably past the 450ms hold threshold
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const VARIANT_LAYOUT: LayoutDefinition = [
  [{ value: "a", variants: ["ä", "à", "â"] }, { value: "s", variants: ["ß", "ś"] }, { value: "b" }],
  [{ value: "{shift}", type: "modifier" }],
];

function pointerDown(el: HTMLElement): void {
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, button: 0, pointerId: 1 }));
}
function pointerUp(): void {
  document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
}

function popoverEl(kb: KioskKeyboard): Popover | null {
  return kb.shadowRoot!.querySelector<Popover>(DOM.selectors.variantPopover);
}
function popupEl(kb: KioskKeyboard): HTMLElement | null {
  return kb.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.variantPopup);
}
function optionEls(kb: KioskKeyboard): HTMLElement[] {
  return [...kb.shadowRoot!.querySelectorAll<HTMLElement>(DOM.selectors.variantOption)];
}
function optionGlyphs(kb: KioskKeyboard): string[] {
  return optionEls(kb).map((o) => o.textContent ?? "");
}

/** Press and hold a key long enough to open its variant popup. */
async function holdOpen(keyEl: HTMLElement): Promise<void> {
  pointerDown(keyEl);
  await delay(HOLD_MS);
  await renderFinished();
}

function keyDown(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

/**
 * A genuine key tap: the outside pointer/mouse press that the ui5-popover watches
 * for to auto-dismiss (a plain synthetic `.click()` dispatches only `click`, so it
 * never reaches the popover's capture-phase outside-press listener), followed by
 * the `click` that types the key. Mirrors the "dismisses on an outside press"
 * test, targeted at a keyboard key.
 */
function pressKey(el: HTMLElement): void {
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, button: 0, pointerId: 9 }));
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true, button: 0 }));
  document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 9 }));
  el.click();
}

/** Poll until the ui5-popover leaves the shadow root (its close is async). */
async function waitForPopoverGone(kb: KioskKeyboard): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (!popoverEl(kb)) return;
    await delay(10);
  }
}

describe("kiosk-keyboard - accent-variant popup", () => {
  it("marks keys with effective variants via data-has-variants", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    expect(requireKey(kb, "a").hasAttribute(DOM.attributes.hasVariants)).to.equal(true);
    expect(requireKey(kb, "s").hasAttribute(DOM.attributes.hasVariants)).to.equal(true);
    expect(requireKey(kb, "b").hasAttribute(DOM.attributes.hasVariants)).to.equal(false);
  });

  it("opens the popup on hold with the key's variant glyphs", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));

    const popover = popoverEl(kb);
    expect(popover, "ui5-popover rendered").to.exist;
    expect(popover!.open, "opened in the top layer").to.equal(true);
    const popup = popupEl(kb);
    expect(popup, "button toolbar slotted into the popover").to.exist;
    expect(popup!.getAttribute("role")).to.equal("toolbar");
    expect(optionGlyphs(kb)).to.deep.equal(["ä", "à", "â"]);
    // The roving-active option is the Emphasized themed button; the rest Default.
    const [first, ...rest] = optionEls(kb);
    expect(first!.getAttribute("design")).to.equal("Emphasized");
    for (const option of rest) expect(option.getAttribute("design")).to.equal("Default");
    pointerUp();
  });

  it("exposes the variant-popup and variant-option parts when open", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));

    expect(popupEl(kb)!.getAttribute("part")).to.equal("variant-popup");
    for (const option of optionEls(kb)) {
      expect(option.getAttribute("part")).to.equal("variant-option");
    }
    pointerUp();
  });

  it("does not open a popup for a key without variants", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "b"));
    expect(popupEl(kb)).to.not.exist;
    pointerUp();
  });

  it("inserts the chosen glyph at the caret via Arrow+Enter", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));
    pointerUp();

    const popup = popupEl(kb)!;
    keyDown(popup, "ArrowRight"); // ä -> à
    keyDown(popup, "Enter");

    expect(input.value).to.equal("à");
    await renderFinished();
    expect(popupEl(kb), "popup closed after commit").to.not.exist;
  });

  it("inserts the chosen glyph when an option is clicked", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));
    pointerUp();

    optionEls(kb)[2]!.click(); // â
    expect(input.value).to.equal("â");
    await renderFinished();
    expect(popupEl(kb)).to.not.exist;
  });

  it("still types the base glyph on a quick tap (no hold)", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    requireKey(kb, "a").click();
    expect(input.value).to.equal("a");
    expect(popupEl(kb), "no popup on a plain tap").to.not.exist;
  });

  it("does not open the popup when released before the hold threshold", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    const aKey = requireKey(kb, "a");
    pointerDown(aKey);
    await delay(150); // below the 450ms threshold
    pointerUp();
    await renderFinished();
    expect(popupEl(kb), "hold cancelled before it fired").to.not.exist;

    aKey.click();
    expect(input.value).to.equal("a");
  });

  it("suppresses the trailing base insert after a hold opened the popup", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));
    pointerUp(); // sticky: popup stays open

    // The release click on the origin key must be swallowed, not typed.
    requireKey(kb, "a").click();
    expect(input.value).to.equal("");
    expect(popupEl(kb), "popup remains open (sticky)").to.exist;
  });

  it("commits a touch drag-release without also activating the key beneath (no double-insert)", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));

    // Drag onto the second option (à) and lift: the touch pointerup commits it.
    const option = optionEls(kb)[1]!; // à
    const o = option.getBoundingClientRect();
    document.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 1,
        pointerType: "touch",
        clientX: o.left + o.width / 2,
        clientY: o.top + o.height / 2,
        bubbles: true,
      }),
    );
    await renderFinished();
    expect(input.value, "drag-release committed the variant").to.equal("à");

    // The browser then synthesizes a trailing touchend at the lift point, which
    // now resolves to a key (the option is gone). It must be swallowed, not
    // clicked, or the key's own character is inserted a second time.
    const bKey = requireKey(kb, "b");
    const b = bKey.getBoundingClientRect();
    const touch = new Touch({
      identifier: 1,
      target: bKey,
      clientX: b.left + b.width / 2,
      clientY: b.top + b.height / 2,
    });
    bKey.dispatchEvent(
      new TouchEvent("touchend", { changedTouches: [touch], bubbles: true, composed: true, cancelable: true }),
    );

    expect(input.value, "no second char from the key beneath").to.equal("à");
  });

  it("does not leak click-suppression to a different key", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));
    pointerUp(); // sticky: popup open, release-click suppression armed for 'a'

    // A click on a different key must still type; the suppression is scoped to
    // the origin key and must not swallow another key's activation.
    requireKey(kb, "b").click();
    expect(input.value).to.equal("b");
  });

  it("a key press on a different key dismisses the popup and still types", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));
    pointerUp(); // sticky: popup open, release-click suppression armed for 'a'

    // A press on a different key is always "outside" the popover, so the popover
    // dismisses on the outside press and the trailing click types: the one tap
    // does both.
    pressKey(requireKey(kb, "b"));
    await waitForPopoverGone(kb);
    expect(input.value, "the dismissing tap also typed").to.equal("b");
    expect(popoverEl(kb), "popover closed by the key press").to.not.exist;
    expect(popupEl(kb)).to.not.exist;
  });

  // A ui5-popover excludes its own opener element from the outside-press that
  // auto-closes it (pressing the anchor is not "outside"), so the key-press
  // dismissal in `_onKeyClick` is what closes the popup when the origin key is
  // re-tapped.
  it("re-clicking the origin key while open closes it and types", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));
    pointerUp(); // sticky: popup open, release-click suppression armed for 'a'

    // The opening gesture's own trailing click on the origin key is still
    // swallowed: no base glyph, popup stays open.
    requireKey(kb, "a").click();
    expect(input.value, "opening trailing click suppressed").to.equal("");
    expect(popupEl(kb), "popup still open after the suppressed click").to.exist;

    // A genuine re-tap of the same key then dismisses the popup and types.
    pressKey(requireKey(kb, "a"));
    await waitForPopoverGone(kb);
    expect(input.value).to.equal("a");
    expect(popoverEl(kb), "popover closed by re-pressing the origin key").to.not.exist;
    expect(popupEl(kb)).to.not.exist;
  });

  it("labels the popup with the localized i18n string, not a hardcoded literal", async () => {
    // Route the key through a resolver so the assertion fails if the label is
    // hardcoded instead of going through getText.
    setI18nResolver((key) => (key === "ARIA_VARIANTS_OPENED" ? "{0} accents ({1})" : undefined));
    try {
      const { kb } = await setupWithLayout(VARIANT_LAYOUT);
      await holdOpen(requireKey(kb, "a"));

      const expected = getText("ARIA_VARIANTS_OPENED", "{0} variants for {1}").replace("{0}", "3").replace("{1}", "a");
      expect(expected).to.equal("3 accents (a)");
      expect(popupEl(kb)!.getAttribute("aria-label")).to.equal(expected);
      pointerUp();
    } finally {
      setI18nResolver(null);
    }
  });

  it("reverses ArrowLeft/ArrowRight option navigation in RTL", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    kb.setAttribute("dir", "rtl");
    await renderFinished();

    await holdOpen(requireKey(kb, "a"));
    pointerUp();

    // RTL: options render right-to-left, so ArrowLeft advances to the
    // visually-next (higher index) option: ä -> à.
    const popup = popupEl(kb)!;
    keyDown(popup, "ArrowLeft");
    keyDown(popup, "Enter");
    expect(input.value).to.equal("à");
  });

  it("dismisses on Escape without inserting anything", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));
    pointerUp();

    keyDown(popupEl(kb)!, "Escape");
    await renderFinished();
    expect(popupEl(kb)).to.not.exist;
    expect(input.value).to.equal("");
  });

  it("dismisses on an outside press", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));
    pointerUp();
    expect(popupEl(kb)).to.exist;

    // ui5-popover watches for an outside mousedown (capture) to auto-close.
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
    await renderFinished();
    expect(popoverEl(kb), "popover closed").to.not.exist;
    expect(popupEl(kb)).to.not.exist;
  });

  it("opens on right-click (contextmenu)", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    const aKey = requireKey(kb, "a");
    const evt = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    aKey.dispatchEvent(evt);
    await renderFinished();
    expect(popupEl(kb), "popup opened via right-click").to.exist;
    expect(evt.defaultPrevented, "native context menu suppressed").to.equal(true);
  });

  it("surfaces uppercase forms (incl. ẞ for ß) while Shift is active", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    requireKey(kb, "{shift}").click();
    await renderFinished();

    await holdOpen(requireKey(kb, "s"));
    expect(optionGlyphs(kb)).to.deep.equal(["ẞ", "Ś"]);
    pointerUp();
  });

  it("commits an uppercase variant through the shifted char path", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    requireKey(kb, "{shift}").click();
    await renderFinished();

    await holdOpen(requireKey(kb, "s"));
    pointerUp();
    optionEls(kb)[0]!.click(); // ẞ
    expect(input.value).to.equal("ẞ");
  });

  it("lets a consumer veto the insert via preventDefault on key-press", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    kb.addEventListener("key-press", (e: Event) => {
      if ((e as CustomEvent<{ key: string }>).detail.key === "ä") e.preventDefault();
    });
    await holdOpen(requireKey(kb, "a"));
    pointerUp();

    optionEls(kb)[0]!.click(); // ä (vetoed)
    expect(input.value).to.equal("");
    await renderFinished();
    expect(popupEl(kb), "popup still closes after a veto").to.not.exist;
  });

  // ── Opt-in Latin-diacritics table via the accent-variants attribute ──

  it("fills the built-in table onto matching base keys when accent-variants is on", async () => {
    const { kb } = await setupWithLayout([[{ value: "a" }, { value: "b" }, { value: "1" }]]);
    kb.accentVariants = true;
    await renderFinished();

    expect(requireKey(kb, "a").hasAttribute(DOM.attributes.hasVariants), "a is a table base").to.equal(true);
    expect(requireKey(kb, "b").hasAttribute(DOM.attributes.hasVariants), "b is not").to.equal(false);
    expect(requireKey(kb, "1").hasAttribute(DOM.attributes.hasVariants), "digits are not").to.equal(false);

    await holdOpen(requireKey(kb, "a"));
    expect(optionGlyphs(kb)).to.deep.equal(["à", "á", "â", "ä", "æ", "ã", "å", "ā"]);
    pointerUp();
  });

  it("does not mark base keys when accent-variants is off", async () => {
    const { kb } = await setupWithLayout([[{ value: "a" }, { value: "b" }]]);
    expect(requireKey(kb, "a").hasAttribute(DOM.attributes.hasVariants)).to.equal(false);
  });

  it("scales the option glyph font-size from the key-font-size token", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));

    // The option glyph's font-size must resolve from the public responsive
    // key-font-size token (the framework way, via the cascade into the popover),
    // not from a fixed size or an override, so the glyphs stay proportional to
    // the keys at every breakpoint.
    kb.style.setProperty("--kiosk-keyboard-key-font-size", "9px");
    await renderFinished();

    const button = optionEls(kb)[0]!;
    expect(getComputedStyle(button).fontSize, "option glyph tracks the key-font-size token").to.equal("9px");
    pointerUp();
  });

  // The option button's height resolves from `--kiosk-keyboard-key-height`, so
  // it shrinks with the responsive key size the same way the glyph font does.
  it("scales the option button height from the key-height token", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));

    kb.style.setProperty("--kiosk-keyboard-key-height", "17px");
    await renderFinished();

    const button = optionEls(kb)[0]!;
    expect(getComputedStyle(button).height).to.equal("17px");
    // The visible, bordered box is the internal `button` part; it must fill the
    // host so the rendered cell (not just the host) matches the key height.
    const innerButton = button.shadowRoot!.querySelector<HTMLElement>(".ui5-button-root")!;
    expect(getComputedStyle(innerButton).height, "the visible inner button matches the key height").to.equal("17px");
    pointerUp();
  });

  // Each option's WIDTH matches the anchor key's rendered width, captured at
  // open. A compressed keyboard makes the keys narrower than the key-height
  // token (the old floor), so a match proves the option follows the real key
  // footprint rather than the 48px height token.
  it("sizes each option button to the anchor key's rendered width", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);

    // Squeeze the keyboard so its keys render well below the key-height token.
    // The anchor width is read at open, so this must run before holdOpen.
    kb.style.width = "150px";
    await renderFinished();

    const aKey = requireKey(kb, "a");
    await holdOpen(aKey);

    const keyWidth = aKey.getBoundingClientRect().width;
    // Self-guard: the compressed key must be narrower than the old key-height
    // floor (48px), or matching it would prove nothing.
    expect(keyWidth, "compressed key is narrower than the height token").to.be.below(48);

    const optionWidth = optionEls(kb)[0]!.getBoundingClientRect().width;
    expect(optionWidth).to.equal(keyWidth);
    pointerUp();
  });

  // On a wide keyboard the key is far wider than tall; the option still matches the
  // full key width (not capped at the key height), so the cells stay proportional to
  // the keys. The width is read at open.
  it("sizes each option to the full key width even when the key is wide", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);

    // A wide host with a short key-height makes the keys much wider than tall.
    kb.style.width = "600px";
    kb.style.setProperty("--kiosk-keyboard-key-height", "20px");
    await renderFinished();

    const aKey = requireKey(kb, "a");
    await holdOpen(aKey);

    const keyRect = aKey.getBoundingClientRect();
    // Self-guard: the key must be wider than tall, or matching the width would prove nothing.
    expect(keyRect.width, "wide key is wider than its height").to.be.above(keyRect.height);

    const optionWidth = optionEls(kb)[0]!.getBoundingClientRect().width;
    expect(optionWidth, "option matches the full key width, not capped at the key height").to.equal(keyRect.width);
    pointerUp();
  });

  it("shows the popover arrow so it points at the source key", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));

    const popover = popoverEl(kb)!;
    expect(popover.hideArrow, "arrow is restored, not hidden").to.equal(false);
    expect(popover.hasAttribute("hide-arrow"), "no hide-arrow attribute set").to.equal(false);
    pointerUp();
  });
});
