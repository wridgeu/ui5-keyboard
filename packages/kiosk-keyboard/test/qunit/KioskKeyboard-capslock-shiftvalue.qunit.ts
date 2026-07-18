import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import { placeAndWait, waitForRender, tapKey, getRenderedKeyLabel } from "./test-helpers";
import type { LayoutDefinition } from "ui5/kiosk/types";

// #176: CapsLock is an uppercase mode, not a Shift alias. A key whose shiftValue
// is uncased (the arabic layout's Arabic-Indic digit row, an ASCII symbol row)
// keeps its base under CapsLock; a key whose shiftValue is a cased letter (the
// qwerty-es accent keys) has that letter uppercased. One-shot Shift still types
// the shiftValue verbatim in both cases (the #162 invariant), and each key's cap
// tracks what it types.
const layout: LayoutDefinition = [
  [
    { value: "1", shiftValue: "١" },
    { value: "e", shiftValue: "é" },
    { value: "{shift}", type: "modifier" },
  ],
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

/** Engages CapsLock via two rapid {shift} taps (double-tap within the window). */
async function engageCapsLock(kb: KioskKeyboard): Promise<void> {
  tapKey(kb, "{shift}");
  tapKey(kb, "{shift}");
  await waitForRender();
}

QUnit.module("KioskKeyboard - CapsLock is uppercase-mode, not a Shift alias (#176)", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("CapsLock + a digit key keeps the digit, cap and emit agreeing", async (assert) => {
  const { kb, input } = await makeKeyboard();

  await engageCapsLock(kb);

  assert.strictEqual(getRenderedKeyLabel(kb, "1"), "1", "the cap keeps the digit under CapsLock");

  tapKey(kb, "1");
  assert.strictEqual(input.getValue(), "1", "CapsLock + 1 inserts 1, not the Arabic-Indic ١");

  cleanup(kb, input);
});

QUnit.test("CapsLock + an accented-letter shiftValue uppercases it", async (assert) => {
  const { kb, input } = await makeKeyboard();

  await engageCapsLock(kb);

  assert.strictEqual(getRenderedKeyLabel(kb, "e"), "É", "the cap shows the uppercased accent");

  tapKey(kb, "e");
  assert.strictEqual(input.getValue(), "É", "CapsLock + e inserts É, keeping accent access");

  cleanup(kb, input);
});

QUnit.test("Shift (one-shot) + a digit key still inserts its shiftValue (the #162 invariant)", async (assert) => {
  const { kb, input } = await makeKeyboard();

  tapKey(kb, "{shift}");
  tapKey(kb, "1");

  assert.strictEqual(input.getValue(), "١", "one-shot Shift keeps the Arabic-Indic digit");

  cleanup(kb, input);
});
