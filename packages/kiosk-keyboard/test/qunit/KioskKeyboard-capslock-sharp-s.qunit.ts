import CustomLayout from "ui5/kiosk/CustomLayout";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import { placeAndWait, waitForRender, tapKey, getRenderedKeyLabel } from "./test-helpers";
import type { LayoutDefinition } from "ui5/kiosk/types";

// #169: pressing the base ß key with CapsLock engaged emits the capital sharp S
// ẞ (U+1E9E) directly, not only via the accent-variant popup. One-shot Shift on
// the same key still yields its physical "?" symbol (the #162 invariant), and the
// key's cap tracks what it types.
//
// The layout mirrors qwertz-de's ß key: base "ß" with an explicit "?" shiftValue,
// which under CapsLock must be bypassed in favour of ẞ.
const layout: LayoutDefinition = [
  [
    { value: "ß", shiftValue: "?" },
    { value: "{shift}", type: "modifier" },
  ],
];

async function makeKeyboard(): Promise<{ kb: KioskKeyboard; input: Input }> {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({
    controls: [input.getId()],
    customLayouts: [new CustomLayout({ name: "qwerty", rows: layout })],
    layout: "qwerty",
  });
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

QUnit.module("KioskKeyboard - CapsLock emits ẞ from the base ß key (#169)", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("CapsLock + ß inserts ẞ and relabels the cap to ẞ", async (assert) => {
  const { kb, input } = await makeKeyboard();

  // Two rapid {shift} taps engage CapsLock (double-click within the window).
  tapKey(kb, "{shift}");
  tapKey(kb, "{shift}");
  await waitForRender();

  assert.strictEqual(getRenderedKeyLabel(kb, "ß"), "ẞ", "the cap shows ẞ under CapsLock");

  tapKey(kb, "ß");
  assert.strictEqual(input.getValue(), "ẞ", "CapsLock + ß inserts ẞ, not ? and not SS");

  cleanup(kb, input);
});

QUnit.test("Shift (one-shot) + ß still inserts ? (the #162 invariant)", async (assert) => {
  const { kb, input } = await makeKeyboard();

  tapKey(kb, "{shift}");
  tapKey(kb, "ß");

  assert.strictEqual(input.getValue(), "?", "one-shot Shift keeps the physical ? symbol");

  cleanup(kb, input);
});
