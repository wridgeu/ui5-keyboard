import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { MobileKeyboard } from "ui5/kiosk/library";
import Input from "sap/m/Input";
import Popover from "sap/m/Popover";
import { placeAndWait, getRequiredKeyElement, simulateTap, tapKey, waitForRender } from "./test-helpers";
import { VARIANT_HOLD_MS } from "ui5/kiosk/internal/variant-popup-behavior";
import { insertText } from "ui5/kiosk/internal/input-operations";
import { getText } from "ui5/kiosk/internal/i18n-registry";
import { LATIN_DIACRITIC_VARIANTS } from "ui5/kiosk/internal/latin-variants";
import type { CompositionMiddleware, LayoutDefinition } from "ui5/kiosk/types";

// Integration coverage for the long-press accent-variant popup: a hold on a key
// with variants opens a themed sap/m/Popover of sap/m/Button options in the
// static area, keyboard/click selection inserts the chosen glyph at the caret
// through the normal insertion path, a plain tap still inserts the base char,
// Escape / an outside press dismiss without inserting, and Shift surfaces the
// uppercase forms (including ẞ for ß). The ~450ms hold is driven with real timers
// (not sinon) so the Popover's focus moves and autoClose timers do not leave
// orphaned UI5 focus-restoration timers that would poison a later nextUIUpdate.

const DOM = KioskKeyboard.DOM;

function press(kb: KioskKeyboard, el: HTMLElement): void {
  const event = new Event("touchstart", { bubbles: true });
  Object.defineProperty(event, "target", { value: el, writable: false });
  kb.ontouchstart(event);
}

function release(kb: KioskKeyboard, el: HTMLElement): void {
  const event = new Event("touchend", { bubbles: true });
  Object.defineProperty(event, "target", { value: el, writable: false });
  kb.ontouchend(event);
}

/**
 * A right-click the way UI5 delivers it on Windows: EventSimulation maps the
 * right button's mousedown/mouseup onto the simulated touchstart/touchend with
 * no button filter, and the native contextmenu only arrives after the mouseup.
 */
function rightClick(kb: KioskKeyboard, el: HTMLElement): void {
  const touchStart = new Event("touchstart", { bubbles: true, cancelable: true });
  Object.defineProperty(touchStart, "target", { value: el, writable: false });
  Object.defineProperty(touchStart, "button", { value: 2, writable: false });
  kb.ontouchstart(touchStart);

  const touchEnd = new Event("touchend", { bubbles: true });
  Object.defineProperty(touchEnd, "target", { value: el, writable: false });
  Object.defineProperty(touchEnd, "button", { value: 2, writable: false });
  kb.ontouchend(touchEnd);

  const contextMenu = new Event("contextmenu", { bubbles: true, cancelable: true });
  Object.defineProperty(contextMenu, "target", { value: el, writable: false });
  kb.oncontextmenu(contextMenu);
}

/** Press and hold past the open threshold so the popup opens; leaves the press live. */
async function holdOpen(kb: KioskKeyboard, el: HTMLElement): Promise<void> {
  press(kb, el);
  await new Promise((resolve) => setTimeout(resolve, VARIANT_HOLD_MS + 40));
}

/** The wrapping FlexBox of option buttons, rendered by the Popover in the static area. */
function getPopup(): HTMLElement | null {
  return document.querySelector<HTMLElement>(DOM.selectors.variantPopup);
}

/** The rendered option buttons (one sap/m/Button per glyph). */
function getOptions(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(DOM.selectors.variantOption));
}

/** The visible glyph of an option button. */
function glyphOf(option: HTMLElement): string {
  return (option.textContent ?? "").trim();
}

/**
 * Tap an option button through a touch press/release, firing the sap.m.Button
 * `press` the popup commits on. The test runner reports touch support, so a bare
 * synthetic `click` never reaches the button - a touchstart/touchend pair does.
 */
function tapOption(option: HTMLElement): void {
  const start = new Event("touchstart", { bubbles: true, cancelable: true });
  Object.defineProperty(start, "targetTouches", { value: [{}] });
  Object.defineProperty(start, "touches", { value: [{}] });
  Object.defineProperty(start, "changedTouches", { value: [{}] });
  option.dispatchEvent(start);
  const end = new Event("touchend", { bubbles: true, cancelable: true });
  Object.defineProperty(end, "targetTouches", { value: [] });
  Object.defineProperty(end, "touches", { value: [] });
  Object.defineProperty(end, "changedTouches", { value: [{}] });
  option.dispatchEvent(end);
}

function keydownOnPopup(key: string): void {
  const popup = getPopup();
  if (!popup) throw new Error("Popup not open");
  const active = (document.activeElement as HTMLElement | null) ?? popup;
  active.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

async function makeKeyboard(inputValue = ""): Promise<{ kb: KioskKeyboard; input: Input }> {
  const input = new Input({ value: inputValue });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ accentVariants: true, controls: [input.getId()] });
  await placeAndWait(kb);
  input.focus();
  const dom = input.getFocusDomRef() as HTMLInputElement;
  dom.setSelectionRange(inputValue.length, inputValue.length);
  return { kb, input };
}

function cleanup(kb: KioskKeyboard, input: Input): void {
  getPopup()?.remove();
  input.destroy();
  kb.destroy();
  const fixture = document.getElementById("qunit-fixture");
  if (fixture) fixture.innerHTML = "";
}

QUnit.module("KioskKeyboard accent-variant popup", {
  afterEach() {
    getPopup()?.remove();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("accentVariants marks matching keys with data-has-variants", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  const bKey = getRequiredKeyElement(kb, "b");
  assert.strictEqual(aKey.hasAttribute(DOM.attributes.hasVariants), true, "'a' has variants (ä/à/...)");
  assert.strictEqual(bKey.hasAttribute(DOM.attributes.hasVariants), false, "'b' has no default variants");
  cleanup(kb, input);
});

QUnit.test("no data-has-variants when accentVariants is off", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);
  assert.strictEqual(getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants), false, "off by default");
  cleanup(kb, input);
});

QUnit.test("a plain tap still inserts the base character", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  simulateTap(kb, aKey);
  assert.strictEqual(input.getValue(), "a", "quick tap inserts the base glyph, no popup");
  assert.strictEqual(getPopup(), null, "no popup from a quick tap");
  cleanup(kb, input);
});

QUnit.test("hold opens the popup with the correct glyphs", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  assert.strictEqual(getPopup(), null, "no popup before the hold delay");
  await holdOpen(kb, aKey);
  const popup = getPopup();
  assert.ok(popup, "popup opened after the hold delay");
  // The options are hosted by a themed sap/m/Popover rendered into the static area.
  assert.ok(popup!.closest(".sapMPopover"), "options live inside a sap.m.Popover overlay");
  const staticArea = document.getElementById("sap-ui-static");
  assert.ok(staticArea?.contains(popup), "the popover is rendered inside the UI5 static area");
  const glyphs = getOptions().map(glyphOf);
  assert.deepEqual(glyphs, ["à", "á", "â", "ä", "æ", "ã", "å", "ā"], "options are the 'a' variants");
  assert.strictEqual(document.activeElement, getOptions()[0], "first option holds the roving focus");
  assert.strictEqual(getOptions()[1]!.getAttribute("tabindex"), "-1", "inactive options are out of the tab chain");
  release(kb, aKey);
  cleanup(kb, input);
});

QUnit.test("the lift-off after a hold does not also insert the base glyph", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  await holdOpen(kb, aKey);
  release(kb, aKey);
  assert.strictEqual(input.getValue(), "", "no base 'a' inserted by the release that opened the popup");
  assert.ok(getPopup(), "popup stayed open (sticky) after release");
  cleanup(kb, input);
});

QUnit.test("a commit while the origin key is still held does not also type the base", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  // Finger 1 holds 'a' open and stays down; a second finger taps an option.
  await holdOpen(kb, aKey);
  const umlaut = getOptions().find((o) => glyphOf(o) === "ä")!;
  tapOption(umlaut);
  assert.strictEqual(input.getValue(), "ä", "the option tap committed the variant");

  // Finger 1 now lifts off 'a'. Its release belongs to the gesture that opened
  // the popup, so it must stay swallowed even though the popup already closed.
  release(kb, aKey);
  assert.strictEqual(input.getValue(), "ä", "the origin key's release did not append the base 'a'");
  cleanup(kb, input);
});

QUnit.test("Arrow + Enter inserts the chosen glyph at the caret", async (assert) => {
  const { kb, input } = await makeKeyboard("x");
  const aKey = getRequiredKeyElement(kb, "a");
  await holdOpen(kb, aKey);
  release(kb, aKey);
  // Options: à(0) á(1) â(2) ä(3) ... move right three times to ä.
  keydownOnPopup("ArrowRight");
  keydownOnPopup("ArrowRight");
  keydownOnPopup("ArrowRight");
  assert.strictEqual(document.activeElement, getOptions()[3], "ä is the active/focused option");
  keydownOnPopup("Enter");
  assert.strictEqual(input.getValue(), "xä", "ä inserted at the caret after the base text");
  assert.notOk(variantPopup(kb).isOpen(), "popup dismissed after commit");
  cleanup(kb, input);
});

QUnit.test("clicking an option inserts that glyph", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const oKey = getRequiredKeyElement(kb, "o");
  await holdOpen(kb, oKey);
  release(kb, oKey);
  const umlaut = getOptions().find((o) => glyphOf(o) === "ö");
  assert.ok(umlaut, "ö is offered for 'o'");
  tapOption(umlaut!);
  assert.strictEqual(input.getValue(), "ö", "tapped glyph inserted");
  cleanup(kb, input);
});

QUnit.test("Escape dismisses the popup without inserting", async (assert) => {
  const { kb, input } = await makeKeyboard("z");
  const aKey = getRequiredKeyElement(kb, "a");
  await holdOpen(kb, aKey);
  release(kb, aKey);
  keydownOnPopup("Escape");
  assert.notOk(variantPopup(kb).isOpen(), "popup dismissed on Escape");
  assert.strictEqual(input.getValue(), "z", "nothing inserted on Escape");
  cleanup(kb, input);
});

QUnit.test("Shift surfaces the uppercase variants including ẞ for ß", async (assert) => {
  const { kb, input } = await makeKeyboard();
  tapKey(kb, "{shift}");
  const sKey = getRequiredKeyElement(kb, "s");
  await holdOpen(kb, sKey);
  release(kb, sKey);
  const glyphs = getOptions().map(glyphOf);
  assert.ok(glyphs.includes("ẞ"), "capital sharp S ẞ is offered under Shift");
  assert.notOk(glyphs.includes("ß"), "lowercase ß is not offered under Shift");
  const sharp = getOptions().find((o) => glyphOf(o) === "ẞ");
  tapOption(sharp!);
  assert.strictEqual(input.getValue(), "ẞ", "ẞ inserted");
  cleanup(kb, input);
});

QUnit.test("the open announcement names the key's explicit shiftValue under Shift", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "1", shiftValue: "!", variants: ["¹", "½"] }, { value: "{shift}" }]];
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()], instanceLayouts: { qwerty: layout }, layout: "qwerty" });
  await placeAndWait(kb);
  input.focus();

  // Shift makes the key type its explicit shiftValue ("!"), so the popup must
  // announce "!" rather than the uppercased raw value ("1").
  tapKey(kb, "{shift}");
  const oneKey = getRequiredKeyElement(kb, "1");
  await holdOpen(kb, oneKey);

  const expected = getText("ARIA_VARIANTS_OPENED", "{0} variants for {1}").replace("{0}", "2").replace("{1}", "!");
  assert.strictEqual(kb.getDomRef("liveState")?.textContent, expected, "announced with the shiftValue as the base");
  release(kb, oneKey);
  cleanup(kb, input);
});

QUnit.test("the open announcement names the base under CapsLock, not the shiftValue (#176)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "1", shiftValue: "!", variants: ["¹", "½"] }, { value: "{shift}" }]];
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()], instanceLayouts: { qwerty: layout }, layout: "qwerty" });
  await placeAndWait(kb);
  input.focus();

  // CapsLock is uppercase-mode, so the key still types "1"; the popup must
  // announce the base rather than the Shift symbol.
  tapKey(kb, "{shift}");
  tapKey(kb, "{shift}");
  await waitForRender();
  const oneKey = getRequiredKeyElement(kb, "1");
  await holdOpen(kb, oneKey);

  const expected = getText("ARIA_VARIANTS_OPENED", "{0} variants for {1}").replace("{0}", "2").replace("{1}", "1");
  assert.strictEqual(kb.getDomRef("liveState")?.textContent, expected, "announced with the base as the glyph");
  release(kb, oneKey);
  cleanup(kb, input);
});

QUnit.test("right-click opens the popup on a key with variants", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  const event = new Event("contextmenu", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "target", { value: aKey, writable: false });
  kb.oncontextmenu(event);
  assert.ok(getPopup(), "right-click opened the popup");
  assert.ok(event.defaultPrevented, "the native context menu was suppressed");
  cleanup(kb, input);
});

QUnit.test("a right-click opens the popup without first typing the base glyph", async (assert) => {
  const { kb, input } = await makeKeyboard();
  rightClick(kb, getRequiredKeyElement(kb, "a"));
  assert.strictEqual(input.getValue(), "", "the right-click's simulated release did not type 'a'");
  assert.ok(getPopup(), "the right-click opened the popup");
  cleanup(kb, input);
});

QUnit.test("a right-click-opened popup does not swallow the next unrelated key tap", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  const bKey = getRequiredKeyElement(kb, "b");
  // Right-click opens the popup on 'a'; there is no matching release to consume
  // the suppression the open sets, so it must not survive the dismiss.
  const ctx = new Event("contextmenu", { bubbles: true, cancelable: true });
  Object.defineProperty(ctx, "target", { value: aKey, writable: false });
  kb.oncontextmenu(ctx);
  assert.ok(getPopup(), "right-click opened the popup on 'a'");
  keydownOnPopup("Escape");
  assert.notOk(variantPopup(kb).isOpen(), "popup dismissed on Escape");
  simulateTap(kb, bKey);
  assert.strictEqual(input.getValue(), "b", "a normal tap on 'b' still inserts 'b'");
  cleanup(kb, input);
});

QUnit.test("hold lift-off is suppressed and does not swallow a later tap", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  const bKey = getRequiredKeyElement(kb, "b");
  await holdOpen(kb, aKey);
  release(kb, aKey);
  assert.strictEqual(input.getValue(), "", "the hold's lift-off did not insert the base 'a'");
  keydownOnPopup("Escape");
  simulateTap(kb, bKey);
  assert.strictEqual(input.getValue(), "b", "a later tap on 'b' inserts normally");
  cleanup(kb, input);
});

QUnit.test("a key press while the popup is open closes it and still types", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  const bKey = getRequiredKeyElement(kb, "b");
  await holdOpen(kb, aKey);
  release(kb, aKey);
  assert.ok(getPopup(), "popup open on 'a' before the next key press");
  assert.ok(variantPopup(kb).isOpen(), "the behavior reports the popup open");
  assert.strictEqual(input.getValue(), "", "the opening hold's lift-off inserted nothing");
  // A press on a different key both dismisses the open popup (its options live
  // in the static area, so any keyboard key is "outside") and types that key.
  simulateTap(kb, bKey);
  assert.notOk(variantPopup(kb).isOpen(), "the press on 'b' closed the popup");
  assert.strictEqual(input.getValue(), "b", "the same tap that dismissed the popup typed 'b'");
  cleanup(kb, input);
});

QUnit.test("re-pressing the origin key while the popup is open closes it", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  await holdOpen(kb, aKey);
  release(kb, aKey);
  assert.ok(getPopup(), "popup open on 'a'");
  assert.ok(variantPopup(kb).isOpen(), "the behavior reports the popup open");
  // Tapping the same origin key again dismisses the popup (it may also type 'a').
  simulateTap(kb, aKey);
  assert.notOk(variantPopup(kb).isOpen(), "re-pressing the origin key 'a' closed the popup");
  cleanup(kb, input);
});

QUnit.test(
  "pressing a second variant key before the hold fires supersedes the first, not stacks it",
  async (assert) => {
    const { kb, input } = await makeKeyboard();
    const aKey = getRequiredKeyElement(kb, "a");
    const oKey = getRequiredKeyElement(kb, "o");

    // Roll from 'a' onto 'o' (a second press before either release, e.g. multitouch)
    // while 'a's hold is still pending. Arming 'o' must cancel 'a's hold, so the
    // popup opens on 'o's own threshold - not early off a leaked 'a' timer.
    press(kb, aKey);
    await new Promise((resolve) => setTimeout(resolve, 250));
    press(kb, oKey);

    // Past 'a's threshold (from its press) but before 'o's: a leaked 'a' timer would
    // open the popup here. It must stay closed until 'o's own hold elapses.
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.strictEqual(getPopup(), null, "the superseded 'a' hold did not open a popup");

    // Past 'o's own threshold: the popup opens once, and it belongs to 'o'.
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.ok(getPopup(), "the popup opened on 'o's own hold");
    assert.ok(getOptions().map(glyphOf).includes("ö"), "the open popup offers 'o's variants (ö)");

    release(kb, oKey);
    cleanup(kb, input);
  },
);

QUnit.test("an outside press dismisses the popup without inserting", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  await holdOpen(kb, aKey);
  release(kb, aKey);
  assert.ok(getPopup(), "popup open before the outside press");
  // The Popover binds its outside-press autoClose only once the open animation
  // completes (Popup._opened); wait it out so the touchstart below is observed.
  await new Promise((resolve) => setTimeout(resolve, 400));
  // The runner reports touch support, so autoClose listens for an outside
  // touchstart (the Popup binds "touchstart mousedown"); dispatch one on the
  // document body, away from the popover.
  (input.getFocusDomRef() as HTMLElement).focus();
  document.body.dispatchEvent(new Event("touchstart", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.notOk(variantPopup(kb).isOpen(), "outside press dismissed the popup");
  assert.strictEqual(input.getValue(), "", "nothing inserted by the outside press");
  cleanup(kb, input);
});

QUnit.test("a touch drag-release over an option commits that glyph", async (assert) => {
  // The Popover docks to the pressed key; QUnit parks its fixture off-screen, so
  // pull it on-screen for this coordinate-based hit-test (elementFromPoint).
  const fixture = document.getElementById("qunit-fixture")!;
  const restoreFixture = fixture.style.cssText;
  fixture.style.cssText = "position:absolute;top:0;left:0;width:100%";
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  await holdOpen(kb, aKey);
  // Options: à(0) á(1) â(2) ...; drag the finger onto â and lift off over it.
  // Drives the document touchmove/touchend the behavior listens to and lets its
  // own elementFromPoint hit-test resolve the option under the released finger.
  const target = getOptions()[2]!;
  const rect = target.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  const move = new Event("touchmove", { bubbles: true, cancelable: true });
  Object.defineProperty(move, "changedTouches", { value: [{ clientX, clientY }] });
  // UI5's touch->mouse simulation reads `touches[0]` on a touchmove; a real touch
  // event always carries it, so the synthetic one must too.
  Object.defineProperty(move, "touches", { value: [{ clientX, clientY }] });
  document.dispatchEvent(move);
  const end = new Event("touchend", { bubbles: true });
  Object.defineProperty(end, "changedTouches", { value: [{ clientX, clientY }] });
  document.dispatchEvent(end);
  assert.strictEqual(input.getValue(), "â", "the glyph under the released finger is committed");
  assert.notOk(variantPopup(kb).isOpen(), "popup dismissed after the drag-release commit");
  cleanup(kb, input);
  fixture.style.cssText = restoreFixture;
});

QUnit.test("the options are grouped as a toolbar named by the popover", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  await holdOpen(kb, aKey);

  const popup = getPopup();
  assert.strictEqual(popup!.getAttribute("role"), "toolbar", "the option container is a toolbar");
  // The Popover is a role="dialog" overlay named through aria-labelledby; it is
  // the single name source, so the toolbar carries no name of its own. Mirrors
  // the sibling webc twin's dialog > toolbar > button[] shape.
  const popover = popup!.closest(".sapMPopover");
  const labelId = popover?.getAttribute("aria-labelledby");
  assert.ok(labelId, "the popover is named through aria-labelledby");
  assert.ok(document.getElementById(labelId!)?.textContent, "the name resolves to non-empty text");
  assert.strictEqual(popup!.hasAttribute("aria-label"), false, "the toolbar does not repeat the popover's name");

  release(kb, aKey);
  cleanup(kb, input);
});

QUnit.test("RTL reverses ArrowLeft/ArrowRight option navigation", async (assert) => {
  const { kb, input } = await makeKeyboard();
  // The popup reads the anchor key's writing direction at open, so force RTL on
  // the keyboard root and the options lay out right-to-left.
  kb.getDomRef()!.setAttribute("dir", "rtl");
  const aKey = getRequiredKeyElement(kb, "a");
  await holdOpen(kb, aKey);
  release(kb, aKey);
  // Layout and arrow polarity must come from the same source. Asserting only the
  // focus move would pass with the options still laid out left-to-right, which
  // would send ArrowLeft's focus visually rightward.
  assert.ok(
    getOptions()[1]!.getBoundingClientRect().left < getOptions()[0]!.getBoundingClientRect().left,
    "the options lay out right-to-left (option 1 sits left of option 0)",
  );
  // Options: à(0) á(1) â(2) ...; in RTL, ArrowLeft advances to the visually-next
  // (higher-index) option, the mirror of LTR where ArrowLeft would stay at 0.
  keydownOnPopup("ArrowLeft");
  assert.strictEqual(document.activeElement, getOptions()[1], "RTL ArrowLeft moved to the next (higher-index) option");
  keydownOnPopup("Enter");
  assert.strictEqual(input.getValue(), "á", "the RTL-advanced option á is committed");
  cleanup(kb, input);
});

QUnit.test("a consumer preventDefault on keyPress vetoes the variant insert", async (assert) => {
  const { kb, input } = await makeKeyboard("z");
  kb.attachKeyPress((e) => {
    if (e.getParameter("key") === "ä") e.preventDefault();
  });
  const aKey = getRequiredKeyElement(kb, "a");
  await holdOpen(kb, aKey);
  release(kb, aKey);
  // Move to ä (index 3) and commit; the consumer vetoes its insertion.
  keydownOnPopup("ArrowRight");
  keydownOnPopup("ArrowRight");
  keydownOnPopup("ArrowRight");
  keydownOnPopup("Enter");
  assert.strictEqual(input.getValue(), "z", "the vetoed variant inserted nothing");
  assert.notOk(variantPopup(kb).isOpen(), "the popup still closes after a veto");
  cleanup(kb, input);
});

QUnit.module("KioskKeyboard accent-variant commit during composition", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

/** Reach the private variant-commit entry point every commit path funnels through. */
function commitVariant(kb: KioskKeyboard, glyph: string): void {
  (kb as unknown as { _commitVariant(glyph: string): void })._commitVariant(glyph);
}

QUnit.test("committing a variant mid-composition finalizes the active composition first", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()], layout: "ko-hangul" });
  await placeAndWait(kb);
  input.focus();
  const dom = input.getFocusDomRef() as HTMLInputElement;
  dom.setSelectionRange(0, 0);

  // Compose 가 through the real key path: ㄱ (leading) then ㅏ (vowel).
  tapKey(kb, "ㄱ"); // ㄱ
  tapKey(kb, "ㅏ"); // ㅏ
  assert.strictEqual(input.getValue(), "가", "preedit shows 가 before the variant commit");

  // Commit accent variant ä through the real commit path while 가 is still an
  // in-progress preedit. This must finalize (keep) 가, drop the middleware, then
  // insert ä after it.
  commitVariant(kb, "ä"); // ä
  assert.strictEqual(input.getValue(), "가ä", "variant commit finalizes 가, then appends ä");

  // The next jamo must start a fresh syllable AFTER the accent, not reach back
  // over it: ㄴ then ㅏ compose 나 following the accent.
  tapKey(kb, "ㄴ"); // ㄴ
  tapKey(kb, "ㅏ"); // ㅏ

  assert.strictEqual(input.getValue(), "가ä나", "next jamo composes 나 after ä (가ä나)");
  assert.strictEqual(dom.selectionStart, 3, "caret sits after 나");

  input.destroy();
  kb.destroy();
});

/**
 * Test-only consumer composition middleware. Seeds a live preedit from the
 * first single-char key it receives and joins every following key into the
 * SAME run with a hyphen, re-rendered in place through the host insertText
 * pipeline. A hyphen appears only between glyphs that entered the same buffer,
 * so it is observable proof that a committed accent variant was routed into
 * composition (seeding the buffer) rather than inserted literally beside it.
 */
function createJoinStubMiddleware(): CompositionMiddleware {
  let buffer = "";
  let start = 0;
  let renderedLen = 0;
  let active = false;

  return {
    handleKey(key, el): boolean {
      if (key.length !== 1) return false;
      if (!active) {
        active = true;
        start = el.selectionStart ?? el.value.length;
        buffer = "";
        renderedLen = 0;
      }
      buffer += key;
      const rendered = buffer.split("").join("-");
      insertText(el, rendered, [start, start + renderedLen]);
      renderedLen = rendered.length;
      return true;
    },
    commit(): string | null {
      const text = active ? buffer : null;
      active = false;
      buffer = "";
      renderedLen = 0;
      return text;
    },
    reset(): void {
      active = false;
      buffer = "";
      renderedLen = 0;
    },
  };
}

QUnit.test("a committed variant seeds the consumer's composition (Layer 2)", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({
    controls: [input.getId()],
    layout: "qwerty",
    instanceMiddleware: { qwerty: createJoinStubMiddleware },
  });
  await placeAndWait(kb);
  input.focus();
  const dom = input.getFocusDomRef() as HTMLInputElement;
  dom.setSelectionRange(0, 0);

  // Commit accent variant ä through the real popup-commit path. Layer 2 routes
  // the glyph through the SAME composition pipeline a key press uses, so the
  // consumer middleware seeds its buffer with ä rather than the control
  // inserting ä literally beside the buffer.
  commitVariant(kb, "ä");
  assert.strictEqual(input.getValue(), "ä", "the variant seeded the preedit (single-glyph buffer renders as ä)");

  // The next key joins the SAME buffer; the stub hyphen-joins buffer members, so
  // ä and x are joined only because ä seeded the composition. On the pre-Layer-2
  // flush path ä was inserted literally, x would seed a fresh buffer, and the
  // value would be "äx" with no joining hyphen.
  tapKey(kb, "x");
  assert.strictEqual(input.getValue(), "ä-x", "the next key continues the ä-seeded composition (ä-x)");
  assert.strictEqual(dom.selectionStart, 3, "caret sits after the joined run");

  input.destroy();
  kb.destroy();
});

/** Typed view of the control internals the popup tests reach into. */
interface VariantInternals {
  _variantPopup: { isOpen(): boolean };
  getAggregation(name: string): Popover | null;
}

/** The control-owned popup behavior (private field), for its `isOpen()` state. */
function variantPopup(kb: KioskKeyboard): { isOpen(): boolean } {
  return (kb as unknown as VariantInternals)._variantPopup;
}

/** The control-owned Popover, held in the hidden `_variantPopover` aggregation. */
function getPopover(kb: KioskKeyboard): Popover | undefined {
  return (kb as unknown as VariantInternals).getAggregation("_variantPopover") ?? undefined;
}

QUnit.test("the popover is owned in the hidden _variantPopover aggregation and reused", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");

  await holdOpen(kb, aKey);
  const first = getPopover(kb);
  assert.ok(first, "opening populated the control's _variantPopover aggregation");
  assert.ok(first!.isA("sap.m.Popover"), "the aggregation holds a sap.m.Popover");
  release(kb, aKey);
  keydownOnPopup("Escape");
  assert.notOk(variantPopup(kb).isOpen(), "popup dismissed before the second open");

  // Reopening reuses the same instance rather than minting a fresh Popover.
  await holdOpen(kb, aKey);
  const second = getPopover(kb);
  assert.strictEqual(second, first, "the same Popover instance is reused across opens");
  release(kb, aKey);

  // The aggregation is hidden, so UI5 generates no public named accessor for it;
  // it stays reachable only through the generic getAggregation.
  assert.strictEqual(
    typeof (kb as unknown as { getVariantPopover?: unknown }).getVariantPopover,
    "undefined",
    "the control exposes no public getVariantPopover getter",
  );
  cleanup(kb, input);
});

QUnit.test("the held anchor key's pressed transform is neutralized while its popup is open", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");

  await holdOpen(kb, aKey);
  assert.ok(variantPopup(kb).isOpen(), "the variant popup opened on the hold");
  assert.ok(aKey.classList.contains(DOM.classes.keyPressed), "the held anchor key still carries the pressed state");

  // The popup is a static-area sap.m.Popover docked to this key via openBy. The
  // pressed scale() shrinks the key's rect; when the press releases the rect
  // grows back and the Popover's follow-of re-docks it, nudging the popup a few
  // pixels sideways. Marking the anchor neutralizes that transform for as long
  // as the popup is open, so the docking rect stays put across the release.
  assert.ok(aKey.classList.contains(DOM.classes.keyVariantAnchor), "the anchor key is marked while its popup is open");
  assert.strictEqual(
    getComputedStyle(aKey).transform,
    "none",
    "the marked anchor carries no transform, so its rect is stable across the release",
  );

  release(kb, aKey);
  keydownOnPopup("Escape");
  assert.notOk(variantPopup(kb).isOpen(), "the popup dismissed");
  assert.notOk(
    aKey.classList.contains(DOM.classes.keyVariantAnchor),
    "dismissing clears the anchor marker for the next open",
  );
  cleanup(kb, input);
});

QUnit.test("the popover density stays proportional to the keyboard key size", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const root = kb.getDomRef() as HTMLElement;
  const aKey = getRequiredKeyElement(kb, "a");

  // The keyboard's own responsive scaling shrinks keys through the public CSS
  // var and sets no density class to inherit; once the keys drop below the cozy
  // touch target the popover adopts a compact density so its options stay
  // proportional (framework density class, no size override).
  root.style.setProperty("--ui5KioskKeyboard-keyHeight", "20px");
  await holdOpen(kb, aKey);
  assert.ok(getPopover(kb)?.hasStyleClass("sapUiSizeCompact"), "small keys -> compact popover");
  release(kb, aKey);
  keydownOnPopup("Escape");

  // At a full-size key the popover keeps the default (cozy) density.
  root.style.setProperty("--ui5KioskKeyboard-keyHeight", "64px");
  await holdOpen(kb, aKey);
  assert.notOk(getPopover(kb)?.hasStyleClass("sapUiSizeCompact"), "full-size keys -> no compact class");
  release(kb, aKey);
  cleanup(kb, input);
});

QUnit.test("each option cell is sized to the anchor key's rendered footprint", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const root = kb.getDomRef() as HTMLElement;

  // Compress the keyboard so its keys render well under the framework button
  // min-width (~2.25rem/36px). The options must still match the key width, which
  // proves the cells are sized to the key footprint and that the framework floor
  // was cleared - not merely floored at that min-width as they were before.
  root.style.width = "240px";
  const aKey = getRequiredKeyElement(kb, "a");

  await holdOpen(kb, aKey);
  // The options are sized to the anchor's resting footprint; offsetWidth /
  // offsetHeight report the layout border-box, so the comparison holds
  // regardless of the pressed transform the held key carries.
  const keyWidth = aKey.offsetWidth;
  const keyHeight = aKey.offsetHeight;
  assert.ok(keyWidth < 36, `keys compressed below the button min-width floor (${keyWidth}px)`);
  const options = getOptions();
  assert.ok(options.length > 0, "options rendered");
  for (const option of options) {
    const optionRect = option.getBoundingClientRect();
    assert.ok(
      Math.abs(optionRect.width - keyWidth) < 0.5,
      `option '${glyphOf(option)}' width ${optionRect.width.toFixed(1)}px matches key width ${keyWidth.toFixed(1)}px`,
    );
    assert.ok(
      Math.abs(optionRect.height - keyHeight) < 0.5,
      `option '${glyphOf(option)}' height ${optionRect.height.toFixed(1)}px matches key height ${keyHeight.toFixed(1)}px`,
    );
    // The visible, bordered box is the sap.m.Button inner element; it must fill the
    // sized outer button so the rendered cell (not just the outer box) is key-tall.
    const inner = option.querySelector(".sapMBtnInner") as HTMLElement;
    assert.ok(
      Math.abs(inner.getBoundingClientRect().height - keyHeight) < 0.5,
      `option '${glyphOf(option)}' visible inner ${inner.getBoundingClientRect().height.toFixed(1)}px matches key height ${keyHeight.toFixed(1)}px`,
    );
  }
  release(kb, aKey);
  cleanup(kb, input);
});

QUnit.test("each option cell matches the full key width on wide keyboards", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const root = kb.getDomRef() as HTMLElement;

  // A wide keyboard with a short key-height makes keys far wider than tall; the
  // option width must still match the full key width (not cap at the key height),
  // so the cells stay proportional to the keys.
  root.style.width = "900px";
  root.style.setProperty("--ui5KioskKeyboard-keyHeight", "20px");
  const aKey = getRequiredKeyElement(kb, "a");

  await holdOpen(kb, aKey);
  const keyWidth = aKey.offsetWidth;
  assert.ok(keyWidth > aKey.offsetHeight, `wide key is wider than tall (${keyWidth} > ${aKey.offsetHeight})`);
  const options = getOptions();
  assert.ok(options.length > 0, "options rendered");
  for (const option of options) {
    const optionWidth = option.getBoundingClientRect().width;
    assert.ok(
      Math.abs(optionWidth - keyWidth) < 0.5,
      `option '${glyphOf(option)}' width ${optionWidth.toFixed(1)}px matches the wide key width ${keyWidth}px`,
    );
  }
  release(kb, aKey);
  cleanup(kb, input);
});

QUnit.test("options follow the key's resting width, not its pressed-scale transform", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const root = kb.getDomRef() as HTMLElement;
  root.style.width = "600px";
  const aKey = getRequiredKeyElement(kb, "a");

  // A pressed key carries a scale() transform: the rendered rect shrinks but the
  // layout box (offsetWidth) does not. The options are sized from the layout box,
  // so they stay key-wide.
  aKey.style.transform = "scale(0.5)";
  await holdOpen(kb, aKey);
  assert.ok(aKey.getBoundingClientRect().width < aKey.offsetWidth, "the transform shrank the rendered rect");
  const option = getOptions()[0]!;
  assert.ok(
    Math.abs(option.getBoundingClientRect().width - aKey.offsetWidth) < 0.5,
    `option width ${option.getBoundingClientRect().width.toFixed(1)}px follows the resting key width ${aKey.offsetWidth}px`,
  );
  release(kb, aKey);
  cleanup(kb, input);
});

QUnit.test("the popover content frame is flattened to the option-grid inset", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  await holdOpen(kb, aKey);
  const popup = getPopup();
  assert.ok(popup, "popup open");

  // The sap.m.Popover wraps the option grid in a content frame (base margin +
  // Horizon padding on .sapMPopoverCont); the control flattens it so the grid's
  // own 0.25rem inset is the only spacing rather than a doubled, oversized frame.
  const cont = popup!.closest(".sapMPopover")!.querySelector<HTMLElement>(".sapMPopoverCont")!;
  const style = getComputedStyle(cont);
  assert.strictEqual(style.marginTop, "0px", "content frame margin flattened");
  assert.strictEqual(style.paddingTop, "0px", "content frame padding flattened");
  release(kb, aKey);
  cleanup(kb, input);
});

QUnit.test("opening the variant popup keeps a docked auto-show keyboard open", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    accentVariants: true,
    mobileKeyboard: MobileKeyboard.Custom,
    controls: [input.getId()],
  });
  await placeAndWait(kb);

  (input.getFocusDomRef() as HTMLElement).focus();
  await waitForRender();
  assert.ok(kb.isOpen(), "docked keyboard auto-showed on input focus");

  const aKey = getRequiredKeyElement(kb, "a");
  await holdOpen(kb, aKey);
  assert.ok(getPopup(), "variant popup opened");

  // The popup moved focus to its first option in the static area, firing a
  // focusout on the input; let the deferred (rAF) auto-show close run.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  assert.ok(kb.isOpen(), "docked keyboard stays open while the variant popup is open");

  release(kb, aKey);
  cleanup(kb, input);
});

// #175: a variant gesture on a second key re-anchors the popup rather than being
// swallowed. The reused Popover hosts one session at a time, so the new anchor
// claims it only after the framework has fired afterClose for the previous one;
// the settle window below is real time (this suite forbids sinon fake timers) and
// covers that close plus the Popover's own CLOSING poll.
const RETARGET_SETTLE_MS = 400;

/** The default table's variants for the two keys the re-anchor cases gesture on. */
const aVariants = LATIN_DIACRITIC_VARIANTS.a!;
const oVariants = LATIN_DIACRITIC_VARIANTS.o!;

/**
 * Index of the option carrying the roving selection. `ButtonType.Emphasized`
 * renders as `sapMBtnInverted`.
 */
function activeOptionIndex(): number {
  return getOptions().findIndex((option) => option.classList.contains("sapMBtnInverted"));
}

QUnit.module("KioskKeyboard accent-variant popup re-anchoring (#175)", {
  afterEach() {
    getPopup()?.remove();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("a right-click on a second variant key re-anchors the popup", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  const oKey = getRequiredKeyElement(kb, "o");

  rightClick(kb, aKey);
  assert.deepEqual(getOptions().map(glyphOf), [...aVariants], "popup opened on the first key");

  rightClick(kb, oKey);
  await new Promise((resolve) => setTimeout(resolve, RETARGET_SETTLE_MS));

  assert.deepEqual(getOptions().map(glyphOf), [...oVariants], "the popup now offers the second key's variants");
  assert.strictEqual(
    document.querySelectorAll(DOM.selectors.variantPopup).length,
    1,
    "exactly one popup exists after the re-anchor",
  );
  assert.notOk(aKey.classList.contains(DOM.classes.keyVariantAnchor), "the first key is no longer the anchor");
  assert.ok(oKey.classList.contains(DOM.classes.keyVariantAnchor), "the second key is the anchor");

  cleanup(kb, input);
});

QUnit.test("a re-targeted popup survives the previous session's afterClose", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  const oKey = getRequiredKeyElement(kb, "o");

  rightClick(kb, aKey);
  rightClick(kb, oKey);
  await new Promise((resolve) => setTimeout(resolve, RETARGET_SETTLE_MS));

  // The afterClose belonging to the dismissed session must not tear down the
  // session that replaced it on the reused Popover.
  getPopover(kb)!.fireAfterClose();

  assert.ok(getPopup(), "the popup is still open after the stale afterClose");
  assert.deepEqual(getOptions().map(glyphOf), [...oVariants], "it still offers the second key's variants");

  cleanup(kb, input);
});

QUnit.test("a right-click on the key that already owns the popup keeps the roving selection", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");

  rightClick(kb, aKey);
  keydownOnPopup("ArrowRight");
  await waitForRender();
  assert.strictEqual(activeOptionIndex(), 1, "arrow moved the selection to the second option");

  rightClick(kb, aKey);
  await new Promise((resolve) => setTimeout(resolve, RETARGET_SETTLE_MS));

  assert.strictEqual(activeOptionIndex(), 1, "re-gesturing the same key does not restart the session");

  cleanup(kb, input);
});

QUnit.test("a hold on a second variant key keeps the first popup up until it opens", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  const oKey = getRequiredKeyElement(kb, "o");

  await holdOpen(kb, aKey);
  release(kb, aKey); // sticky: the popup stays open, anchored to 'a'

  // The retarget is one gesture: the first key's options stay on screen while
  // the second key's hold runs, rather than blanking at press time.
  press(kb, oKey);
  assert.ok(variantPopup(kb).isOpen(), "the popup is still owned mid-hold, not dismissed at press time");
  assert.deepEqual(getOptions().map(glyphOf), [...aVariants], "the first key's options are still up mid-hold");

  await new Promise((resolve) => setTimeout(resolve, VARIANT_HOLD_MS + 40));
  await new Promise((resolve) => setTimeout(resolve, RETARGET_SETTLE_MS));

  assert.deepEqual(getOptions().map(glyphOf), [...oVariants], "the hold re-anchored the popup to the second key");
  assert.ok(oKey.classList.contains(DOM.classes.keyVariantAnchor), "the second key is the anchor");

  release(kb, oKey);
  cleanup(kb, input);
});

QUnit.test("a short tap on a second variant key still dismisses the popup and types", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const aKey = getRequiredKeyElement(kb, "a");
  const oKey = getRequiredKeyElement(kb, "o");

  await holdOpen(kb, aKey);
  release(kb, aKey); // sticky: the popup stays open, anchored to 'a'

  // Too short to be a retarget: the tap dismisses the popup and types, as a tap
  // on any other key does.
  simulateTap(kb, oKey);
  await new Promise((resolve) => setTimeout(resolve, RETARGET_SETTLE_MS));

  assert.strictEqual(input.getValue(), "o", "the dismissing tap also typed");
  assert.notOk(variantPopup(kb).isOpen(), "the popup closed");

  cleanup(kb, input);
});
