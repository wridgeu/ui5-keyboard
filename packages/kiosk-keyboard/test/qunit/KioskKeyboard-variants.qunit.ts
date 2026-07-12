import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import Popover from "sap/m/Popover";
import { placeAndWait, getRequiredKeyElement, simulateTap, tapKey } from "./test-helpers";
import { VARIANT_HOLD_MS } from "ui5/kiosk/internal/variant-popup-behavior";
import { insertText } from "ui5/kiosk/internal/input-operations";
import type { CompositionMiddleware } from "ui5/kiosk/types";

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
  assert.strictEqual(aKey.dataset.hasVariants, "true", "'a' has variants (ä/à/...)");
  assert.strictEqual(bKey.dataset.hasVariants, undefined, "'b' has no default variants");
  cleanup(kb, input);
});

QUnit.test("no data-has-variants when accentVariants is off", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);
  assert.strictEqual(getRequiredKeyElement(kb, "a").dataset.hasVariants, undefined, "off by default");
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
  // Measure the anchor at open time: the popup sizes each option from the key's
  // rect as rendered then (the held key carries its pressed transform), so the
  // comparison must read the same footprint the sizing was derived from.
  const keyRect = aKey.getBoundingClientRect();
  const keyWidth = keyRect.width;
  const keyHeight = keyRect.height;
  assert.ok(keyWidth < 36, `keys compressed below the button min-width floor (${keyWidth.toFixed(1)}px)`);
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
  const keyRect = aKey.getBoundingClientRect();
  assert.ok(
    keyRect.width > keyRect.height,
    `wide key is wider than tall (${keyRect.width.toFixed(1)} > ${keyRect.height.toFixed(1)})`,
  );
  const options = getOptions();
  assert.ok(options.length > 0, "options rendered");
  for (const option of options) {
    const optionWidth = option.getBoundingClientRect().width;
    assert.ok(
      Math.abs(optionWidth - keyRect.width) < 0.5,
      `option '${glyphOf(option)}' width ${optionWidth.toFixed(1)}px matches the wide key width ${keyRect.width.toFixed(1)}px`,
    );
  }
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
