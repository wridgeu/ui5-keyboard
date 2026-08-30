import { expect, fixture, html, waitUntil } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import type Popover from "@ui5/webcomponents/dist/Popover.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutDefinition } from "../../src/types.js";
import { announcedText, resetAnnouncements, requireKey, setupWithLayout } from "../helpers/fixtures.js";
import { getText, setI18nResolver } from "../../src/core/i18n.js";
import { LATIN_DIACRITIC_VARIANTS } from "../../src/core/latin-variants.js";

beforeEach(resetAnnouncements);

const DOM = KioskKeyboard.DOM;

/** WCAG 2.5.8 (AA) target size, less a sub-pixel rounding allowance. */
const TARGET_SIZE = 23.99;
/** Sub-pixel slack when comparing a key rect against the keyboard rect. */
const EDGE_EPSILON = 0.5;

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

/** A layout whose keycaps are Arabic; the custom layout declares `keycapLang="ar"`. */
const LANG_VARIANT_LAYOUT: LayoutDefinition = [[{ value: "ا", variants: ["أ", "إ", "آ"] }]];

/** A key whose shifted glyph is an explicit `shiftValue`, not the uppercased value. */
const SHIFT_VALUE_LAYOUT: LayoutDefinition = [
  [{ value: "1", shiftValue: "!", variants: ["¹", "½"] }],
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

/**
 * A realistic right-click: the pointer and mouse press the browser always fires
 * before the `contextmenu` event, so the gesture sees the same sequence a user
 * produces (a bare `contextmenu` never reaches the popover's outside-press
 * listener).
 */
function rightClick(el: HTMLElement): void {
  el.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, composed: true, button: 2, buttons: 2, pointerId: 3 }),
  );
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true, button: 2, buttons: 2 }));
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, composed: true }));
}

function liveRegionText(_kb: KioskKeyboard): string {
  return announcedText().trim();
}

/** Wait out the asynchronous re-anchor: the popover is anchored to `key`. */
async function waitForAnchor(kb: KioskKeyboard, key: HTMLElement): Promise<void> {
  await waitUntil(() => popoverEl(kb)?.opener === key, "the popover re-anchors to the second key");
  await renderFinished();
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

  // Pins the fire-time gate the UI5 twin is gaining: the arm-time check alone
  // would let a hold begun while enabled open the popup after the flag flipped.
  it("does not open when the keyboard is disabled mid-hold", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    pointerDown(requireKey(kb, "a"));
    kb.disabled = true;
    await delay(HOLD_MS);
    await renderFinished();

    expect(popoverEl(kb), "the elapsed hold opened nothing on a disabled keyboard").to.not.exist;
    pointerUp();
  });

  // The popup is part of the keyboard's surface, so a disabled keyboard shows
  // none: left open, its options still reach the commit path and type.
  it("dismisses an open popup when the keyboard is disabled", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));
    pointerUp();
    const aimedAt = optionEls(kb)[2]!;
    expect(optionGlyphs(kb), "precondition: the popup is open with options").to.deep.equal(["ä", "à", "â"]);

    kb.disabled = true;
    await renderFinished();
    await waitForPopoverGone(kb);

    expect(popupEl(kb), "the popup is gone").to.not.exist;
    aimedAt.click();
    expect(input.value, "the option the press was aimed at types nothing").to.equal("");
  });

  it("opens the popup on a host that was given an id after its first render", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    // `id` is not a decorated property, so assigning it re-renders nothing; the
    // render the popup's own state change triggers is what re-emits every key
    // id under the new prefix, while the gesture is already under way.
    kb.id = "renamed";
    await holdOpen(requireKey(kb, "a"));

    const popover = popoverEl(kb);
    expect(popover, "ui5-popover rendered").to.exist;
    expect(popover!.open, "opened in the top layer").to.equal(true);
    expect(popover!.opener, "anchored to the held key").to.equal(requireKey(kb, "a"));
    expect(optionGlyphs(kb)).to.deep.equal(["ä", "à", "â"]);
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

  it("does not type the base glyph when a commit lands while the origin key is still held", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    // Finger 1 holds 'a' open and stays down; a second finger picks an option.
    await holdOpen(requireKey(kb, "a"));
    optionEls(kb)[0]!.click(); // ä
    expect(input.value, "the option click committed the variant").to.equal("ä");

    // Finger 1 now lifts off 'a'. Its release belongs to the gesture that opened
    // the popup, so it must stay swallowed even though the popup already closed.
    pointerUp();
    requireKey(kb, "a").click();
    expect(input.value, "the origin key's release did not also type the base glyph").to.equal("ä");
  });

  it("keeps the origin key's release suppressed when a second variant key is pressed", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    // Finger 1 holds 'a' open and stays down; a second finger presses another
    // variant key. That press must not disarm finger 1's pending release-swallow.
    await holdOpen(requireKey(kb, "a"));
    requireKey(kb, "s").dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, composed: true, button: 0, pointerId: 2 }),
    );

    pointerUp(); // finger 1 lifts off 'a'
    requireKey(kb, "a").click();
    expect(input.value, "the opening gesture's release is still swallowed").to.equal("");
  });

  it("commits nothing when the gesture is canceled over an option", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));

    // The browser aborts the touch (palm rejection, system gesture) while the
    // finger happens to rest over an option. A cancel must never commit input.
    const option = optionEls(kb)[1]!; // à
    const o = option.getBoundingClientRect();
    document.dispatchEvent(
      new PointerEvent("pointercancel", {
        pointerId: 1,
        pointerType: "touch",
        clientX: o.left + o.width / 2,
        clientY: o.top + o.height / 2,
        bubbles: true,
      }),
    );
    await renderFinished();
    expect(input.value, "a canceled gesture committed nothing").to.equal("");
  });

  it("never shows one key's glyphs under a popover anchored to another", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    const aKey = requireKey(kb, "a");
    const sKey = requireKey(kb, "s");
    await holdOpen(aKey);
    pointerUp(); // sticky: 'a' popup stays open, anchored to 'a'

    // A hold on a second variant key re-anchors the popover. The glyphs and the
    // opener move together, so the settled popover offers 's' glyphs, never the
    // 'a' glyphs it was showing a moment earlier.
    await holdOpen(sKey);
    await waitForAnchor(kb, sKey);

    expect(optionGlyphs(kb), "the re-anchored key's own glyphs are shown").to.deep.equal(["ß", "ś"]);
    pointerUp();
  });

  it("a right-click on a second variant key re-anchors the popover", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    const aKey = requireKey(kb, "a");
    const sKey = requireKey(kb, "s");

    rightClick(aKey);
    await renderFinished();
    expect(optionGlyphs(kb), "popup opened on the first key").to.deep.equal(["ä", "à", "â"]);

    rightClick(sKey);
    await waitForAnchor(kb, sKey);

    expect(optionGlyphs(kb), "the second key's variants are offered").to.deep.equal(["ß", "ś"]);
  });

  // No re-anchor deferral test here, unlike the kiosk twin: a ui5-popover closes
  // synchronously (`Popup.open` setter -> `closePopup()` -> `close` event), so
  // `_requestOpen`'s close tears the session down before it parks and the popup
  // opens on the new key directly. The parked branch is only reachable in the
  // frame `Popover.openPopup` leaves behind when it bails on an opener that is
  // already outside the viewport, which no key press can produce.

  it("does not leak click-suppression to a different key", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));
    pointerUp(); // sticky: popup open, release-click suppression armed for 'a'

    // A click on a different key must still type; the suppression is scoped to
    // the origin key and must not swallow another key's activation.
    requireKey(kb, "b").click();
    expect(input.value).to.equal("b");
  });

  it("reset() dismisses an open variant popup and leaves the origin key usable", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));
    pointerUp(); // sticky: popup stays open
    expect(popupEl(kb), "popup is open before reset").to.exist;

    kb.reset();
    await waitForPopoverGone(kb);
    expect(popupEl(kb), "reset dismissed the variant popover").to.not.exist;

    // The dismissal settles the popup's one-shot click suppression, so a fresh
    // tap on the origin key types its base glyph instead of being swallowed.
    requireKey(kb, "a").click();
    expect(input.value, "the origin key types normally after reset").to.equal("a");
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

  // A key can carry exactly one variant, and the announcement is built by plain
  // substitution with no plural form, so the count must not sit in the slot where
  // English, German and Arabic require numeral-noun agreement.
  it("announces a single variant without a plural disagreement", async () => {
    const { kb } = await setupWithLayout([[{ value: "a", variants: ["ā"] }]]);
    await holdOpen(requireKey(kb, "a"));

    expect(optionGlyphs(kb), "precondition: exactly one variant is offered").to.deep.equal(["ā"]);
    expect(liveRegionText(kb), "the count trails the noun, so no locale needs a plural form").to.equal(
      "Variants for a: 1",
    );
    pointerUp();
  });

  it("labels the popup with the localized i18n string, not a hardcoded literal", async () => {
    // Route the key through a resolver so the assertion fails if the label is
    // hardcoded instead of going through getText.
    setI18nResolver((key) => (key === "ARIA_VARIANTS_OPENED" ? "{0} accents ({1})" : undefined));
    try {
      const { kb } = await setupWithLayout(VARIANT_LAYOUT);
      await holdOpen(requireKey(kb, "a"));

      const expected = getText("ARIA_VARIANTS_OPENED", "Variants for {1}: {0}").replace("{0}", "3").replace("{1}", "a");
      expect(expected).to.equal("3 accents (a)");
      expect(popoverEl(kb)!.accessibleName).to.equal(expected);
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

  it("leaves focus where an outside press moved it", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));
    pointerUp();

    // The user clicks a field outside the popup: the press moves focus there and
    // light-dismisses the popup. Focus belongs to what the user pressed, so the
    // popup must not pull it back to the origin key on its way out.
    input.focus();
    await delay(50);
    input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
    await delay(300);
    expect(popupEl(kb), "the outside press dismissed the popup").to.not.exist;
    expect(document.activeElement, "focus stayed on the input the user pressed").to.equal(input);
  });

  it("restores focus to the origin key when Escape closes the popup", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    const aKey = requireKey(kb, "a");
    await holdOpen(aKey);
    pointerUp();

    // Focus was inside the popup, so it has nowhere to go but back to the key.
    keyDown(popupEl(kb)!, "Escape");
    await renderFinished();
    expect(kb.shadowRoot!.activeElement, "focus returned to the origin key").to.equal(aKey);
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

  it("names the popup with the key's explicit shiftValue while Shift is active", async () => {
    const { kb } = await setupWithLayout(SHIFT_VALUE_LAYOUT);
    requireKey(kb, "{shift}").click();
    await renderFinished();

    // Shift makes the key type its explicit shiftValue ("!"), so the popup's
    // accessible name must say "!" rather than the uppercased raw value ("1").
    await holdOpen(requireKey(kb, "1"));
    const expected = getText("ARIA_VARIANTS_OPENED", "Variants for {1}: {0}").replace("{0}", "2").replace("{1}", "!");
    expect(popoverEl(kb)!.accessibleName).to.equal(expected);
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

    // A committed variant is a character key, so it spends the one-shot latch.
    // The assertion reads the rendered `aria-pressed`, hence the render wait.
    await renderFinished();
    expect(
      requireKey(kb, "{shift}").getAttribute("aria-pressed"),
      "the committed variant spent the one-shot Shift latch",
    ).to.equal("false");
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

  it("spends the one-shot Shift latch on a vetoed variant commit", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    kb.addEventListener("key-press", (e: Event) => {
      if ((e as CustomEvent<{ key: string }>).detail.key === "ẞ") e.preventDefault();
    });
    requireKey(kb, "{shift}").click();
    await renderFinished();
    expect(requireKey(kb, "{shift}").getAttribute("aria-pressed"), "precondition: shift latched").to.equal("true");

    await holdOpen(requireKey(kb, "s"));
    pointerUp();
    optionEls(kb)[0]!.click(); // ẞ (vetoed)
    expect(input.value).to.equal("");

    // Which keys spend the latch is a pure function of the key, so the veto
    // cancels the insertion and leaves the spend alone.
    await renderFinished();
    expect(requireKey(kb, "{shift}").getAttribute("aria-pressed"), "the veto does not keep the latch armed").to.equal(
      "false",
    );
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

  it("a custom layout's variants extend the built-in table and drive the popup", async () => {
    const { kb } = await setupWithLayout([[{ value: "a" }, { value: "b" }]], { variants: { b: ["ḃ", "ƀ"] } });
    kb.accentVariants = true;
    await renderFinished();

    expect(requireKey(kb, "b").hasAttribute(DOM.attributes.hasVariants), "'b' gains the declared variants").to.equal(
      true,
    );
    expect(
      requireKey(kb, "a").hasAttribute(DOM.attributes.hasVariants),
      "'a' retained: a declared table merges, not replaces",
    ).to.equal(true);

    await holdOpen(requireKey(kb, "b"));
    expect(optionGlyphs(kb)).to.deep.equal(["ḃ", "ƀ"]);
    pointerUp();
  });

  it("a custom layout's variants override one built-in letter's popup glyphs", async () => {
    const { kb } = await setupWithLayout([[{ value: "a" }, { value: "b" }]], { variants: { a: ["ā"] } });
    kb.accentVariants = true;
    await renderFinished();

    await holdOpen(requireKey(kb, "a"));
    expect(optionGlyphs(kb), "the named letter takes the declared glyphs").to.deep.equal(["ā"]);
    pointerUp();
  });

  it("a full-size table restating the built-in entries validates and applies", async () => {
    // A consumer who builds a table from LATIN_DIACRITIC_VARIANTS instead of naming
    // only the letters they change: every one of its entries has to clear validation,
    // and the letters it does change still have to win over the built-in list.
    const { kb } = await setupWithLayout([[{ value: "a" }, { value: "b" }]], {
      variants: { ...LATIN_DIACRITIC_VARIANTS, a: ["ā"], b: ["ḃ"] },
    });
    kb.accentVariants = true;
    await renderFinished();
    expect(requireKey(kb, "a").hasAttribute(DOM.attributes.hasVariants), "the full table validates").to.equal(true);
    expect(requireKey(kb, "b").hasAttribute(DOM.attributes.hasVariants), "added 'b' present").to.equal(true);

    await holdOpen(requireKey(kb, "a"));
    expect(optionGlyphs(kb), "an overridden letter takes the table's own list").to.deep.equal(["ā"]);
    pointerUp();
  });

  it("suppress=Variants opts the layout out of the built-in table", async () => {
    const { kb } = await setupWithLayout([[{ value: "a" }, { value: "b" }]], { suppress: "Variants" });
    kb.accentVariants = true;
    await renderFinished();
    expect(requireKey(kb, "a").hasAttribute(DOM.attributes.hasVariants)).to.equal(false);
  });

  it("the built-in non-Latin layouts carry no accent variants", async () => {
    const kb = await fixture<KioskKeyboard>(html`<kiosk-keyboard layout="ja-romaji" accent-variants></kiosk-keyboard>`);
    await renderFinished();
    expect(requireKey(kb, "a").hasAttribute(DOM.attributes.hasVariants)).to.equal(false);
  });

  it("defaultVariants re-enables variants on an excluded non-Latin layout", async () => {
    const kb = await fixture<KioskKeyboard>(html`<kiosk-keyboard layout="ja-romaji" accent-variants></kiosk-keyboard>`);
    kb.defaultVariants = { a: ["ä"] };
    await renderFinished();
    expect(requireKey(kb, "a").hasAttribute(DOM.attributes.hasVariants)).to.equal(true);
  });

  it("variant keys advertise the popup via aria-haspopup, without aria-expanded", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    const aKey = requireKey(kb, "a");
    expect(aKey.getAttribute("aria-haspopup")).to.equal("dialog");
    expect(requireKey(kb, "b").hasAttribute("aria-haspopup"), "a bare key has no haspopup").to.equal(false);

    // No aria-expanded: the key's own activation types the glyph rather than
    // toggling the popup, so a dialog trigger carries no expand/collapse state.
    expect(aKey.hasAttribute("aria-expanded"), "no aria-expanded before opening").to.equal(false);
    await holdOpen(aKey);
    expect(aKey.hasAttribute("aria-expanded"), "still no aria-expanded while open").to.equal(false);

    // haspopup="dialog" is a promise about what opens, so assert the thing that
    // opens keeps it. Without this the advertisement could drift from the popup.
    const dialog = popoverEl(kb)!.shadowRoot!.querySelector('[role="dialog"]');
    expect(dialog, "the popup that opens carries role=dialog, as advertised").to.not.equal(null);
    expect(dialog!.getAttribute("aria-modal"), "the dialog is modal").to.equal("true");

    pointerUp();

    keyDown(popupEl(kb)!, "Escape");
    await renderFinished();
  });

  it("renders the corner hint pseudo-element only on variant keys", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    const aKey = requireKey(kb, "a");
    const bKey = requireKey(kb, "b");
    expect(getComputedStyle(aKey).position, "the key anchors its hint").to.equal("relative");
    expect(getComputedStyle(aKey, "::after").content, "variant key shows the hint").to.equal('""');
    expect(
      getComputedStyle(aKey, "::after").clipPath,
      "the hint is clipped to the folded-corner triangle",
    ).to.not.equal("none");
    expect(getComputedStyle(bKey, "::after").content, "bare key shows no hint").to.not.equal('""');
    // `content` and `clip-path` both survive `display: none`, so only this
    // assertion can tell a painted hint from a suppressed one.
    expect(getComputedStyle(aKey, "::after").display, "the hint is painted").to.equal("block");
  });

  it("keeps the corner hint painted on a narrow key", async () => {
    const { kb } = await setupWithLayout([
      [
        { value: "a", variants: ["à", "á"] },
        { value: "b" },
        { value: "c" },
        { value: "d" },
        { value: "e" },
        { value: "f" },
        { value: "g" },
        { value: "h" },
        { value: "i" },
        { value: "j" },
      ],
    ]);
    // Long-press is the only route to the variants on touch, so the affordance
    // has to survive the narrowest widths rather than drop out with the key size.
    kb.style.width = "200px";
    await renderFinished();
    const aKey = requireKey(kb, "a");
    expect(aKey.getBoundingClientRect().width, "the key really is narrow").to.be.below(24);
    expect(getComputedStyle(aKey, "::after").display, "the hint is still painted").to.equal("block");
  });

  it("holds the WCAG 2.5.8 24x24px minimum key target size above the narrowest tier", async () => {
    // A uniform row cannot demonstrate the inline floor: if flex would shrink
    // every key below 24px, then flooring every key overflows the row by
    // construction, which is why the floor is lifted below the 20rem tier. The
    // floor earns its keep on a mixed-span row, where a wide key absorbs the
    // width the floored keys take.
    const { kb } = await setupWithLayout([
      [
        { value: "q" },
        { value: "w" },
        { value: "e" },
        { value: "r" },
        { value: "t" },
        { value: "y" },
        { value: "u" },
        { value: "i" },
        { value: "o" },
        { value: "p" },
        { value: " ", width: "space", type: "space" },
      ],
    ]);
    kb.style.width = "348px";
    await renderFinished();
    const root = kb.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.root)!;
    const rootBox = root.getBoundingClientRect();
    const rootStyle = getComputedStyle(root);
    const containerWidth = root.clientWidth - parseFloat(rootStyle.paddingLeft) - parseFloat(rootStyle.paddingRight);
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);

    // The lift below 20rem is keyed off the container's content box, so assert
    // the regime rather than trusting the host width to imply it.
    expect(containerWidth, "fixture must sit above the 20rem tier").to.be.above(20 * remPx);

    const keys = [...kb.shadowRoot!.querySelectorAll<HTMLElement>(DOM.selectors.key)];
    const boxes = keys.map((key) => ({ key: key.dataset.key ?? "", box: key.getBoundingClientRect() }));
    for (const { key, box } of boxes) {
      expect(box.width, `key '${key}' holds >= 24px inline`).to.be.at.least(TARGET_SIZE);
      expect(box.height, `key '${key}' holds >= 24px block`).to.be.at.least(TARGET_SIZE);
      expect(box.left, `key '${key}' overflows the leading edge`).to.be.at.least(rootBox.left - EDGE_EPSILON);
      expect(box.right, `key '${key}' overflows the trailing edge`).to.be.at.most(rootBox.right + EDGE_EPSILON);
    }

    // Prove the fixture actually exercises the floor rather than merely being
    // wide enough: drop the floor and the same row must fall under 24px. Without
    // this the test would keep passing on any layout that happens to fit.
    const lift = document.createElement("style");
    lift.textContent = `${DOM.selectors.key} { min-inline-size: 0 !important }`;
    kb.shadowRoot!.append(lift);
    const unfloored = keys.map((key) => key.getBoundingClientRect().width);
    lift.remove();

    expect(
      Math.min(...unfloored),
      "no key drops under 24px without the floor, so this row does not exercise it",
    ).to.be.below(TARGET_SIZE);
  });

  it("holds the block floor when the key-height property is set below it", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    // Every built-in height tier is already above 24px, so the block floor only
    // binds against a consumer value - which is the case it exists for.
    kb.style.setProperty("--kiosk-keyboard-key-height", "1rem");
    await renderFinished();
    for (const key of kb.shadowRoot!.querySelectorAll<HTMLElement>(DOM.selectors.key)) {
      expect(key.getBoundingClientRect().height, `key '${key.dataset.key}' holds >= 24px block`).to.be.at.least(
        TARGET_SIZE,
      );
    }
  });

  it("lifts the inline floor below the narrowest tier so every key stays inside the keyboard", async () => {
    const { kb } = await setupWithLayout([
      [
        { value: "q" },
        { value: "w" },
        { value: "e" },
        { value: "r" },
        { value: "t" },
        { value: "y" },
        { value: "u" },
        { value: "i" },
        { value: "o" },
        { value: "p" },
      ],
    ]);
    // Below 20rem the row cannot fit ten floored keys. Holding the floor would
    // overflow a center-justified row and clip its outermost keys at both edges,
    // so the keys shrink instead and reachability is preserved.
    kb.style.width = "280px";
    await renderFinished();
    const root = kb.shadowRoot!;
    const board = root.querySelector<HTMLElement>(DOM.selectors.root)!;
    const boardBox = board.getBoundingClientRect();
    const keys = [...root.querySelectorAll<HTMLElement>(DOM.selectors.key)];
    expect(keys.length).to.equal(10);
    for (const key of keys) {
      const box = key.getBoundingClientRect();
      expect(box.left, `key '${key.dataset.key}' is not clipped at the leading edge`).to.be.at.least(
        boardBox.left - EDGE_EPSILON,
      );
      expect(box.right, `key '${key.dataset.key}' is not clipped at the trailing edge`).to.be.at.most(
        boardBox.right + EDGE_EPSILON,
      );
      // The block axis is unaffected by the inline relaxation.
      expect(box.height, `key '${key.dataset.key}' holds >= 24px block`).to.be.at.least(TARGET_SIZE);
    }
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

    const keyWidth = aKey.offsetWidth;
    // Self-guard: the compressed key must be narrower than the old key-height
    // floor (48px), or matching it would prove nothing.
    expect(keyWidth, "compressed key is narrower than the height token").to.be.below(48);

    const optionWidth = optionEls(kb)[0]!.offsetWidth;
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

    // Self-guard: the key must be wider than tall, or matching the width would prove nothing.
    expect(aKey.offsetWidth, "wide key is wider than its height").to.be.above(aKey.offsetHeight);

    const optionWidth = optionEls(kb)[0]!.offsetWidth;
    expect(optionWidth, "option matches the full key width, not capped at the key height").to.equal(aKey.offsetWidth);
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

  it("sizes options to the key's resting width, not its pressed-scale transform", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    kb.style.width = "600px";
    await renderFinished();

    const aKey = requireKey(kb, "a");
    // A pressed key carries a scale() transform: the rendered rect shrinks but the
    // layout box (offsetWidth) does not. The option width is read from the layout
    // box, so it stays key-wide.
    aKey.style.transform = "scale(0.5)";
    await holdOpen(aKey);

    expect(aKey.getBoundingClientRect().width, "the transform shrank the rendered rect").to.be.below(aKey.offsetWidth);
    expect(optionEls(kb)[0]!.offsetWidth, "option follows the resting key width").to.equal(aKey.offsetWidth);
    pointerUp();
  });

  it("passes an axe-core audit with the popup open", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    // The suite's other audit renders a plain keyboard and never opens the popup,
    // so the popover's own tree would otherwise ship unaudited.
    await holdOpen(requireKey(kb, "a"));
    await expect(kb).to.be.accessible();
    pointerUp();
  });

  it("groups the options as a toolbar named once, by the popover", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));

    const expected = getText("ARIA_VARIANTS_OPENED", "Variants for {1}: {0}").replace("{0}", "3").replace("{1}", "a");
    expect(popupEl(kb)!.getAttribute("role"), "the option container is a toolbar").to.equal("toolbar");
    expect(popoverEl(kb)!.accessibleName, "the popover carries the group name").to.equal(expected);
    // The popover is the single name source; naming the toolbar with the same
    // text as well makes assistive technology announce it twice.
    expect(popupEl(kb)!.hasAttribute("aria-label"), "the toolbar does not repeat the popover's name").to.equal(false);
    for (const option of optionEls(kb)) {
      expect(option.getAttribute("role"), "options stay framework buttons").to.not.equal("option");
    }
    pointerUp();
  });

  it("types the base glyph on a fresh tap after the opening gesture released off the popup", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));

    // The opening gesture releases away from the origin key and away from every
    // option: nothing commits and the popup stays open (sticky). No trailing
    // click ever reaches the origin key, so its release-swallow goes unspent.
    pointerUp();
    await renderFinished();
    expect(popupEl(kb), "the popup stayed open").to.exist;

    // A fresh press on that key is a new gesture, not the opening gesture's
    // lift-off: it must dismiss the popup and type the base glyph.
    pressKey(requireKey(kb, "a"));
    await renderFinished();
    expect(input.value, "the fresh tap typed the base glyph").to.equal("a");
    await waitForPopoverGone(kb);
  });

  it("keeps the roving selection when the origin key is right-clicked a second time", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    const aKey = requireKey(kb, "a");
    rightClick(aKey);
    await renderFinished();

    keyDown(popupEl(kb)!, "ArrowRight");
    keyDown(popupEl(kb)!, "ArrowRight");
    await renderFinished();

    // A ui5-popover exempts its own opener from the outside-press dismissal, so
    // a second right-click on the origin key arrives with the popup still live.
    // It must not reset the roving selection out from under the user's focus.
    rightClick(aKey);
    await renderFinished();

    keyDown(popupEl(kb)!, "Enter");
    await renderFinished();
    expect(input.value, "Enter committed the option the roving selection is on").to.equal("â");
  });

  it("does not announce a dismissal when an option commits", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));

    optionEls(kb)[0]!.click(); // ä
    await renderFinished();

    expect(input.value, "the option click committed the variant").to.equal("ä");
    // Positive, not merely "not the dismissal": an empty region satisfies the exclusion
    // too, so a `_writeLiveRegion` that wrote nothing at all would pass.
    expect(liveRegionText(kb), "the open announcement still stands, undisturbed by the commit").to.equal(
      getText("ARIA_VARIANTS_OPENED", "Variants for {1}: {0}").replace("{0}", "3").replace("{1}", "a"),
    );
    pointerUp();
  });

  it("announces dismissal when the popup closes without committing", async () => {
    const { kb, input } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));
    pointerUp();

    keyDown(popupEl(kb)!, "Escape");
    await renderFinished();

    expect(input.value, "Escape committed nothing").to.equal("");
    expect(liveRegionText(kb), "a real dismissal is still announced").to.equal(
      getText("ARIA_VARIANTS_CLOSED", "Variants closed"),
    );
  });

  // Language of parts (WCAG 2.2 SC 3.1.2). The popup is a sibling of the keyboard
  // root rather than a descendant, so it inherits no lang and declares its own.

  it("declares the layout's keycap language on the option toolbar", async () => {
    const { kb } = await setupWithLayout(LANG_VARIANT_LAYOUT, { keycapLang: "ar" });
    await holdOpen(requireKey(kb, "ا"));

    expect(optionGlyphs(kb).length, "the popup opened with options").to.be.above(0);
    expect(popupEl(kb)!.getAttribute("lang"), "the options are Arabic glyphs").to.equal("ar");
    pointerUp();
  });

  it("declares no language when the layout writes its keycaps in the UI language", async () => {
    const { kb } = await setupWithLayout(VARIANT_LAYOUT);
    await holdOpen(requireKey(kb, "a"));

    expect(optionGlyphs(kb).length, "the popup opened with options").to.be.above(0);
    expect(popupEl(kb)!.hasAttribute("lang"), "Latin variants stay in the UI language").to.be.false;
    pointerUp();
  });
});
