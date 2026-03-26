import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { LayoutDefinition } from "ui5/kiosk/types";
import {
  getKeyElement,
  getKeyElements,
  getRequiredKeyElement,
  hasKeyboardClass,
  hasKeyClass,
  placeAndWait,
  tapKey,
  waitForRender,
} from "./test-helpers";

const DOM = KioskKeyboard.DOM;

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

  const getShift = () => getKeyElement(kb, "{shift}")!;
  const getLive = () => document.getElementById(`${kb.getId()}-liveState`)!;

  // Initial state
  assert.strictEqual(getShift().getAttribute("aria-pressed"), "false", "Initially aria-pressed=false");
  assert.notOk(hasKeyClass(kb, "{shift}", DOM.classes.keyActive), "No active class initially");
  assert.notOk(hasKeyClass(kb, "{shift}", DOM.classes.keyCapsLock), "No capsLock class initially");
  assert.strictEqual(getLive().textContent, "", "Live region empty initially");

  // 1st tap → Shift on
  tapKey(kb, "{shift}");
  await waitForRender();

  assert.strictEqual(getShift().getAttribute("aria-pressed"), "true", "After 1st tap: aria-pressed=true");
  assert.ok(hasKeyClass(kb, "{shift}", DOM.classes.keyActive), "After 1st tap: active class present");
  assert.notOk(hasKeyClass(kb, "{shift}", DOM.classes.keyCapsLock), "After 1st tap: no capsLock class");
  assert.strictEqual(getLive().textContent, "Shift on", "After 1st tap: live region announces Shift on");

  // 2nd tap → Caps Lock on
  tapKey(kb, "{shift}");
  await waitForRender();

  assert.strictEqual(getShift().getAttribute("aria-pressed"), "true", "After 2nd tap: aria-pressed=true");
  assert.ok(hasKeyClass(kb, "{shift}", DOM.classes.keyActive), "After 2nd tap: active class present");
  assert.ok(hasKeyClass(kb, "{shift}", DOM.classes.keyCapsLock), "After 2nd tap: capsLock class present");
  assert.strictEqual(getLive().textContent, "Caps Lock on", "After 2nd tap: live region announces Caps Lock on");

  // 3rd tap → All off
  tapKey(kb, "{shift}");
  await waitForRender();

  assert.strictEqual(getShift().getAttribute("aria-pressed"), "false", "After 3rd tap: aria-pressed=false");
  assert.notOk(hasKeyClass(kb, "{shift}", DOM.classes.keyActive), "After 3rd tap: no active class");
  assert.notOk(hasKeyClass(kb, "{shift}", DOM.classes.keyCapsLock), "After 3rd tap: no capsLock class");
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

  const getKey = (v: string) => getKeyElement(kb, v)!;

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

  const keyValues = () => Array.from(getKeyElements(kb)).map((k) => k.dataset.key);

  // Full
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "Full: no numpad class");
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numeric")), "Full: no numeric class");
  assert.ok(keyValues().includes("q"), "Full: has alphabetic keys");

  // Switch to Numpad
  kb.setKeyboardType("Numpad");
  await waitForRender();

  assert.ok(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "Numpad: has numpad class");
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numeric")), "Numpad: no numeric class");
  const numpadKeys = keyValues();
  assert.notOk(numpadKeys.includes("q"), "Numpad: no alphabetic keys");
  assert.ok(numpadKeys.includes("7"), "Numpad: has '7'");

  // Switch to Numeric
  kb.setKeyboardType("Numeric");
  await waitForRender();

  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "Numeric: no numpad class");
  assert.ok(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numeric")), "Numeric: has numeric class");
  const numericKeys = keyValues();
  assert.notOk(numericKeys.includes("q"), "Numeric: no alphabetic keys");

  // Back to Full
  kb.setKeyboardType("Full");
  await waitForRender();

  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "Full again: no numpad class");
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numeric")), "Full again: no numeric class");
  assert.ok(keyValues().includes("q"), "Full again: has alphabetic keys");

  kb.destroy();
});

// ──────────────────────────────────────────────
// 4. Special key accessibility labels
// ──────────────────────────────────────────────

QUnit.test("Special keys render correct aria-labels", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const backspace = getKeyElement(kb, "{backspace}");
  assert.ok(backspace, "Backspace key rendered");
  assert.strictEqual(backspace!.getAttribute("aria-label"), "Backspace", "Backspace aria-label");

  const enter = getKeyElement(kb, "{enter}");
  assert.ok(enter, "Enter key rendered");
  assert.strictEqual(enter!.getAttribute("aria-label"), "Enter", "Enter aria-label");

  const shift = getKeyElement(kb, "{shift}");
  assert.ok(shift, "Shift key rendered");
  assert.strictEqual(shift!.getAttribute("aria-label"), "Shift", "Shift aria-label");

  const space = getKeyElement(kb, " ");
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

// ──────────────────────────────────────────────
// Icon + Label permutation matrix
// ──────────────────────────────────────────────

QUnit.test("icon omitted, label omitted: renders label from value", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "a" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "a");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon element");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.strictEqual(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent, "a", "Label text is 'a'");
  assert.notOk(keyEl.classList.contains(DOM.classes.keyDual), "No dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("icon omitted, label set: renders custom label only", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", label: "Custom" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon element");
  assert.strictEqual(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent, "Custom", "Custom label");
  assert.notOk(keyEl.classList.contains(DOM.classes.keyDual), "No dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("icon omitted, label empty: renders blank key", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", label: "" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon element");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "No label element");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("SAP icon set, label omitted: renders both (dual)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "sap-icon://home" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "Icon element present");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.strictEqual(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent, "x", "Label text is 'x'");
  assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("SAP icon + custom label: renders both (dual)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "sap-icon://home", label: "Go" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "Icon element present");
  assert.strictEqual(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent, "Go", "Custom label");
  assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("SAP icon set, label empty: renders icon only", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "sap-icon://home", label: "" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "Icon element present");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "No label element");
  assert.notOk(keyEl.classList.contains(DOM.classes.keyDual), "No dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("icon empty, label omitted: renders label only (icon suppressed)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon element");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.notOk(keyEl.classList.contains(DOM.classes.keyDual), "No dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("Unicode icon renders as text span with icon class", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "\u21E7", label: "Shift" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  const iconEl = keyEl.querySelector(`.${DOM.classes.keyIcon}`);
  assert.ok(iconEl, "Icon element present");
  assert.strictEqual(iconEl!.tagName.toLowerCase(), "span", "Icon is a span (not sap icon)");
  assert.strictEqual(iconEl!.textContent, "\u21E7", "Icon text is \u21E7");
  assert.strictEqual(iconEl!.getAttribute("aria-hidden"), "true", "Icon is aria-hidden");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("emoji icon renders as text span with icon class", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "\uD83D\uDD0D", label: "Search" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  const iconEl = keyEl.querySelector(`.${DOM.classes.keyIcon}`);
  assert.ok(iconEl, "Icon element present");
  assert.strictEqual(iconEl!.tagName.toLowerCase(), "span", "Icon is a span");
  assert.strictEqual(iconEl!.textContent, "\uD83D\uDD0D", "Icon text is emoji");
  assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("Shift key renders built-in icon + i18n label (dual)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "{shift}", type: "modifier", width: "2.25" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "Icon element present");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.ok(
    /shift/i.test(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent || ""),
    "Label contains 'Shift'",
  );
  assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("Space bar renders visible i18n label, no icon", async (assert) => {
  const layout: LayoutDefinition = [[{ value: " ", type: "space", width: "space" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, " ");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon element");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.ok(
    /space/i.test(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent || ""),
    "Label contains 'Space'",
  );

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("Shift with label='' renders icon only (opt-out)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "{shift}", type: "modifier", width: "2.25", label: "" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "Icon element present");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "No label element");
  assert.notOk(keyEl.classList.contains(DOM.classes.keyDual), "No dual class");
  assert.ok(keyEl.getAttribute("aria-label"), "aria-label present for icon-only key");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});
