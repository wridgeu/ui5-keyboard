import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import { BACKSPACE_AUTO_REPEAT } from "ui5/kiosk/internal/auto-repeat";
import { VARIANT_HOLD_MS } from "ui5/kiosk/internal/variant-popup-behavior";
import { destroyKeyboards, getRequiredKeyElement, hasKeyClass, placeAndWait, waitForRender } from "./test-helpers";
import CustomLayout from "ui5/kiosk/CustomLayout";

// Pointer presses as a touchscreen delivers them: every touch event names the
// fingers it changed in `changedTouches`, each with its own `identifier`, and a
// finger's touchend targets the element its touchstart hit.

const DOM = KioskKeyboard.DOM;
const T = BACKSPACE_AUTO_REPEAT;

function touch(kb: KioskKeyboard, type: "touchstart" | "touchend", el: HTMLElement, identifier: number): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "target", { value: el, writable: false });
  Object.defineProperty(event, "changedTouches", { value: [{ identifier, target: el }], writable: false });
  if (type === "touchstart") kb.ontouchstart(event);
  else kb.ontouchend(event);
}

async function makeKeyboard(
  value = "",
  settings: { accentVariants?: boolean } = {},
): Promise<{ kb: KioskKeyboard; input: Input; dom: HTMLInputElement }> {
  const input = new Input({ value });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ ...settings, controls: [input.getId()] });
  await placeAndWait(kb);
  input.focus();
  const dom = input.getFocusDomRef() as HTMLInputElement;
  dom.setSelectionRange(value.length, value.length);
  return { kb, input, dom };
}

QUnit.module("KioskKeyboard pointer presses", {
  afterEach() {
    destroyKeyboards();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("two-finger rollover types both keys in release order", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const a = getRequiredKeyElement(kb, "a");
  const s = getRequiredKeyElement(kb, "s");

  touch(kb, "touchstart", a, 1);
  touch(kb, "touchstart", s, 2);
  touch(kb, "touchend", a, 1);
  assert.notOk(hasKeyClass(kb, "a", DOM.classes.keyPressed), "the first finger's key is unpainted on its release");
  assert.ok(hasKeyClass(kb, "s", DOM.classes.keyPressed), "the second finger's key stays pressed");
  touch(kb, "touchend", s, 2);

  assert.strictEqual(input.getValue(), "as", "both keys typed");
  input.destroy();
});

QUnit.test("fingers lifted out of press order type in release order", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const a = getRequiredKeyElement(kb, "a");
  const s = getRequiredKeyElement(kb, "s");

  touch(kb, "touchstart", a, 1);
  touch(kb, "touchstart", s, 2);
  touch(kb, "touchend", s, 2);
  touch(kb, "touchend", a, 1);

  assert.strictEqual(input.getValue(), "sa", "each finger types its own key when it lifts");
  input.destroy();
});

QUnit.test("a second finger's press ends a held Backspace's repeat", async (assert) => {
  const { kb, input } = await makeKeyboard("abcdefghij");
  const bksp = getRequiredKeyElement(kb, "{backspace}");
  const x = getRequiredKeyElement(kb, "x");
  const clock = sinon.useFakeTimers();
  try {
    touch(kb, "touchstart", bksp, 1);
    clock.tick(T.initialDelayMs);
    assert.strictEqual(input.getValue(), "abcdefghi", "precondition: the hold repeated once");

    touch(kb, "touchstart", x, 2);
    clock.tick(2000);
    assert.strictEqual(input.getValue(), "abcdefghi", "the repeat stops while the second finger is down");
    touch(kb, "touchend", x, 2);
    assert.strictEqual(input.getValue(), "abcdefghix", "the second finger types its key");

    touch(kb, "touchend", bksp, 1);
    assert.strictEqual(input.getValue(), "abcdefghix", "the repeated hold's release deletes nothing more");
  } finally {
    // Flush the render a test-time invalidation queued on the fake clock, or UI5
    // believes one is still scheduled and never renders again.
    kb.destroy();
    clock.tick(50);
    clock.restore();
  }
  input.destroy();
});

QUnit.test("hiding an undocked keyboard mid-hold ends the Backspace repeat", async (assert) => {
  const { kb, input } = await makeKeyboard("abcdefghij");
  const bksp = getRequiredKeyElement(kb, "{backspace}");
  const clock = sinon.useFakeTimers();
  try {
    touch(kb, "touchstart", bksp, 1);
    clock.tick(T.initialDelayMs);
    assert.strictEqual(input.getValue(), "abcdefghi", "precondition: the hold repeated once");

    kb.setVisible(false);
    clock.tick(2000);
    assert.strictEqual(input.getValue(), "abcdefghi", "the hidden keyboard erases nothing more");
  } finally {
    // Flush the render a test-time invalidation queued on the fake clock, or UI5
    // believes one is still scheduled and never renders again.
    kb.destroy();
    clock.tick(50);
    clock.restore();
  }
  input.destroy();
});

QUnit.test("a second finger's press ends a pending accent hold", async (assert) => {
  const { kb, input } = await makeKeyboard("", { accentVariants: true });
  const a = getRequiredKeyElement(kb, "a");
  const q = getRequiredKeyElement(kb, "q");

  touch(kb, "touchstart", a, 1);
  touch(kb, "touchstart", q, 2);
  await new Promise((resolve) => setTimeout(resolve, VARIANT_HOLD_MS + 60));
  assert.strictEqual(
    document.querySelector(DOM.selectors.variantPopup),
    null,
    "the first finger's hold opened nothing",
  );

  touch(kb, "touchend", q, 2);
  touch(kb, "touchend", a, 1);
  assert.strictEqual(input.getValue(), "qa", "both taps typed");
  input.destroy();
});

QUnit.test("a press after a window blur gets a live safety net of its own", async (assert) => {
  const { kb, input } = await makeKeyboard();
  const q = getRequiredKeyElement(kb, "q");
  const w = getRequiredKeyElement(kb, "w");

  touch(kb, "touchstart", q, 1);
  window.dispatchEvent(new Event("blur"));
  assert.notOk(hasKeyClass(kb, "q", DOM.classes.keyPressed), "precondition: the blur ended the first press");

  touch(kb, "touchstart", w, 1);
  window.dispatchEvent(new Event("blur"));
  assert.notOk(hasKeyClass(kb, "w", DOM.classes.keyPressed), "the second press is ended by the next blur too");
  input.destroy();
});

QUnit.test("an edit to the active custom layout under a held key types neither key", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  const layout = new CustomLayout({ name: "edited", rows: [[{ value: "b" }, { value: "z" }]] });
  const kb = new KioskKeyboard({ customLayouts: [layout], layout: "edited", controls: [input.getId()] });
  await placeAndWait(kb);
  input.focus();
  const held = getRequiredKeyElement(kb, "b");

  touch(kb, "touchstart", held, 1);
  layout.setRows([[{ value: "d" }, { value: "z" }]]);
  await waitForRender();
  assert.strictEqual(held.dataset.key, "d", "precondition: the render patched another key into the held element");
  touch(kb, "touchend", held, 1);
  assert.strictEqual(input.getValue(), "", "the release types nothing");

  touch(kb, "touchstart", held, 2);
  touch(kb, "touchend", held, 2);
  assert.strictEqual(input.getValue(), "d", "a fresh tap types the new key");
  input.destroy();
});
