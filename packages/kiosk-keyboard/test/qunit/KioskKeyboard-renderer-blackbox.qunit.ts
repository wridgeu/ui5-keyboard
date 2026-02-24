import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { LayoutDefinition } from "ui5/kiosk/types";
import { placeAndWait, waitForRender, tapKey, getKeyElements } from "./test-helpers";

QUnit.module("KioskKeyboard renderer black-box", {
  afterEach() {
    KioskKeyboard.resetCustomLayouts();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// 1. Shift cycle render contract
// ──────────────────────────────────────────────

QUnit.test("Shift cycle: off → shift → caps → off (DOM state)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const getShift = () => kb.getDomRef()!.querySelector('[data-key="{shift}"]')!;
  const getLive = () => document.getElementById(`${kb.getId()}-liveState`)!;

  // Initial state
  assert.strictEqual(getShift().getAttribute("aria-pressed"), "false", "Initially aria-pressed=false");
  assert.notOk(getShift().classList.contains("ui5KioskKey--active"), "No active class initially");
  assert.notOk(getShift().classList.contains("ui5KioskKey--capsLock"), "No capsLock class initially");
  assert.strictEqual(getLive().textContent, "", "Live region empty initially");

  // 1st tap → Shift on
  tapKey(kb, "{shift}");
  await waitForRender();

  assert.strictEqual(getShift().getAttribute("aria-pressed"), "true", "After 1st tap: aria-pressed=true");
  assert.ok(getShift().classList.contains("ui5KioskKey--active"), "After 1st tap: active class present");
  assert.notOk(getShift().classList.contains("ui5KioskKey--capsLock"), "After 1st tap: no capsLock class");
  assert.strictEqual(getLive().textContent, "Shift on", "After 1st tap: live region announces Shift on");

  // 2nd tap → Caps Lock on
  tapKey(kb, "{shift}");
  await waitForRender();

  assert.strictEqual(getShift().getAttribute("aria-pressed"), "true", "After 2nd tap: aria-pressed=true");
  assert.ok(getShift().classList.contains("ui5KioskKey--active"), "After 2nd tap: active class present");
  assert.ok(getShift().classList.contains("ui5KioskKey--capsLock"), "After 2nd tap: capsLock class present");
  assert.strictEqual(getLive().textContent, "Caps Lock on", "After 2nd tap: live region announces Caps Lock on");

  // 3rd tap → All off
  tapKey(kb, "{shift}");
  await waitForRender();

  assert.strictEqual(getShift().getAttribute("aria-pressed"), "false", "After 3rd tap: aria-pressed=false");
  assert.notOk(getShift().classList.contains("ui5KioskKey--active"), "After 3rd tap: no active class");
  assert.notOk(getShift().classList.contains("ui5KioskKey--capsLock"), "After 3rd tap: no capsLock class");
  assert.strictEqual(getLive().textContent, "", "After 3rd tap: live region cleared");

  kb.destroy();
});

// ──────────────────────────────────────────────
// 2. Shifted labels and aria-labels
// ──────────────────────────────────────────────

QUnit.test("Shifted labels and aria-labels update in DOM", async (assert) => {
  const layout: LayoutDefinition = [
    [
      { value: "1", shiftLabel: "!", shiftValue: "!" },
      { value: "a" },
      { value: "{shift}", label: "", type: "modifier", width: "1.5" },
    ],
  ];
  KioskKeyboard.registerLayout("bb-shift-test", layout);

  const kb = new KioskKeyboard({ layout: "bb-shift-test" });
  await placeAndWait(kb);

  const getKey = (v: string) => kb.getDomRef()!.querySelector(`[data-key="${v}"]`)!;

  // Unshifted state
  assert.strictEqual(getKey("1").textContent, "1", "Key '1' shows '1' unshifted");
  assert.strictEqual(getKey("1").getAttribute("aria-label"), "1", "Key '1' aria-label is '1'");
  assert.strictEqual(getKey("a").textContent, "a", "Key 'a' shows 'a' unshifted");
  assert.strictEqual(getKey("a").getAttribute("aria-label"), "a", "Key 'a' aria-label is 'a'");

  // Activate shift
  tapKey(kb, "{shift}");
  await waitForRender();

  assert.strictEqual(getKey("1").textContent, "!", "Key '1' shows '!' when shifted");
  assert.strictEqual(getKey("1").getAttribute("aria-label"), "!", "Key '1' aria-label is '!'");
  assert.strictEqual(getKey("a").textContent, "A", "Key 'a' shows 'A' when shifted");
  assert.strictEqual(getKey("a").getAttribute("aria-label"), "A", "Key 'a' aria-label is 'A'");

  // Typing a character auto-releases shift
  tapKey(kb, "a");
  await waitForRender();

  assert.strictEqual(getKey("1").textContent, "1", "Key '1' back to '1' after shift auto-release");
  assert.strictEqual(getKey("a").textContent, "a", "Key 'a' back to 'a' after shift auto-release");

  kb.destroy();
});

// ──────────────────────────────────────────────
// 3. Keyboard type render switching
// ──────────────────────────────────────────────

QUnit.test("Keyboard type switching: Full → Numpad → Numeric → Full", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = () => kb.getDomRef()!;
  const keyValues = () => Array.from(getKeyElements(kb)).map((k) => k.dataset.key);

  // Full
  assert.notOk(dom().classList.contains("ui5KioskKeyboard--numpad"), "Full: no numpad class");
  assert.notOk(dom().classList.contains("ui5KioskKeyboard--numeric"), "Full: no numeric class");
  assert.ok(keyValues().includes("q"), "Full: has alphabetic keys");

  // Switch to Numpad
  kb.setKeyboardType("Numpad");
  await waitForRender();

  assert.ok(dom().classList.contains("ui5KioskKeyboard--numpad"), "Numpad: has numpad class");
  assert.notOk(dom().classList.contains("ui5KioskKeyboard--numeric"), "Numpad: no numeric class");
  const numpadKeys = keyValues();
  assert.notOk(numpadKeys.includes("q"), "Numpad: no alphabetic keys");
  assert.ok(numpadKeys.includes("7"), "Numpad: has '7'");

  // Switch to Numeric
  kb.setKeyboardType("Numeric");
  await waitForRender();

  assert.notOk(dom().classList.contains("ui5KioskKeyboard--numpad"), "Numeric: no numpad class");
  assert.ok(dom().classList.contains("ui5KioskKeyboard--numeric"), "Numeric: has numeric class");
  const numericKeys = keyValues();
  assert.notOk(numericKeys.includes("q"), "Numeric: no alphabetic keys");

  // Back to Full
  kb.setKeyboardType("Full");
  await waitForRender();

  assert.notOk(dom().classList.contains("ui5KioskKeyboard--numpad"), "Full again: no numpad class");
  assert.notOk(dom().classList.contains("ui5KioskKeyboard--numeric"), "Full again: no numeric class");
  assert.ok(keyValues().includes("q"), "Full again: has alphabetic keys");

  kb.destroy();
});

// ──────────────────────────────────────────────
// 4. Special key accessibility labels
// ──────────────────────────────────────────────

QUnit.test("Special keys render correct aria-labels", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;

  const backspace = dom.querySelector('[data-key="{backspace}"]');
  assert.ok(backspace, "Backspace key rendered");
  assert.strictEqual(backspace!.getAttribute("aria-label"), "Backspace", "Backspace aria-label");

  const enter = dom.querySelector('[data-key="{enter}"]');
  assert.ok(enter, "Enter key rendered");
  assert.strictEqual(enter!.getAttribute("aria-label"), "Enter", "Enter aria-label");

  const shift = dom.querySelector('[data-key="{shift}"]');
  assert.ok(shift, "Shift key rendered");
  assert.strictEqual(shift!.getAttribute("aria-label"), "Shift", "Shift aria-label");

  const space = dom.querySelector('[data-key=" "]');
  assert.ok(space, "Space key rendered");
  assert.strictEqual(space!.getAttribute("aria-label"), "Space", "Space aria-label");

  kb.destroy();
});

// ──────────────────────────────────────────────
// 5. Layout switch rendering
// ──────────────────────────────────────────────

QUnit.test("Layout switch via {layout:numeric} changes rendered key matrix", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // QWERTY initially
  const qwertyKeys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(qwertyKeys.includes("q"), "QWERTY layout has 'q'");
  assert.ok(qwertyKeys.includes("{layout:numeric}"), "QWERTY layout has layout:numeric switch key");

  // Switch to numeric layout
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  const numericKeys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.notOk(numericKeys.includes("q"), "Numeric layout does not have 'q'");
  assert.notOk(numericKeys.includes("a"), "Numeric layout does not have 'a'");

  kb.destroy();
});
