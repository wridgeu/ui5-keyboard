import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import {
  placeAndWait,
  waitForRender,
  tapKey,
  freezeDoubleClickWindow,
  isShiftActive,
  isCapsLock,
} from "./test-helpers";
import type { LayoutDefinition } from "ui5/kiosk/types";

// #199: reset() restores a fresh input context on a reused instance without
// destroying it - the case the demo's loadFragment create-once dialog hit,
// where a reopened keyboard carried a stale armed Shift. Behavior is asserted
// through the casing of the next typed key and the public layout getter, not
// internal state.
const layout: LayoutDefinition = [
  [{ value: "q" }, { value: "{shift}", type: "modifier" }, { value: "{layout:numeric}", type: "modifier" }],
];

async function makeKeyboard(): Promise<{ kb: KioskKeyboard; input: Input }> {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()], instanceLayouts: { qwerty: layout }, layout: "qwerty" });
  await placeAndWait(kb);
  input.focus();
  (input.getFocusDomRef() as HTMLInputElement).setSelectionRange(0, 0);
  return { kb, input };
}

function cleanup(kb: KioskKeyboard, input: Input): void {
  input.destroy();
  kb.destroy();
  const fixture = document.getElementById("qunit-fixture");
  if (fixture) fixture.innerHTML = "";
}

QUnit.module("KioskKeyboard - reset() restores a fresh input context (#199)", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("clears a one-shot armed Shift so the next key types lowercase", async (assert) => {
  const { kb, input } = await makeKeyboard();

  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Shift is armed before reset");

  kb.reset();
  await waitForRender();
  assert.notOk(isShiftActive(kb), "Shift is disarmed after reset");

  tapKey(kb, "q");
  assert.strictEqual(input.getValue(), "q", "the key after reset types lowercase");

  cleanup(kb, input);
});

QUnit.test("clears a latched Caps Lock", async (assert) => {
  const { kb, input } = await makeKeyboard();

  const clock = freezeDoubleClickWindow();
  try {
    tapKey(kb, "{shift}");
    tapKey(kb, "{shift}");
    await waitForRender();
    assert.ok(isCapsLock(kb), "Caps Lock is latched before reset");

    kb.reset();
    await waitForRender();
    assert.notOk(isCapsLock(kb), "Caps Lock is cleared after reset");
    assert.notOk(isShiftActive(kb), "Shift indicator is off after reset");
  } finally {
    clock.restore();
  }

  tapKey(kb, "q");
  assert.strictEqual(input.getValue(), "q", "the key after reset types lowercase");

  cleanup(kb, input);
});

QUnit.test("returns to the base layout after a secondary-layout switch", async (assert) => {
  const { kb, input } = await makeKeyboard();

  kb.setLayout("numeric");
  await waitForRender();
  assert.strictEqual(kb.getLayout(), "numeric", "switched to the secondary numeric layout");

  kb.reset();
  await waitForRender();
  assert.strictEqual(kb.getLayout(), "qwerty", "reset returns to the base layout");

  cleanup(kb, input);
});

QUnit.test("does not touch the already-typed target value", async (assert) => {
  const { kb, input } = await makeKeyboard();

  tapKey(kb, "q");
  tapKey(kb, "q");
  assert.strictEqual(input.getValue(), "qq", "text is typed into the target");

  kb.reset();
  await waitForRender();
  assert.strictEqual(input.getValue(), "qq", "reset leaves the bound target value untouched");

  cleanup(kb, input);
});

QUnit.test("is chainable (returns the control)", async (assert) => {
  const { kb, input } = await makeKeyboard();

  assert.strictEqual(kb.reset(), kb, "reset() returns the control for chaining");

  cleanup(kb, input);
});
