import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import { placeAndWait, tapKey } from "./test-helpers";

QUnit.module("KioskKeyboard input black-box", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// 1. Default typing into targetInput
// ──────────────────────────────────────────────

QUnit.test("Typing characters into target sap.m.Input", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  tapKey(kb, "h");
  tapKey(kb, "e");
  tapKey(kb, "l");
  tapKey(kb, "l");
  tapKey(kb, "o");

  assert.strictEqual(input.getValue(), "hello", "Input value contains typed characters");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// 2. Backspace and space behavior
// ──────────────────────────────────────────────

QUnit.test("Backspace removes last character", async (assert) => {
  const input = new Input({ value: "abc" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  tapKey(kb, "{backspace}");
  assert.strictEqual(input.getValue(), "ab", "One character removed by backspace");

  tapKey(kb, "{backspace}");
  assert.strictEqual(input.getValue(), "a", "Second backspace removes another character");

  input.destroy();
  kb.destroy();
});

QUnit.test("Space key inserts a space character", async (assert) => {
  const input = new Input({ value: "hi" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  tapKey(kb, " ");
  assert.strictEqual(input.getValue(), "hi ", "Space character appended");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// 3. keyPress preventDefault contract
// ──────────────────────────────────────────────

QUnit.test("keyPress preventDefault stops input insertion", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  kb.attachEvent("keyPress", (event: { preventDefault(): void }) => {
    event.preventDefault();
  });

  tapKey(kb, "x");
  assert.strictEqual(input.getValue(), "", "Value unchanged after preventDefault");

  tapKey(kb, "y");
  assert.strictEqual(input.getValue(), "", "Still unchanged for second key");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// 4. keyPress event payload contract
// ──────────────────────────────────────────────

QUnit.test("keyPress payload for unshifted key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const done = assert.async();
  kb.attachEvent("keyPress", (event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("key"), "a", "key is 'a'");
    assert.strictEqual(event.getParameter("shiftKey"), false, "shiftKey is false");
    done();
  });

  tapKey(kb, "a");
  kb.destroy();
});

QUnit.test("keyPress payload for shifted key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");

  const done = assert.async();
  kb.attachEvent("keyPress", (event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("key"), "A", "key is 'A' when shifted");
    assert.strictEqual(event.getParameter("shiftKey"), true, "shiftKey is true");
    done();
  });

  tapKey(kb, "a");
  kb.destroy();
});

// ──────────────────────────────────────────────
// 5. No-target safety
// ──────────────────────────────────────────────

QUnit.test("Key tap without target input does not throw", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  let eventFired = false;
  kb.attachEvent("keyPress", () => {
    eventFired = true;
  });

  tapKey(kb, "a");
  assert.ok(eventFired, "keyPress event still fires without target input");

  // Additional taps should also be safe
  tapKey(kb, "{backspace}");
  tapKey(kb, " ");
  tapKey(kb, "{enter}");
  assert.ok(true, "No errors thrown for any key type without target input");

  kb.destroy();
});
