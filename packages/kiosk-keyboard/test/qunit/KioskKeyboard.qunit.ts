import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Control from "sap/ui/core/Control";
import Input from "sap/m/Input";
import StepInput from "sap/m/StepInput";
import TextArea from "sap/m/TextArea";
import Popover from "sap/m/Popover";
import VBox from "sap/m/VBox";
import XMLView from "sap/ui/core/mvc/XMLView";
import Localization from "sap/base/i18n/Localization";
import InvisibleText from "sap/ui/core/InvisibleText";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import { placeAndWait, waitForRender, tapKey, simulateTap, tapShiftInternally, getKeyElements } from "./test-helpers";

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

QUnit.module("KioskKeyboard", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// Properties
// ──────────────────────────────────────────────

QUnit.test("Default property values", (assert) => {
  const kb = new KioskKeyboard();

  assert.strictEqual(kb.getLayout(), "qwerty", "Default layout is qwerty");
  assert.strictEqual(kb.getKeyboardType(), "Full", "Default keyboardType is Full");
  assert.strictEqual(kb.getEnabled(), true, "Default enabled is true");
  assert.strictEqual(kb.getAriaLabel(), "", "Default ariaLabel is empty (resolved from i18n at render)");
  assert.strictEqual(kb.getDocked(), false, "Default docked is false");
  assert.strictEqual(kb.getStableHeight(), false, "Default stableHeight is false");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Rendering
// ──────────────────────────────────────────────

QUnit.test("Renders with default properties", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef();
  assert.ok(dom, "Control is rendered");
  assert.ok(dom!.classList.contains("ui5KioskKeyboard"), "Has root CSS class");
  assert.strictEqual(dom!.getAttribute("role"), "group", "Root has role=group");
  assert.strictEqual(dom!.getAttribute("aria-label"), "Virtual Keyboard", "Default aria-label");
  assert.strictEqual(dom!.getAttribute("aria-roledescription"), "keyboard", "Root has aria-roledescription");
  assert.strictEqual(dom!.getAttribute("data-sap-ui-fastnavgroup"), "true", "F6 group enabled");

  const keys = getKeyElements(kb);
  assert.ok(keys.length > 0, "Keys are rendered");

  // First key should have tabindex=0 (roving tabindex)
  assert.strictEqual(keys[0].getAttribute("tabindex"), "0", "First key has tabindex=0");
  // Second key should have tabindex=-1
  assert.strictEqual(keys[1].getAttribute("tabindex"), "-1", "Other keys have tabindex=-1");

  kb.destroy();
});

QUnit.test("Renders rows matching QWERTY layout", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const rows = kb.getDomRef()!.querySelectorAll(".ui5KioskRow");
  assert.strictEqual(rows.length, 5, "QWERTY layout has 5 rows");

  kb.destroy();
});

QUnit.test("Renders custom ariaLabel", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setAriaLabel("Custom Label");
  await placeAndWait(kb);

  assert.strictEqual(kb.getDomRef()!.getAttribute("aria-label"), "Custom Label", "Custom aria-label rendered");

  kb.destroy();
});

QUnit.test("Disabled state renders correctly", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setEnabled(false);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  assert.ok(dom.classList.contains("ui5KioskKeyboard--disabled"), "Has disabled CSS class");
  assert.strictEqual(dom.getAttribute("aria-disabled"), "true", "Root has aria-disabled");

  const firstKey = dom.querySelector(".ui5KioskKey");
  assert.strictEqual(firstKey!.getAttribute("aria-disabled"), "true", "Keys have aria-disabled");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Layout resolution
// ──────────────────────────────────────────────

QUnit.test("getResolvedLayout returns QWERTY by default", (assert) => {
  const kb = new KioskKeyboard();
  const layout = kb.getResolvedLayout();
  assert.strictEqual(layout.length, 5, "QWERTY has 5 rows");
  assert.strictEqual(layout[0][0].value, "1", "First key in number row is 1");
  kb.destroy();
});

QUnit.test("KeyboardType 'Numpad' overrides layout", (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType("Numpad");
  const layout = kb.getResolvedLayout();
  assert.ok(layout.length <= 5, "Numpad has reasonable row count");
  assert.strictEqual(layout[0][0].value, "7", "Numpad starts with 7");
  kb.destroy();
});

QUnit.test("KeyboardType 'Numpad' renders numpad layout", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType("Numpad");
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  assert.ok(dom.classList.contains("ui5KioskKeyboard--numpad"), "Has numpad CSS class");

  const keys = getKeyElements(kb);
  assert.ok(keys.length > 0, "Numpad keys rendered");

  const keyValues = Array.from(keys).map((k) => k.dataset.key);
  assert.notOk(keyValues.includes("q"), "No alphabetic keys in numpad");
  assert.ok(keyValues.includes("7"), "Numpad has 7");
  assert.ok(keyValues.includes("0"), "Numpad has 0");

  kb.destroy();
});

QUnit.test("Layout property switches full keyboard layout", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("numeric");
  await placeAndWait(kb);

  const layout = kb.getResolvedLayout();
  assert.strictEqual(layout[0][0].value, "1", "Numeric layout starts with 1");
  const allValues = layout.flat().map((k) => k.value);
  assert.notOk(allValues.includes("q"), "Numeric layout has no alphabetic keys");

  kb.destroy();
});

QUnit.test("KeyboardType 'Numeric' has numeric CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType("Numeric");
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  assert.ok(dom.classList.contains("ui5KioskKeyboard--numeric"), "Has numeric CSS class");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--numpad"), "No numpad class");

  kb.destroy();
});

QUnit.test("Full keyboardType has no type-specific CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--numpad"), "No numpad class on Full");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--numeric"), "No numeric class on Full");

  kb.destroy();
});

QUnit.test("setLayout with unregistered name is ignored and keeps current layout", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const before = kb.getLayout();
  kb.setLayout("nonexistent-layout");

  assert.strictEqual(kb.getLayout(), before, "getLayout() still returns the previous layout");
  const resolved = kb.getResolvedLayout();
  assert.strictEqual(resolved[0][0].value, "1", "QWERTY layout still rendered (number row starts with 1)");
  assert.strictEqual(resolved.length, 5, "QWERTY layout has 5 rows");

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("q"), "QWERTY keys rendered — unregistered name had no effect");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Key labels and shift
// ──────────────────────────────────────────────

QUnit.test("getKeyLabel returns value by default", (assert) => {
  const kb = new KioskKeyboard();
  assert.strictEqual(kb.getKeyLabel({ value: "a" }), "a", "Simple key shows value");
  assert.strictEqual(kb.getKeyLabel({ value: "1", label: "!" }), "!", "Key with label shows label");
  kb.destroy();
});

QUnit.test("getKeyLabel returns uppercase when shift active", (assert) => {
  const kb = new KioskKeyboard();

  tapShiftInternally(kb);

  assert.strictEqual(kb.getKeyLabel({ value: "a" }), "A", "Shifted single char is uppercase");
  assert.strictEqual(
    kb.getKeyLabel({ value: "1", shiftLabel: "!" }),
    "!",
    "Shifted key with shiftLabel uses shiftLabel",
  );

  kb.destroy();
});

// ──────────────────────────────────────────────
// Shift / Caps Lock toggle
// ──────────────────────────────────────────────

QUnit.test("Shift toggles: off -> shift -> caps -> off", (assert) => {
  const kb = new KioskKeyboard();

  assert.notOk(kb.isShiftActive(), "Initially not shifted");
  assert.notOk(kb.isCapsLock(), "Initially no caps lock");

  tapShiftInternally(kb);
  assert.ok(kb.isShiftActive(), "After first tap: shift active");
  assert.notOk(kb.isCapsLock(), "After first tap: not caps lock");

  tapShiftInternally(kb);
  assert.ok(kb.isShiftActive(), "After second tap: still active (caps)");
  assert.ok(kb.isCapsLock(), "After second tap: caps lock on");

  tapShiftInternally(kb);
  assert.notOk(kb.isShiftActive(), "After third tap: shift off");
  assert.notOk(kb.isCapsLock(), "After third tap: caps lock off");

  kb.destroy();
});

QUnit.test("Shift auto-releases after character key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  assert.ok(kb.isShiftActive(), "Shift is active");

  tapKey(kb, "q");
  assert.notOk(kb.isShiftActive(), "Shift auto-released after character");

  kb.destroy();
});

QUnit.test("Caps Lock does NOT auto-release after character key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Double-tap shift for caps lock
  tapKey(kb, "{shift}");
  tapKey(kb, "{shift}");
  assert.ok(kb.isCapsLock(), "Caps lock is on");

  tapKey(kb, "q");
  assert.ok(kb.isShiftActive(), "Still shifted after character");
  assert.ok(kb.isCapsLock(), "Caps lock still on");

  kb.destroy();
});

QUnit.test("Shift key renders active class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const shiftKey = kb.getDomRef()!.querySelector('[data-key="{shift}"]');
  assert.ok(shiftKey, "Shift key exists");
  assert.notOk(shiftKey!.classList.contains("ui5KioskKey--active"), "Shift not active initially");

  tapKey(kb, "{shift}");

  // Wait for re-render
  await waitForRender();

  const updatedShiftKey = kb.getDomRef()!.querySelector('[data-key="{shift}"]');
  assert.ok(updatedShiftKey!.classList.contains("ui5KioskKey--active"), "Shift key has active class");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Key press event
// ──────────────────────────────────────────────

QUnit.test("keyPress event fires on character key tap", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const done = assert.async();
  kb.attachEvent("keyPress", (event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("key"), "q", "Key is 'q'");
    assert.strictEqual(event.getParameter("shiftKey"), false, "shiftKey is false");
    done();
  });

  tapKey(kb, "q");
  kb.destroy();
});

QUnit.test("keyPress event fires shifted value", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");

  const done = assert.async();
  kb.attachEvent("keyPress", (event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("key"), "Q", "Shifted key is 'Q'");
    assert.strictEqual(event.getParameter("shiftKey"), true, "shiftKey is true");
    done();
  });

  tapKey(kb, "q");
  kb.destroy();
});

QUnit.test("keyPress event fires shift value for number keys", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");

  const done = assert.async();
  kb.attachEvent("keyPress", (event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("key"), "!", "Shift+1 produces !");
    done();
  });

  tapKey(kb, "1");
  kb.destroy();
});

QUnit.test("keyPress event fires for Backspace", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const done = assert.async();
  kb.attachEvent("keyPress", (event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("key"), "Backspace", "Key is Backspace");
    done();
  });

  tapKey(kb, "{backspace}");
  kb.destroy();
});

QUnit.test("keyPress event fires for Enter", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const done = assert.async();
  kb.attachEvent("keyPress", (event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("key"), "Enter", "Key is Enter");
    done();
  });

  tapKey(kb, "{enter}");
  kb.destroy();
});

QUnit.test("keyPress preventDefault skips input insertion", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  kb.attachEvent("keyPress", (event: { preventDefault(): void }) => {
    event.preventDefault();
  });

  tapKey(kb, "q");
  assert.strictEqual(input.getValue(), "", "Value unchanged after preventDefault");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Target input integration
// ──────────────────────────────────────────────

QUnit.test("Typing into target sap.m.Input", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  tapKey(kb, "h");
  tapKey(kb, "i");

  assert.strictEqual(input.getValue(), "hi", "Input value updated");

  input.destroy();
  kb.destroy();
});

QUnit.test("Backspace deletes last character from target input", async (assert) => {
  const input = new Input({ value: "abc" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  tapKey(kb, "{backspace}");

  assert.strictEqual(input.getValue(), "ab", "Last character deleted");

  input.destroy();
  kb.destroy();
});

QUnit.test("Enter inserts newline in TextArea", async (assert) => {
  const textarea = new TextArea({ value: "line1" });
  textarea.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(textarea);
  await placeAndWait(kb);

  tapKey(kb, "{enter}");
  tapKey(kb, "x");

  assert.strictEqual(textarea.getValue(), "line1\nx", "Newline inserted in TextArea");

  textarea.destroy();
  kb.destroy();
});

QUnit.test("Enter does nothing for single-line Input", async (assert) => {
  const input = new Input({ value: "abc" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  tapKey(kb, "{enter}");

  assert.strictEqual(input.getValue(), "abc", "Input value unchanged after Enter");

  input.destroy();
  kb.destroy();
});

QUnit.test("fireLiveChange is called on target", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const done = assert.async();
  input.attachLiveChange((event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("value"), "x", "liveChange fired with correct value");
    done();
  });

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  tapKey(kb, "x");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Layout switching
// ──────────────────────────────────────────────

QUnit.test("Layout switch fires layoutChange event", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const done = assert.async();
  kb.attachEvent("layoutChange", (event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("layout"), "numeric", "Layout changed to numeric");
    done();
  });

  tapKey(kb, "{layout:numeric}");
  kb.destroy();
});

QUnit.test("Layout switch updates rendered keys", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Initially QWERTY — has alphabetic keys
  let keys = getKeyElements(kb);
  const initialKeyValues = Array.from(keys).map((k) => k.dataset.key);
  assert.ok(initialKeyValues.includes("q"), "QWERTY has 'q' key");

  // Switch to numeric
  tapKey(kb, "{layout:numeric}");

  // Wait for re-render
  await waitForRender();

  keys = getKeyElements(kb);
  const numericKeyValues = Array.from(keys).map((k) => k.dataset.key);
  assert.notOk(numericKeyValues.includes("q"), "Numeric layout has no 'q' key");

  kb.destroy();
});

QUnit.test("Layout switch ignored when keyboardType is Numpad", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType("Numpad");
  await placeAndWait(kb);

  let layoutChanged = false;
  kb.attachEvent("layoutChange", () => {
    layoutChanged = true;
  });

  // Create a fake layout switch key and tap it
  const fakeEl = document.createElement("div");
  fakeEl.classList.add("ui5KioskKey");
  fakeEl.dataset.key = "{layout:numeric}";
  fakeEl.id = "fake-layout";

  simulateTap(kb, fakeEl);

  assert.notOk(layoutChanged, "Layout switch ignored in Numpad mode");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Enabled / disabled
// ──────────────────────────────────────────────

QUnit.test("Disabled keyboard ignores tap events", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setEnabled(false);
  await placeAndWait(kb);

  let keyPressed = false;
  kb.attachEvent("keyPress", () => {
    keyPressed = true;
  });

  const fakeEl = document.createElement("div");
  fakeEl.classList.add("ui5KioskKey");
  fakeEl.dataset.key = "a";
  fakeEl.id = "fake-key";

  simulateTap(kb, fakeEl);

  assert.notOk(keyPressed, "No keyPress event when disabled");

  kb.destroy();
});

QUnit.test("Disabled keyboard ignores keyboard events", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setEnabled(false);
  await placeAndWait(kb);

  let keyPressed = false;
  kb.attachEvent("keyPress", () => {
    keyPressed = true;
  });

  const fakeTarget = document.createElement("div");
  fakeTarget.classList.add("ui5KioskKey");
  fakeTarget.dataset.key = "a";

  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
  Object.defineProperty(event, "target", { value: fakeTarget, writable: false });
  kb.onkeydown(event);

  assert.notOk(keyPressed, "No keyPress event from keyboard when disabled");

  kb.destroy();
});

// ──────────────────────────────────────────────
// setTargetInput (suppressInvalidate)
// ──────────────────────────────────────────────

QUnit.test("setTargetInput does not trigger re-render", async (assert) => {
  // Place both controls first, then wait for render to settle
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.placeAt("qunit-fixture");
  await waitForRender();

  const domBefore = kb.getDomRef();
  assert.ok(domBefore, "Keyboard is rendered before setTargetInput");

  kb.setTargetInput(input);

  // Wait a tick to let any potential async re-render occur
  await nextUIUpdate();

  // Should still be the same DOM ref (no re-render from suppressInvalidate)
  assert.strictEqual(kb.getDomRef(), domBefore, "DOM ref unchanged after setTargetInput");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Accessibility: key roles and ARIA
// ──────────────────────────────────────────────

QUnit.test("Each key has role=button and aria-label", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const keys = getKeyElements(kb);
  keys.forEach((key) => {
    assert.strictEqual(key.getAttribute("role"), "button", `Key ${key.dataset.key} has role=button`);
    const label = key.getAttribute("aria-label");
    assert.ok(label && label.length > 0, `Key ${key.dataset.key} has aria-label`);
  });

  kb.destroy();
});

QUnit.test("Shift key has aria-pressed", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const shiftKey = kb.getDomRef()!.querySelector('[data-key="{shift}"]');
  assert.ok(shiftKey, "Shift key exists");
  assert.strictEqual(shiftKey!.getAttribute("aria-pressed"), "false", "Initially aria-pressed=false");

  tapKey(kb, "{shift}");
  await waitForRender();

  const updatedShift = kb.getDomRef()!.querySelector('[data-key="{shift}"]');
  assert.strictEqual(updatedShift!.getAttribute("aria-pressed"), "true", "After shift: aria-pressed=true");

  kb.destroy();
});

QUnit.test("getAccessibilityInfo returns correct data", (assert) => {
  const kb = new KioskKeyboard();
  const info = kb.getAccessibilityInfo();

  assert.strictEqual(info.role, "group", "Role is group");
  assert.strictEqual(info.type, "Virtual Keyboard", "Type is Virtual Keyboard (from i18n)");
  assert.strictEqual(info.description, "Virtual Keyboard", "Description resolves from i18n when ariaLabel is empty");
  assert.strictEqual(info.focusable, true, "Is focusable");
  assert.strictEqual(info.enabled, true, "Is enabled");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Modifier / Action / Width styling
// ──────────────────────────────────────────────

QUnit.test("Modifier keys have modifier CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const shiftKey = kb.getDomRef()!.querySelector('[data-key="{shift}"]');
  assert.ok(shiftKey, "Shift key found");
  assert.ok(shiftKey!.classList.contains("ui5KioskKey--modifier"), "Shift has modifier class");

  const layoutKey = kb.getDomRef()!.querySelector('[data-key="{layout:numeric}"]');
  assert.ok(layoutKey, "Layout switch key found");
  assert.ok(layoutKey!.classList.contains("ui5KioskKey--modifier"), "Layout switch has modifier class");

  kb.destroy();
});

QUnit.test("Action keys have action CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const enterKey = kb.getDomRef()!.querySelector('[data-key="{enter}"]');
  assert.ok(enterKey, "Enter key found");
  assert.ok(enterKey!.classList.contains("ui5KioskKey--action"), "Enter has action class");

  const backspaceKey = kb.getDomRef()!.querySelector('[data-key="{backspace}"]');
  assert.ok(backspaceKey, "Backspace key found");
  assert.ok(backspaceKey!.classList.contains("ui5KioskKey--action"), "Backspace has action class");

  kb.destroy();
});

QUnit.test("Space key has space CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const spaceKey = kb.getDomRef()!.querySelector('[data-key=" "]');
  assert.ok(spaceKey, "Space key found");
  assert.ok(spaceKey!.classList.contains("ui5KioskKey--space"), "Space has space width class");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Docked mode
// ──────────────────────────────────────────────

QUnit.test("Docked keyboard starts closed", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  assert.ok(dom.classList.contains("ui5KioskKeyboard--docked"), "Has docked CSS class");
  assert.ok(dom.classList.contains("ui5KioskKeyboard--closed"), "Has closed CSS class");
  assert.notOk(kb.isOpen(), "isOpen() returns false");

  kb.destroy();
});

QUnit.test("show() opens docked keyboard", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  kb.show();

  assert.ok(kb.isOpen(), "isOpen() returns true");
  assert.notOk(kb.getDomRef()!.classList.contains("ui5KioskKeyboard--closed"), "Closed class removed");

  kb.destroy();
});

QUnit.test("close() closes docked keyboard", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  kb.show();
  assert.ok(kb.isOpen(), "Keyboard is open");

  kb.close();
  assert.notOk(kb.isOpen(), "isOpen() returns false after close");
  assert.ok(kb.getDomRef()!.classList.contains("ui5KioskKeyboard--closed"), "Closed class added");

  kb.destroy();
});

QUnit.test("setDocked(false) closes an open keyboard and restores inputmode", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    mobileKeyboard: "Custom",
  });
  kb.setTargetInput(input);
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  kb.show();
  assert.strictEqual(inputDom.getAttribute("inputmode"), "none", "inputmode suppressed while open");

  let afterCloseCount = 0;
  kb.attachEvent("afterClose", () => afterCloseCount++);

  kb.setDocked(false);

  assert.notOk(kb.isOpen(), "Keyboard is closed when docked is turned off");
  assert.strictEqual(afterCloseCount, 1, "afterClose fired once during docked->undocked transition");
  assert.notStrictEqual(inputDom.getAttribute("inputmode"), "none", "inputmode restored after transition");

  input.destroy();
  kb.destroy();
});

QUnit.test("show() fires afterOpen event", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  let fired = false;
  kb.attachEvent("afterOpen", () => (fired = true));

  kb.show();
  assert.ok(fired, "afterOpen fired");

  kb.destroy();
});

QUnit.test("close() fires afterClose event", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  kb.show();

  let fired = false;
  kb.attachEvent("afterClose", () => (fired = true));

  kb.close();
  assert.ok(fired, "afterClose fired");

  kb.destroy();
});

QUnit.test("show() is idempotent", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  let openCount = 0;
  kb.attachEvent("afterOpen", () => openCount++);

  kb.show();
  kb.show();
  kb.show();

  assert.strictEqual(openCount, 1, "afterOpen fired only once");

  kb.destroy();
});

QUnit.test("close() is idempotent", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  let closeCount = 0;
  kb.attachEvent("afterClose", () => closeCount++);

  // Already closed by default, so close again should be no-op
  kb.close();
  kb.close();

  assert.strictEqual(closeCount, 0, "afterClose not fired when already closed");

  kb.destroy();
});

QUnit.test("Non-docked keyboard has no docked CSS classes", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--docked"), "No docked class");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--closed"), "No closed class");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Escape key closes docked keyboard
// ──────────────────────────────────────────────

QUnit.test("Escape closes docked keyboard when virtual key has focus", async (assert) => {
  const input = new Input("escape-test-input");
  const kb = new KioskKeyboard({ docked: true, targetInput: input.getId() });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  kb.show();
  assert.ok(kb.isOpen(), "Keyboard is open");

  // Focus a virtual key and dispatch Escape on it
  const firstKey = kb.getDomRef()!.querySelector<HTMLElement>(".ui5KioskKey")!;
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  assert.notOk(kb.isOpen(), "Keyboard closed after Escape");

  input.destroy();
  kb.destroy();
});

QUnit.test("Escape closes docked keyboard when target input has focus", async (assert) => {
  const input = new Input("escape-input-focus");
  const kb = new KioskKeyboard({ docked: true, targetInput: input.getId() });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  kb.show();
  assert.ok(kb.isOpen(), "Keyboard is open");

  // Focus the target input and dispatch Escape on it
  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();

  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  assert.notOk(kb.isOpen(), "Keyboard closed after Escape on input");

  input.destroy();
  kb.destroy();
});

QUnit.test("Escape on docked keyboard returns focus to target input", async (assert) => {
  const input = new Input("escape-focus-input");
  const kb = new KioskKeyboard({ docked: true, targetInput: input.getId() });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  kb.show();

  const firstKey = kb.getDomRef()!.querySelector<HTMLElement>(".ui5KioskKey")!;
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  const focusDom = input.getFocusDomRef() as HTMLElement;
  assert.strictEqual(document.activeElement, focusDom, "Focus returned to target input");

  input.destroy();
  kb.destroy();
});

QUnit.test("Escape fires afterClose event", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  kb.show();

  let fired = false;
  kb.attachEvent("afterClose", () => (fired = true));

  const firstKey = kb.getDomRef()!.querySelector<HTMLElement>(".ui5KioskKey")!;
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  assert.ok(fired, "afterClose event fired");

  kb.destroy();
});

QUnit.test("Escape does nothing when keyboard is not docked", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const firstKey = kb.getDomRef()!.querySelector<HTMLElement>(".ui5KioskKey")!;
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  // Non-docked keyboard — Escape listener is never attached (only show()/close() manage it)
  firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  assert.strictEqual(document.activeElement, firstKey, "Focus unchanged — Escape not intercepted");

  kb.destroy();
});

QUnit.test("Escape does nothing when docked keyboard is already closed", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  // Keyboard is docked but closed (default state) — Escape listener not attached
  assert.notOk(kb.isOpen(), "Keyboard starts closed");

  const firstKey = kb.getDomRef()!.querySelector<HTMLElement>(".ui5KioskKey")!;
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  let closeFired = false;
  kb.attachEvent("afterClose", () => (closeFired = true));

  firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  assert.notOk(closeFired, "afterClose not fired — keyboard was already closed");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Auto-show
// ──────────────────────────────────────────────

QUnit.test("setAutoShow is idempotent", (assert) => {
  const kb = new KioskKeyboard();

  // Should not throw
  kb.setAutoShow(true);
  kb.setAutoShow(true);

  kb.setAutoShow(false);
  kb.setAutoShow(false);

  assert.ok(true, "Multiple setAutoShow calls don't throw");

  kb.destroy();
});

QUnit.test("exit() cleans up auto-show listeners", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  kb.setAutoShow(true);
  kb.destroy();

  // If cleanup failed, the listener would throw on next focus event.
  // Dispatch a focus event on an input to verify no errors.
  const input = document.createElement("input");
  document.body.appendChild(input);
  input.focus();
  input.blur();
  document.body.removeChild(input);

  assert.ok(true, "No errors after destroy with auto-show enabled");
});

// ──────────────────────────────────────────────
// liveChange event parameters
// ──────────────────────────────────────────────

QUnit.test("fireLiveChange receives value parameter", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const done = assert.async();
  input.attachLiveChange((event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("value"), "a", "value parameter is correct");
    done();
  });

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  tapKey(kb, "a");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Enter fires change on single-line Input
// ──────────────────────────────────────────────

QUnit.test("Enter key fires change event on target sap.m.Input", async (assert) => {
  const input = new Input({ value: "hello" });
  input.placeAt("qunit-fixture");

  const done = assert.async();
  input.attachChange((event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("value"), "hello", "change fired with correct value");
    done();
  });

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  tapKey(kb, "{enter}");

  input.destroy();
  kb.destroy();
});

QUnit.test("Enter key does not fire change on TextArea (inserts newline instead)", async (assert) => {
  const textarea = new TextArea({ value: "line1" });
  textarea.placeAt("qunit-fixture");

  let changeFired = false;
  textarea.attachChange(() => {
    changeFired = true;
  });

  const kb = new KioskKeyboard();
  kb.setTargetInput(textarea);
  await placeAndWait(kb);

  tapKey(kb, "{enter}");
  assert.strictEqual(textarea.getValue(), "line1\n", "Newline inserted");
  assert.notOk(changeFired, "change event not fired on TextArea");

  textarea.destroy();
  kb.destroy();
});

QUnit.test("change fires on close after typing", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  let changeValue: string | undefined;
  input.attachChange((event: { getParameter(name: string): unknown }) => {
    changeValue = event.getParameter("value") as string;
  });

  const kb = new KioskKeyboard({ docked: true });
  kb.setTargetInput(input);
  await placeAndWait(kb);
  kb.show();

  tapKey(kb, "a");
  tapKey(kb, "b");
  kb.close();

  assert.strictEqual(changeValue, "ab", "change fired with correct value on close");

  input.destroy();
  kb.destroy();
});

QUnit.test("change does NOT fire on close without typing", async (assert) => {
  const input = new Input({ value: "hello" });
  input.placeAt("qunit-fixture");

  let changeFired = false;
  input.attachChange(() => {
    changeFired = true;
  });

  const kb = new KioskKeyboard({ docked: true });
  kb.setTargetInput(input);
  await placeAndWait(kb);
  kb.show();
  kb.close();

  assert.notOk(changeFired, "change not fired when nothing was typed");

  input.destroy();
  kb.destroy();
});

QUnit.test("change fires on setTargetInput switch after typing", async (assert) => {
  const input1 = new Input({ value: "" });
  const input2 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  let changeValue: string | undefined;
  input1.attachChange((event: { getParameter(name: string): unknown }) => {
    changeValue = event.getParameter("value") as string;
  });

  const kb = new KioskKeyboard();
  kb.setTargetInput(input1);
  await placeAndWait(kb);

  tapKey(kb, "x");
  kb.setTargetInput(input2);

  assert.strictEqual(changeValue, "x", "change fired on input1 when switching to input2");

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

QUnit.test("change doesn't double-fire after Enter then close", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  let changeCount = 0;
  input.attachChange(() => {
    changeCount++;
  });

  const kb = new KioskKeyboard({ docked: true });
  kb.setTargetInput(input);
  await placeAndWait(kb);
  kb.show();

  tapKey(kb, "a");
  tapKey(kb, "{enter}");
  kb.close();

  assert.strictEqual(changeCount, 1, "change fired exactly once (by Enter, not again on close)");

  input.destroy();
  kb.destroy();
});

QUnit.test("change NOT fired for TextArea on close", async (assert) => {
  const textarea = new TextArea({ value: "" });
  textarea.placeAt("qunit-fixture");

  let changeFired = false;
  textarea.attachChange(() => {
    changeFired = true;
  });

  const kb = new KioskKeyboard({ docked: true });
  kb.setTargetInput(textarea);
  await placeAndWait(kb);
  kb.show();

  tapKey(kb, "a");
  kb.close();

  assert.notOk(changeFired, "change not fired for TextArea on close");

  textarea.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Home / End key support
// ──────────────────────────────────────────────

QUnit.test("Home key moves focus to first key in row", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const rows = dom.querySelectorAll(".ui5KioskRow");
  const firstRow = rows[0];
  const keys = firstRow.querySelectorAll<HTMLElement>(".ui5KioskKey");
  const lastKeyInRow = keys[keys.length - 1];
  const firstKeyInRow = keys[0];

  // Focus the last key in first row
  lastKeyInRow.setAttribute("tabindex", "0");
  lastKeyInRow.focus();

  const event = new KeyboardEvent("keydown", { key: "Home", bubbles: true });
  Object.defineProperty(event, "target", { value: lastKeyInRow, writable: false });
  kb.onkeydown(event);

  assert.strictEqual(document.activeElement, firstKeyInRow, "Focus moved to first key in row");
  assert.strictEqual(firstKeyInRow.getAttribute("tabindex"), "0", "First key has tabindex=0");
  assert.strictEqual(lastKeyInRow.getAttribute("tabindex"), "-1", "Previous key has tabindex=-1");

  kb.destroy();
});

QUnit.test("End key moves focus to last key in row", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const rows = dom.querySelectorAll(".ui5KioskRow");
  const firstRow = rows[0];
  const keys = firstRow.querySelectorAll<HTMLElement>(".ui5KioskKey");
  const firstKeyInRow = keys[0];
  const lastKeyInRow = keys[keys.length - 1];

  // Focus the first key
  firstKeyInRow.setAttribute("tabindex", "0");
  firstKeyInRow.focus();

  const event = new KeyboardEvent("keydown", { key: "End", bubbles: true });
  Object.defineProperty(event, "target", { value: firstKeyInRow, writable: false });
  kb.onkeydown(event);

  assert.strictEqual(document.activeElement, lastKeyInRow, "Focus moved to last key in row");
  assert.strictEqual(lastKeyInRow.getAttribute("tabindex"), "0", "Last key has tabindex=0");
  assert.strictEqual(firstKeyInRow.getAttribute("tabindex"), "-1", "Previous key has tabindex=-1");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Arrow key wrapping
// ──────────────────────────────────────────────

QUnit.test("ArrowRight at end of row wraps to next row", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const rows = dom.querySelectorAll(".ui5KioskRow");
  const firstRowKeys = rows[0].querySelectorAll<HTMLElement>(".ui5KioskKey");
  const lastKeyFirstRow = firstRowKeys[firstRowKeys.length - 1];
  const secondRowKeys = rows[1].querySelectorAll<HTMLElement>(".ui5KioskKey");
  const firstKeySecondRow = secondRowKeys[0];

  // Focus the last key in first row
  lastKeyFirstRow.setAttribute("tabindex", "0");
  lastKeyFirstRow.focus();

  const event = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true });
  Object.defineProperty(event, "target", { value: lastKeyFirstRow, writable: false });
  kb.onkeydown(event);

  assert.strictEqual(document.activeElement, firstKeySecondRow, "Focus wrapped to first key of next row");

  kb.destroy();
});

QUnit.test("ArrowLeft at start of row wraps to previous row", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const rows = dom.querySelectorAll(".ui5KioskRow");
  const secondRowKeys = rows[1].querySelectorAll<HTMLElement>(".ui5KioskKey");
  const firstKeySecondRow = secondRowKeys[0];
  const firstRowKeys = rows[0].querySelectorAll<HTMLElement>(".ui5KioskKey");
  const lastKeyFirstRow = firstRowKeys[firstRowKeys.length - 1];

  // Focus the first key in second row
  firstKeySecondRow.setAttribute("tabindex", "0");
  firstKeySecondRow.focus();

  const event = new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true });
  Object.defineProperty(event, "target", { value: firstKeySecondRow, writable: false });
  kb.onkeydown(event);

  assert.strictEqual(document.activeElement, lastKeyFirstRow, "Focus wrapped to last key of previous row");

  kb.destroy();
});

QUnit.test("ArrowDown with column overflow clamps to last key", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType("Numpad");
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const rows = dom.querySelectorAll(".ui5KioskRow");
  // Numpad: rows may have different key counts
  // Find a key in a row that has more columns than a later row
  const firstRowKeys = rows[0].querySelectorAll<HTMLElement>(".ui5KioskKey");
  const lastCol = firstRowKeys.length - 1;
  const lastKeyFirstRow = firstRowKeys[lastCol];

  // Focus the last key in first row
  lastKeyFirstRow.setAttribute("tabindex", "0");
  lastKeyFirstRow.focus();

  const event = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true });
  Object.defineProperty(event, "target", { value: lastKeyFirstRow, writable: false });
  kb.onkeydown(event);

  // Should land on a key in the second row (clamped if column doesn't exist)
  const secondRowKeys = rows[1].querySelectorAll<HTMLElement>(".ui5KioskKey");
  const expectedTarget = secondRowKeys[Math.min(lastCol, secondRowKeys.length - 1)];
  assert.strictEqual(document.activeElement, expectedTarget, "Focus clamped to last key in target row");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Modified arrow keys not intercepted
// ──────────────────────────────────────────────

QUnit.test("Alt+Arrow keys are not intercepted", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const firstKey = dom.querySelector<HTMLElement>(".ui5KioskKey")!;
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  const event = new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true });
  Object.defineProperty(event, "target", { value: firstKey, writable: false });

  // Should not throw and focus should stay
  kb.onkeydown(event);
  assert.strictEqual(document.activeElement, firstKey, "Focus unchanged with Alt+Arrow");

  kb.destroy();
});

QUnit.test("Meta+Arrow keys are not intercepted", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const firstKey = dom.querySelector<HTMLElement>(".ui5KioskKey")!;
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  const event = new KeyboardEvent("keydown", { key: "ArrowRight", metaKey: true, bubbles: true });
  Object.defineProperty(event, "target", { value: firstKey, writable: false });

  kb.onkeydown(event);
  assert.strictEqual(document.activeElement, firstKey, "Focus unchanged with Meta+Arrow");

  kb.destroy();
});

// ──────────────────────────────────────────────
// inputIds multi-input targeting
// ──────────────────────────────────────────────

QUnit.test("inputIds resolves controls and registers focus delegation", async (assert) => {
  const input1 = new Input("test-input-1");
  const input2 = new Input("test-input-2");
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    inputIds: ["test-input-1", "test-input-2"],
  });
  await placeAndWait(kb);

  assert.strictEqual(kb.getInputIds().length, 2, "inputIds property has 2 entries");

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

QUnit.test("Focusing a registered input sets it as target", async (assert) => {
  const input1 = new Input("target-input-a");
  const input2 = new Input("target-input-b");
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    inputIds: ["target-input-a", "target-input-b"],
  });
  await placeAndWait(kb);

  // Focus input2 — should become the target
  const dom2 = input2.getFocusDomRef() as HTMLElement;
  dom2.focus();
  // Wait for delegation to propagate
  await nextUIUpdate();

  assert.strictEqual(kb.getTargetInput(), input2.getId(), "Target switched to focused input");

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

QUnit.test("exit() cleans up inputIds delegates", async (assert) => {
  const input = new Input("cleanup-input");
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    inputIds: ["cleanup-input"],
  });
  await placeAndWait(kb);

  kb.destroy();

  // If cleanup failed, focusing would throw. Focus and verify no errors.
  const dom = input.getFocusDomRef() as HTMLElement;
  dom.focus();
  dom.blur();

  assert.ok(true, "No errors after destroy with inputIds");

  input.destroy();
});

// ──────────────────────────────────────────────
// inputIds control resolution (view-local vs global)
// ──────────────────────────────────────────────

QUnit.test("inputIds resolves view-local IDs when keyboard is inside a View", async (assert) => {
  const view = await XMLView.create({
    definition: `<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:m="sap.m" xmlns:kiosk="ui5.kiosk">
      <m:Input id="localInput" />
      <kiosk:KioskKeyboard id="kb" inputIds="localInput" />
    </mvc:View>`,
  });
  view.placeAt("qunit-fixture");
  await waitForRender();

  const kb = view.byId("kb") as KioskKeyboard;
  const input = view.byId("localInput") as Input;

  // Focus the input — delegation should set it as target
  const dom = input.getFocusDomRef() as HTMLElement;
  dom.focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getTargetInput(), input.getId(), "View-local input resolved and set as target after focus");

  view.destroy();
});

QUnit.test("inputIds prefers view-local over global when IDs collide", async (assert) => {
  // Create a global control with a short ID that matches the view-local one
  const globalInput = new Input("collisionInput");
  globalInput.placeAt("qunit-fixture");
  await waitForRender();

  const view = await XMLView.create({
    definition: `<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:m="sap.m" xmlns:kiosk="ui5.kiosk">
      <m:Input id="collisionInput" />
      <kiosk:KioskKeyboard id="kb" inputIds="collisionInput" />
    </mvc:View>`,
  });
  view.placeAt("qunit-fixture");
  await waitForRender();

  const kb = view.byId("kb") as KioskKeyboard;
  const viewLocalInput = view.byId("collisionInput") as Input;

  // Focus the view-local input
  const dom = viewLocalInput.getFocusDomRef() as HTMLElement;
  dom.focus();
  await nextUIUpdate();

  assert.strictEqual(
    kb.getTargetInput(),
    viewLocalInput.getId(),
    "View-local input takes priority over global with same short ID",
  );
  assert.notStrictEqual(kb.getTargetInput(), globalInput.getId(), "Global control was NOT selected");

  view.destroy();
  globalInput.destroy();
});

QUnit.test("inputIds falls back to global when not inside a View", async (assert) => {
  const globalInput = new Input("global-resolution-input");
  globalInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    inputIds: ["global-resolution-input"],
  });
  await placeAndWait(kb);

  // Focus the input — delegation should set it as target via global fallback
  const dom = globalInput.getFocusDomRef() as HTMLElement;
  dom.focus();
  await nextUIUpdate();

  assert.strictEqual(
    kb.getTargetInput(),
    globalInput.getId(),
    "Global input resolved via fallback when keyboard is not inside a View",
  );

  kb.destroy();
  globalInput.destroy();
});

QUnit.test("inputIds silently skips unresolvable IDs", async (assert) => {
  const input = new Input("real-input");
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    inputIds: ["nonexistent-input", "real-input"],
  });
  await placeAndWait(kb);

  // Focus the real input — should still work despite the bad ID
  const dom = input.getFocusDomRef() as HTMLElement;
  dom.focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getTargetInput(), input.getId(), "Valid input still resolved when mixed with unresolvable IDs");

  kb.destroy();
  input.destroy();
});

QUnit.test("inputIds works with composite controls (StepInput)", async (assert) => {
  const stepInput = new StepInput("step-input-composite");
  stepInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    inputIds: ["step-input-composite"],
  });
  await placeAndWait(kb);

  // Focus the inner input of StepInput — delegation should resolve to StepInput
  const innerDom = stepInput.getFocusDomRef() as HTMLElement;
  innerDom.focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getTargetInput(), stepInput.getId(), "StepInput resolved as target via parent chain");

  stepInput.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Physical keyboard highlighting
// ──────────────────────────────────────────────

QUnit.test("Physical keydown adds highlight class to matching key", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const qKey = dom.querySelector('[data-key="q"]')!;
  assert.notOk(qKey.classList.contains("ui5KioskKey--highlight"), "No highlight initially");

  // Simulate physical keydown on the target input via delegation
  // The delegation uses onkeydown which is called by UI5's event delegation
  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));

  // Allow event delegation to process
  await nextUIUpdate();

  assert.ok(qKey.classList.contains("ui5KioskKey--highlight"), "Highlight class added on keydown");

  input.destroy();
  kb.destroy();
});

QUnit.test("Physical keyup removes highlight class", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const qKey = dom.querySelector('[data-key="q"]')!;

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));
  await nextUIUpdate();
  assert.ok(qKey.classList.contains("ui5KioskKey--highlight"), "Highlight present after keydown");

  inputDom.dispatchEvent(new KeyboardEvent("keyup", { key: "q", bubbles: true }));
  await nextUIUpdate();
  assert.notOk(qKey.classList.contains("ui5KioskKey--highlight"), "Highlight removed after keyup");

  input.destroy();
  kb.destroy();
});

QUnit.test("Changing target input moves highlight delegation", async (assert) => {
  const input1 = new Input({ value: "" });
  const input2 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(input1);
  await placeAndWait(kb);

  // Switch target to input2
  kb.setTargetInput(input2);

  const dom = kb.getDomRef()!;
  const qKey = dom.querySelector('[data-key="q"]')!;

  // Keydown on input1 should NOT highlight (delegation removed)
  const inputDom1 = input1.getFocusDomRef() as HTMLElement;
  inputDom1.focus();
  inputDom1.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));
  await nextUIUpdate();
  assert.notOk(qKey.classList.contains("ui5KioskKey--highlight"), "Old target keydown does not highlight");

  // Keydown on input2 SHOULD highlight
  const inputDom2 = input2.getFocusDomRef() as HTMLElement;
  inputDom2.focus();
  inputDom2.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));
  await nextUIUpdate();
  assert.ok(qKey.classList.contains("ui5KioskKey--highlight"), "New target keydown does highlight");

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// stableHeight property
// ──────────────────────────────────────────────

QUnit.test("stableHeight=false does not set minHeight", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef() as HTMLElement;
  assert.strictEqual(dom.style.minHeight, "", "No minHeight when stableHeight is false");

  kb.destroy();
});

QUnit.test("stableHeight maintains minimum height across layout switches", async (assert) => {
  const kb = new KioskKeyboard({ stableHeight: true });
  await placeAndWait(kb);

  const dom = kb.getDomRef() as HTMLElement;
  const initialHeight = dom.getBoundingClientRect().height;
  assert.ok(initialHeight > 0, "Has initial height");
  assert.ok(dom.style.minHeight, "minHeight is set when stableHeight is true");

  // Switch to numeric (fewer rows → shorter)
  kb.setLayout("numeric");
  await waitForRender();

  const minH = parseFloat(dom.style.minHeight);
  assert.ok(minH >= initialHeight, "minHeight preserved after switching to shorter layout");

  kb.destroy();
});

QUnit.test("Toggling stableHeight off clears minHeight", async (assert) => {
  const kb = new KioskKeyboard({ stableHeight: true });
  await placeAndWait(kb);

  const dom = kb.getDomRef() as HTMLElement;
  assert.ok(dom.style.minHeight, "minHeight set while stableHeight is true");

  kb.setStableHeight(false);
  await waitForRender();

  assert.strictEqual(dom.style.minHeight, "", "minHeight cleared after disabling stableHeight");

  kb.destroy();
});

QUnit.test("stableHeight ignored for docked keyboards", async (assert) => {
  const kb = new KioskKeyboard({ docked: true, stableHeight: true });
  await placeAndWait(kb);

  const dom = kb.getDomRef() as HTMLElement;
  assert.strictEqual(dom.style.minHeight, "", "No minHeight for docked keyboard even with stableHeight");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Popover integration (consumption scenario)
// ──────────────────────────────────────────────

QUnit.test("Keyboard renders inside a Popover", async (assert) => {
  const trigger = document.createElement("button");
  trigger.id = "popover-trigger";
  document.getElementById("qunit-fixture")!.appendChild(trigger);

  const input = new Input({ value: "" });
  const kb = new KioskKeyboard({ targetInput: input, stableHeight: true });
  const popover = new Popover({
    title: "Kiosk Input",
    contentWidth: "360px",
    content: [new VBox({ items: [input, kb] })],
  });

  popover.openBy(trigger);
  await waitForRender();

  assert.ok(popover.isOpen(), "Popover is open");
  assert.ok(kb.getDomRef(), "Keyboard is rendered inside popover");

  const keys = getKeyElements(kb);
  assert.ok(keys.length > 0, "Keyboard keys are rendered");

  popover.close();
  await waitForRender();

  popover.destroy();
});

QUnit.test("Typing into input inside a Popover", async (assert) => {
  const trigger = document.createElement("button");
  trigger.id = "popover-trigger-typing";
  document.getElementById("qunit-fixture")!.appendChild(trigger);

  const input = new Input({ value: "" });
  const kb = new KioskKeyboard({ targetInput: input, stableHeight: true });
  const popover = new Popover({
    title: "Kiosk Input",
    contentWidth: "360px",
    content: [new VBox({ items: [input, kb] })],
  });

  popover.openBy(trigger);
  await waitForRender();

  tapKey(kb, "h");
  tapKey(kb, "i");
  assert.strictEqual(input.getValue(), "hi", "Typing works inside popover");

  tapKey(kb, "{shift}");
  tapKey(kb, "a");
  assert.strictEqual(input.getValue(), "hiA", "Shift works inside popover");

  tapKey(kb, "{backspace}");
  assert.strictEqual(input.getValue(), "hi", "Backspace works inside popover");

  popover.close();
  await waitForRender();

  popover.destroy();
});

QUnit.test("Popover stays open while interacting with keyboard", async (assert) => {
  const trigger = document.createElement("button");
  trigger.id = "popover-trigger-focus";
  document.getElementById("qunit-fixture")!.appendChild(trigger);

  const input = new Input({ value: "" });
  const kb = new KioskKeyboard({ targetInput: input, stableHeight: true });
  const popover = new Popover({
    title: "Kiosk Input",
    contentWidth: "360px",
    content: [new VBox({ items: [input, kb] })],
  });

  popover.openBy(trigger);
  await waitForRender();

  // Tap several keys — popover should remain open
  tapKey(kb, "a");
  tapKey(kb, "b");
  tapKey(kb, "c");

  await nextUIUpdate();
  assert.ok(popover.isOpen(), "Popover stays open during keyboard interaction");
  assert.strictEqual(input.getValue(), "abc", "Input value accumulated correctly");

  popover.close();
  await waitForRender();

  popover.destroy();
});

// ──────────────────────────────────────────────
// Caps Lock visual indicator
// ──────────────────────────────────────────────

QUnit.test("Caps Lock renders lock icon on shift key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Double-tap shift for caps lock
  tapKey(kb, "{shift}");
  tapKey(kb, "{shift}");
  assert.ok(kb.isCapsLock(), "Caps lock is on");

  await waitForRender();

  const shiftKey = kb.getDomRef()!.querySelector('[data-key="{shift}"]')!;
  assert.ok(shiftKey.classList.contains("ui5KioskKey--capsLock"), "Shift key has capsLock CSS class");
  assert.ok(shiftKey.classList.contains("ui5KioskKey--active"), "Shift key also has active CSS class");

  // Should render a lock icon (sapUiIcon element)
  const icon = shiftKey.querySelector(".sapUiIcon");
  assert.ok(icon, "Lock icon is rendered inside shift key");

  // Aria-label should indicate Caps Lock
  assert.strictEqual(shiftKey.getAttribute("aria-label"), "Caps Lock", "Aria-label is Caps Lock");

  kb.destroy();
});

QUnit.test("Shift toggle works via keyboard (Enter key)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const shiftKey = kb.getDomRef()!.querySelector('[data-key="{shift}"]') as HTMLElement;

  // Simulate Enter keydown on the Shift key
  const pressEnter = () => {
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    shiftKey.dispatchEvent(event);
  };

  // Off → Shift
  pressEnter();
  assert.ok(kb.isShiftActive(), "Shift active after first Enter");
  assert.notOk(kb.isCapsLock(), "Not caps lock yet");

  // Shift → Caps Lock
  pressEnter();
  assert.ok(kb.isCapsLock(), "Caps Lock after second Enter");

  // Caps Lock → Off
  pressEnter();
  assert.notOk(kb.isShiftActive(), "Shift off after third Enter");
  assert.notOk(kb.isCapsLock(), "Caps Lock off after third Enter");

  kb.destroy();
});

QUnit.test("Single Shift does NOT show capsLock class or lock icon", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  assert.ok(kb.isShiftActive(), "Shift is active");
  assert.notOk(kb.isCapsLock(), "Caps lock is NOT on");

  await waitForRender();

  const shiftKey = kb.getDomRef()!.querySelector('[data-key="{shift}"]')!;
  assert.ok(shiftKey.classList.contains("ui5KioskKey--active"), "Has active class");
  assert.notOk(shiftKey.classList.contains("ui5KioskKey--capsLock"), "No capsLock class");

  // Should render arrow-top icon, not the lock icon used for caps lock
  const icon = shiftKey.querySelector(".sapUiIcon");
  assert.ok(icon, "Shift icon is rendered");
  assert.strictEqual(icon!.getAttribute("aria-label"), "arrow-top", "Shows arrow icon, not lock icon");
  assert.strictEqual(shiftKey.getAttribute("aria-label"), "Shift", "Aria-label is Shift");

  kb.destroy();
});

// ──────────────────────────────────────────────
// German QWERTZ layout
// ──────────────────────────────────────────────

QUnit.test("QWERTZ-DE layout resolves correctly", (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");

  const layout = kb.getResolvedLayout();
  assert.strictEqual(layout.length, 5, "QWERTZ-DE has 5 rows");

  // Row 2 should have Z instead of Y (QWERTZ)
  const row2Values = layout[1].map((k) => k.value);
  assert.ok(row2Values.includes("z"), "Row 2 contains 'z' (QWERTZ arrangement)");
  assert.notOk(row2Values.includes("y"), "Row 2 does not contain 'y'");

  // Umlaute present
  assert.ok(row2Values.includes("\u00FC"), "Row 2 contains \u00FC");
  const row3Values = layout[2].map((k) => k.value);
  assert.ok(row3Values.includes("\u00F6"), "Row 3 contains \u00F6");
  assert.ok(row3Values.includes("\u00E4"), "Row 3 contains \u00E4");

  // \u00DF present in row 4
  const row4Values = layout[3].map((k) => k.value);
  assert.ok(row4Values.includes("\u00DF"), "Row 4 contains \u00DF");

  kb.destroy();
});

QUnit.test("QWERTZ-DE renders correctly", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("z"), "Has z key");
  assert.ok(keys.includes("\u00FC"), "Has \u00FC key");
  assert.ok(keys.includes("\u00F6"), "Has \u00F6 key");
  assert.ok(keys.includes("\u00E4"), "Has \u00E4 key");
  assert.ok(keys.includes("\u00DF"), "Has \u00DF key");
  assert.notOk(keys.includes("y") && keys.indexOf("y") < keys.indexOf("z"), "Y not before Z (QWERTZ)");

  kb.destroy();
});

QUnit.test("QWERTZ-DE German number row shift symbols", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  kb.setTargetInput(input);
  await nextUIUpdate();

  // Shift+2 should produce " (double quote) in German layout
  tapKey(kb, "{shift}");

  const done = assert.async();
  kb.attachEvent("keyPress", (event: { getParameter(name: string): unknown }) => {
    assert.strictEqual(event.getParameter("key"), '"', 'Shift+2 produces " in German layout');
    done();
  });

  tapKey(kb, "2");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Base layout tracking ({layout:base})
// ──────────────────────────────────────────────

QUnit.test("Switching to numeric and back returns to base layout", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  // Switch to numeric
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "numeric", "Layout is now numeric");

  // Switch back via ABC (which uses {layout:base})
  tapKey(kb, "{layout:base}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "qwertz-de", "Layout returned to qwertz-de (not qwerty)");

  // Verify QWERTZ keys are present
  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("z"), "QWERTZ z key is back");
  assert.ok(keys.includes("\u00FC"), "\u00FC is back");

  kb.destroy();
});

QUnit.test("Base layout defaults to qwerty", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Switch to numeric
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  // Switch back via ABC ({layout:base})
  tapKey(kb, "{layout:base}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "qwerty", "Default base layout is qwerty");

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("q"), "QWERTY q key is present");

  kb.destroy();
});

QUnit.test("Base layout roundtrip: qwertz-de -> numeric -> special -> base", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  // Go to numeric
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  // Go to special from numeric
  tapKey(kb, "{layout:special}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "special", "Now on special layout");

  // Go back via ABC ({layout:base})
  tapKey(kb, "{layout:base}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "qwertz-de", "Returned to qwertz-de after special");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Highlight fix for shifted characters
// ──────────────────────────────────────────────

QUnit.test("Physical Shift+1 highlights the '1' key via data-shift-value", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const oneKey = dom.querySelector('[data-key="1"]')!;
  assert.notOk(oneKey.classList.contains("ui5KioskKey--highlight"), "No highlight initially");

  // Simulate typing "!" (Shift+1) on physical keyboard
  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "!", bubbles: true }));
  await nextUIUpdate();

  assert.ok(oneKey.classList.contains("ui5KioskKey--highlight"), "'1' key highlighted when '!' typed");

  inputDom.dispatchEvent(new KeyboardEvent("keyup", { key: "!", bubbles: true }));
  await nextUIUpdate();

  assert.notOk(oneKey.classList.contains("ui5KioskKey--highlight"), "Highlight removed on keyup");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Popover integration (continued)
// ──────────────────────────────────────────────

QUnit.test("Layout switching works inside a Popover", async (assert) => {
  // Trigger must be visible on-screen so the Popover can reposition after
  // the layout switch changes the keyboard's content height.
  // (Offscreen triggers cause _applyPosition to close the Popover.)
  const trigger = document.createElement("button");
  trigger.id = "popover-trigger-layout";
  trigger.style.cssText = "position:fixed;top:50px;left:50px";
  document.body.appendChild(trigger);

  const input = new Input({ value: "" });
  const kb = new KioskKeyboard({ targetInput: input, stableHeight: true });
  const popover = new Popover({
    title: "Kiosk Input",
    contentWidth: "360px",
    content: [new VBox({ items: [input, kb] })],
  });

  popover.openBy(trigger);
  await waitForRender();

  // Verify QWERTY is active
  let keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("q"), "QWERTY layout initially");

  // Switch to numeric
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.notOk(keys.includes("q"), "Numeric layout after switch");
  assert.ok(popover.isOpen(), "Popover still open after layout switch");

  popover.close();
  await waitForRender();

  popover.destroy();
  trigger.remove();
});

// ──────────────────────────────────────────────
// Custom layout registration (registerLayout)
// ──────────────────────────────────────────────

QUnit.test("registerLayout registers a custom layout usable by name", async (assert) => {
  // Register a minimal custom layout
  KioskKeyboard.registerLayout("test-custom", [[{ value: "x" }, { value: "y" }, { value: "z" }]]);

  const kb = new KioskKeyboard();
  kb.setLayout("test-custom");
  await placeAndWait(kb);

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.deepEqual(keys, ["x", "y", "z"], "Custom layout keys rendered");

  kb.destroy();
});

QUnit.test("getRegisteredLayout retrieves a registered layout", (assert) => {
  const custom = [[{ value: "a" }, { value: "b" }]];
  KioskKeyboard.registerLayout("test-retrieve", custom);

  const retrieved = KioskKeyboard.getRegisteredLayout("test-retrieve");
  assert.deepEqual(retrieved, custom, "Retrieved layout matches registered definition");

  assert.strictEqual(
    KioskKeyboard.getRegisteredLayout("nonexistent"),
    undefined,
    "Returns undefined for unregistered layout",
  );
});

QUnit.test("Custom layout works as base layout for {layout:base} roundtrip", async (assert) => {
  KioskKeyboard.registerLayout("test-roundtrip", [
    [
      { value: "m" },
      { value: "n" },
      {
        value: "{layout:numeric}",
        label: "123",
        type: "modifier",
      },
    ],
  ]);

  const kb = new KioskKeyboard();
  kb.setLayout("test-roundtrip");
  await placeAndWait(kb);

  // Switch to numeric
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "numeric", "On numeric now");

  // Switch back via {layout:base}
  tapKey(kb, "{layout:base}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "test-roundtrip", "Returned to custom layout");

  kb.destroy();
});

QUnit.test("registerLayout rejects overwrite of built-in layout", (assert) => {
  const original = KioskKeyboard.getRegisteredLayout("qwerty");
  assert.ok(original, "qwerty exists before overwrite attempt");

  // Attempt to overwrite built-in
  KioskKeyboard.registerLayout("qwerty", [[{ value: "HACKED" }]]);

  // Should still be the original
  const after = KioskKeyboard.getRegisteredLayout("qwerty");
  assert.deepEqual(after, original, "Built-in qwerty layout was NOT overwritten");
});

QUnit.test("registerLayout rejects forbidden map keys", (assert) => {
  for (const name of ["__proto__", "prototype", "constructor"]) {
    KioskKeyboard.registerLayout(name, [[{ value: "x" }]]);
    assert.strictEqual(KioskKeyboard.getRegisteredLayout(name), undefined, `Forbidden key "${name}" was rejected`);
  }

  const names = KioskKeyboard.getRegisteredLayoutNames();
  assert.notOk(names.includes("__proto__"), "Forbidden key __proto__ is not listed");
  assert.notOk(names.includes("prototype"), "Forbidden key prototype is not listed");
  assert.notOk(names.includes("constructor"), "Forbidden key constructor is not listed");
});

// ──────────────────────────────────────────────
// Feature 1: Locale-based default layout
// ──────────────────────────────────────────────

QUnit.test("getLocaleLayout returns layout based on UI5 locale", (assert) => {
  // The actual result depends on the test runner's language setting,
  // but the method should always return a string
  const layout = KioskKeyboard.getLocaleLayout();
  assert.strictEqual(typeof layout, "string", "getLocaleLayout returns a string");
  assert.ok(layout.length > 0, "Layout name is non-empty");
});

QUnit.test("getLocaleLayout returns qwertz-de for German locale", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "German locale maps to qwertz-de");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("getLocaleLayout returns qwerty for English locale", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("en");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwerty", "English locale maps to qwerty");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("getLocaleLayout falls back to qwerty for unmapped locale", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("ja");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwerty", "Japanese (unmapped) falls back to qwerty");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("registerLocaleLayout extends the locale map", (assert) => {
  const currentLang = Localization.getLanguage();
  KioskKeyboard.registerLayout("test-locale-layout", [[{ value: "x" }]]);
  KioskKeyboard.registerLocaleLayout("xx", "test-locale-layout");

  try {
    Localization.setLanguage("xx");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "test-locale-layout", "Custom locale maps to custom layout");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("registerLocaleLayout rejects forbidden locale keys", (assert) => {
  const localization = Localization as unknown as {
    getLanguageTag: () => { language: string; region?: string | null };
  };
  const originalGetLanguageTag = localization.getLanguageTag;

  for (const locale of ["__proto__", "prototype", "constructor"]) {
    KioskKeyboard.registerLocaleLayout(locale, "qwertz-de");
  }

  try {
    localization.getLanguageTag = () => ({ language: "__proto__", region: undefined });
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwerty", "Forbidden locale key __proto__ is ignored");

    localization.getLanguageTag = () => ({ language: "prototype", region: undefined });
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwerty", "Forbidden locale key prototype is ignored");

    localization.getLanguageTag = () => ({ language: "constructor", region: undefined });
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwerty", "Forbidden locale key constructor is ignored");
  } finally {
    localization.getLanguageTag = originalGetLanguageTag;
  }
});

QUnit.test("Unknown locale mapping falls back to default layout", (assert) => {
  const currentLang = Localization.getLanguage();
  KioskKeyboard.registerLocaleLayout("zz", "layout-does-not-exist");

  try {
    Localization.setLanguage("zz");
    assert.strictEqual(
      KioskKeyboard.getLocaleLayout(),
      "qwerty",
      "Unknown layout mapping falls back to default layout",
    );
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("Unknown exact locale mapping falls back to valid language prefix", (assert) => {
  const currentLang = Localization.getLanguage();
  KioskKeyboard.registerLocaleLayout("de-ch", "layout-does-not-exist");

  try {
    Localization.setLanguage("de-CH");
    assert.strictEqual(
      KioskKeyboard.getLocaleLayout(),
      "qwertz-de",
      "Invalid exact de-ch mapping falls back to valid de prefix mapping",
    );
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("applySettings injects locale layout when no explicit layout", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");
    const kb = new KioskKeyboard();
    assert.strictEqual(kb.getLayout(), "qwertz-de", "Locale layout injected automatically");
    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("Explicit layout overrides locale detection", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");
    const kb = new KioskKeyboard({ layout: "qwerty" });
    assert.strictEqual(kb.getLayout(), "qwerty", "Explicit layout takes priority over locale");
    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("getLocaleLayout matches language prefix for regional variant", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    // de-AT has no exact entry, should fall through to "de" → "qwertz-de"
    Localization.setLanguage("de-AT");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "de-AT falls back to de prefix");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("registerLocaleLayout exact region match takes priority over prefix", (assert) => {
  const currentLang = Localization.getLanguage();
  KioskKeyboard.registerLayout("test-de-at", [[{ value: "a" }]]);
  KioskKeyboard.registerLocaleLayout("de-at", "test-de-at");

  try {
    Localization.setLanguage("de-AT");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "test-de-at", "Exact de-at match wins over de prefix");

    // de (no region) still uses the prefix match
    Localization.setLanguage("de");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "de without region still maps to qwertz-de");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("Locale layout used as base layout for {layout:base} roundtrip", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");

    const kb = new KioskKeyboard();
    assert.strictEqual(kb.getLayout(), "qwertz-de", "Starts with locale layout");
    await placeAndWait(kb);

    // Switch to numeric
    tapKey(kb, "{layout:numeric}");
    await waitForRender();
    assert.strictEqual(kb.getLayout(), "numeric", "Switched to numeric");

    // Switch back via {layout:base}
    tapKey(kb, "{layout:base}");
    await waitForRender();
    assert.strictEqual(kb.getLayout(), "qwertz-de", "Returned to locale-detected qwertz-de");

    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("Locale layout renders correct keys", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");

    const kb = new KioskKeyboard();
    await placeAndWait(kb);

    const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.ok(keys.includes("z"), "German locale keyboard has z key (QWERTZ)");
    assert.ok(keys.includes("\u00FC"), "German locale keyboard has \u00FC key");

    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

// autoType and mobile keyboard tests moved to KioskKeyboard-autotype-mobile.qunit.ts
// autoShow tests moved to KioskKeyboard-autoshow.qunit.ts

// ──────────────────────────────────────────────
// Static API: getRegisteredLayoutNames / isBuiltInLayout
// ──────────────────────────────────────────────

QUnit.test("getRegisteredLayoutNames returns all built-in layouts", (assert) => {
  const names = KioskKeyboard.getRegisteredLayoutNames();
  assert.ok(names.includes("qwerty"), "Contains qwerty");
  assert.ok(names.includes("qwertz-de"), "Contains qwertz-de");
  assert.ok(names.includes("numeric"), "Contains numeric");
  assert.ok(names.includes("special"), "Contains special");
  assert.ok(names.includes("numpad"), "Contains numpad");
});

QUnit.test("getRegisteredLayoutNames includes custom layouts", (assert) => {
  KioskKeyboard.registerLayout("test-names-check", [[{ value: "z" }]]);
  const names = KioskKeyboard.getRegisteredLayoutNames();
  assert.ok(names.includes("test-names-check"), "Custom layout appears in list");
});

QUnit.test("isBuiltInLayout returns true for built-in layouts", (assert) => {
  assert.ok(KioskKeyboard.isBuiltInLayout("qwerty"), "qwerty is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("qwertz-de"), "qwertz-de is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("numeric"), "numeric is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("special"), "special is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("numpad"), "numpad is built-in");
});

QUnit.test("isBuiltInLayout returns false for custom layouts", (assert) => {
  KioskKeyboard.registerLayout("test-builtin-check", [[{ value: "a" }]]);
  assert.notOk(KioskKeyboard.isBuiltInLayout("test-builtin-check"), "Custom layout is not built-in");
  assert.notOk(KioskKeyboard.isBuiltInLayout("nonexistent"), "Nonexistent layout is not built-in");
});

// ──────────────────────────────────────────────
// registerLayout validation
// ──────────────────────────────────────────────

QUnit.test("registerLayout rejects non-array definition", (assert) => {
  KioskKeyboard.registerLayout("test-invalid-1", "not-an-array" as never);
  assert.strictEqual(KioskKeyboard.getRegisteredLayout("test-invalid-1"), undefined, "Non-array definition rejected");
});

QUnit.test("registerLayout rejects empty array", (assert) => {
  KioskKeyboard.registerLayout("test-invalid-2", []);
  assert.strictEqual(KioskKeyboard.getRegisteredLayout("test-invalid-2"), undefined, "Empty array rejected");
});

QUnit.test("registerLayout rejects row with empty array", (assert) => {
  KioskKeyboard.registerLayout("test-invalid-3", [[]]);
  assert.strictEqual(KioskKeyboard.getRegisteredLayout("test-invalid-3"), undefined, "Empty row rejected");
});

QUnit.test("registerLayout rejects key without value property", (assert) => {
  KioskKeyboard.registerLayout("test-invalid-4", [[{ label: "x" } as never]]);
  assert.strictEqual(KioskKeyboard.getRegisteredLayout("test-invalid-4"), undefined, "Key without value rejected");
});

QUnit.test("registerLayout rejects key with non-string value", (assert) => {
  KioskKeyboard.registerLayout("test-invalid-5", [[{ value: 123 } as never]]);
  assert.strictEqual(KioskKeyboard.getRegisteredLayout("test-invalid-5"), undefined, "Key with numeric value rejected");
});

QUnit.test("registerLayout keeps existing custom layout when re-registration payload is invalid", (assert) => {
  const layoutName = "test-invalid-overwrite-guard";
  const originalLayout = [[{ value: "a" }, { value: "b" }]];

  KioskKeyboard.registerLayout(layoutName, originalLayout);
  assert.deepEqual(KioskKeyboard.getRegisteredLayout(layoutName), originalLayout, "Initial custom layout registered");

  KioskKeyboard.registerLayout(layoutName, [[{ value: "x" }], []]);
  assert.deepEqual(
    KioskKeyboard.getRegisteredLayout(layoutName),
    originalLayout,
    "Invalid re-registration does not clobber existing custom layout",
  );
});

// ──────────────────────────────────────────────
// Focus save / restore (getFocusInfo / applyFocusInfo)
// ──────────────────────────────────────────────

QUnit.test("getFocusInfo returns lastFocusedKeyId", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Tap a key to set _lastFocusedKeyId
  tapKey(kb, "q");

  const info = kb.getFocusInfo() as { lastFocusedKeyId: string | null };
  assert.ok(info.lastFocusedKeyId, "lastFocusedKeyId is set after tapping a key");
  assert.ok(info.lastFocusedKeyId!.includes("key-"), "ID looks like a key element ID");

  kb.destroy();
});

QUnit.test("applyFocusInfo restores focus to previously focused key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Tap 'q' to set it as last focused
  tapKey(kb, "q");
  const info = kb.getFocusInfo() as { lastFocusedKeyId: string };

  // Focus something else
  const dom = kb.getDomRef()!;
  const firstKey = dom.querySelector(".ui5KioskKey") as HTMLElement;
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  // Restore focus to the saved key
  kb.applyFocusInfo(info);

  const restoredEl = document.getElementById(info.lastFocusedKeyId);
  assert.strictEqual(document.activeElement, restoredEl, "Focus restored to previously focused key");
  assert.strictEqual(restoredEl!.getAttribute("tabindex"), "0", "Restored key has tabindex=0");

  kb.destroy();
});

QUnit.test("applyFocusInfo falls back to first key when saved key is gone", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Apply focus info with a nonexistent key ID
  kb.applyFocusInfo({ lastFocusedKeyId: "nonexistent-key-id" });

  const firstKey = kb.getDomRef()!.querySelector(".ui5KioskKey") as HTMLElement;
  assert.strictEqual(document.activeElement, firstKey, "Focus falls back to first key");
  assert.strictEqual(firstKey.getAttribute("tabindex"), "0", "First key has tabindex=0");

  kb.destroy();
});

QUnit.test("Renderer falls back to first key when saved focus id is stale", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "q");
  kb.setLayout("numeric");
  await waitForRender();

  const focusableKeys = kb.getDomRef()!.querySelectorAll('.ui5KioskKey[tabindex="0"]');
  assert.strictEqual(focusableKeys.length, 1, "Exactly one key remains keyboard-focusable");
  assert.ok(focusableKeys[0].classList.contains("ui5KioskKey"), "Focusable key is a rendered keyboard key");

  kb.destroy();
});

QUnit.test("getFocusDomRef returns last focused key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Before any tap, should return the first key
  const initial = kb.getFocusDomRef();
  assert.ok(initial, "getFocusDomRef returns an element before any tap");
  assert.ok(initial!.classList.contains("ui5KioskKey"), "Initial focus ref is a key");

  // Tap a specific key
  tapKey(kb, "w");
  const afterTap = kb.getFocusDomRef();
  assert.ok(afterTap, "getFocusDomRef returns an element after tap");
  assert.strictEqual((afterTap as HTMLElement).dataset.key, "w", "Returns the last tapped key");

  kb.destroy();
});

// ──────────────────────────────────────────────
// setAutoShow property setter
// ──────────────────────────────────────────────

QUnit.test("setAutoShow(true) activates auto-show listeners", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  // Enable auto-show via the property setter (not enableAutoShow directly)
  kb.setAutoShow(true);

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "Keyboard opens after setAutoShow(true)");

  input.destroy();
  kb.destroy();
});

QUnit.test("setAutoShow(false) deactivates auto-show listeners", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  // Disable auto-show via the property setter
  kb.setAutoShow(false);

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard does not open after setAutoShow(false)");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// setDocked transitions
// ──────────────────────────────────────────────

QUnit.test("setDocked(true) resets open state", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Starts undocked — set docked should ensure closed
  kb.setDocked(true);
  assert.notOk(kb.isOpen(), "Keyboard is closed after switching to docked mode");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Backspace with selection
// ──────────────────────────────────────────────

QUnit.test("Backspace deletes selected text range", async (assert) => {
  const input = new Input({ value: "abcde" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  // Select "bcd" (positions 1-4)
  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  inputDom.focus();
  inputDom.setSelectionRange(1, 4);

  tapKey(kb, "{backspace}");
  assert.strictEqual(input.getValue(), "ae", "Selected range deleted");

  input.destroy();
  kb.destroy();
});

QUnit.test("Backspace at position 0 does nothing", async (assert) => {
  const input = new Input({ value: "abc" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  // Place cursor at position 0
  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  inputDom.focus();
  inputDom.setSelectionRange(0, 0);

  tapKey(kb, "{backspace}");
  assert.strictEqual(input.getValue(), "abc", "Value unchanged when backspace at position 0");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Typing with cursor in the middle
// ──────────────────────────────────────────────

QUnit.test("Typing inserts at cursor position, not at end", async (assert) => {
  const input = new Input({ value: "ac" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  // Place cursor between 'a' and 'c'
  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  inputDom.focus();
  inputDom.setSelectionRange(1, 1);

  tapKey(kb, "b");
  assert.strictEqual(input.getValue(), "abc", "Character inserted at cursor position");

  input.destroy();
  kb.destroy();
});

QUnit.test("Typing replaces selected text", async (assert) => {
  const input = new Input({ value: "hello" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(input);
  await placeAndWait(kb);

  // Select "ell"
  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  inputDom.focus();
  inputDom.setSelectionRange(1, 4);

  tapKey(kb, "a");
  assert.strictEqual(input.getValue(), "hao", "Selected text replaced by typed character");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// ARIA live region for shift state
// ──────────────────────────────────────────────

QUnit.test("Live region announces Shift state", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const sId = kb.getId();
  let liveRegion = document.getElementById(`${sId}-liveState`);
  assert.ok(liveRegion, "Live region element exists");
  assert.strictEqual(liveRegion!.textContent, "", "Empty when shift is off");

  // Activate shift
  tapKey(kb, "{shift}");
  await waitForRender();

  liveRegion = document.getElementById(`${sId}-liveState`);
  assert.strictEqual(liveRegion!.textContent, "Shift on", "Announces Shift on");

  // Activate caps lock
  tapKey(kb, "{shift}");
  await waitForRender();

  liveRegion = document.getElementById(`${sId}-liveState`);
  assert.strictEqual(liveRegion!.textContent, "Caps Lock on", "Announces Caps Lock on");

  // Deactivate
  tapKey(kb, "{shift}");
  await waitForRender();

  liveRegion = document.getElementById(`${sId}-liveState`);
  assert.strictEqual(liveRegion!.textContent, "", "Empty after shift off");

  kb.destroy();
});

QUnit.test("Live region announces open and close", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  const sId = kb.getId();
  let liveRegion = document.getElementById(`${sId}-liveState`);
  assert.ok(liveRegion, "Live region element exists");

  kb.show();
  liveRegion = document.getElementById(`${sId}-liveState`);
  assert.strictEqual(liveRegion!.textContent, "Virtual keyboard opened", "Announces open");

  kb.close();
  liveRegion = document.getElementById(`${sId}-liveState`);
  assert.strictEqual(liveRegion!.textContent, "Virtual keyboard closed", "Announces close");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Tap cancellation (drag away)
// ──────────────────────────────────────────────

QUnit.test("Tap cancelled when release is on a different key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  let keyPressed = false;
  kb.attachEvent("keyPress", () => {
    keyPressed = true;
  });

  const dom = kb.getDomRef()!;
  const qKey = dom.querySelector('[data-key="q"]') as HTMLElement;
  const wKey = dom.querySelector('[data-key="w"]') as HTMLElement;

  // Press on 'q', release on 'w'
  const start = new Event("touchstart", { bubbles: true });
  Object.defineProperty(start, "target", { value: qKey, writable: false });
  kb.ontouchstart(start);

  const end = new Event("touchend", { bubbles: true });
  Object.defineProperty(end, "target", { value: wKey, writable: false });
  kb.ontouchend(end);

  assert.notOk(keyPressed, "No keyPress when drag away from original key");

  kb.destroy();
});

// ──────────────────────────────────────────────
// No target input — typing does not throw
// ──────────────────────────────────────────────

QUnit.test("Typing with no target input does not throw", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // No target set — tap should not throw
  tapKey(kb, "a");
  tapKey(kb, "{backspace}");
  tapKey(kb, "{enter}");

  assert.ok(true, "No errors when typing without a target input");

  kb.destroy();
});

// ──────────────────────────────────────────────
// ARIA Associations
// ──────────────────────────────────────────────

QUnit.test("ariaLabelledBy renders aria-labelledby attribute on root DOM", async (assert) => {
  const label = new InvisibleText({ text: "My Keyboard" });
  label.placeAt("qunit-fixture");
  const kb = new KioskKeyboard();
  kb.addAriaLabelledBy(label);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  assert.ok(dom.getAttribute("aria-labelledby")?.includes(label.getId()), "aria-labelledby contains label ID");

  label.destroy();
  kb.destroy();
});

QUnit.test("ariaDescribedBy renders aria-describedby attribute", async (assert) => {
  const desc = new InvisibleText({ text: "Use arrow keys to navigate" });
  desc.placeAt("qunit-fixture");
  const kb = new KioskKeyboard();
  kb.addAriaDescribedBy(desc);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  assert.ok(dom.getAttribute("aria-describedby")?.includes(desc.getId()), "aria-describedby contains description ID");

  desc.destroy();
  kb.destroy();
});

QUnit.test("Multiple ariaLabelledBy IDs render space-separated", async (assert) => {
  const label1 = new InvisibleText({ text: "Label 1" });
  const label2 = new InvisibleText({ text: "Label 2" });
  label1.placeAt("qunit-fixture");
  label2.placeAt("qunit-fixture");
  const kb = new KioskKeyboard();
  kb.addAriaLabelledBy(label1);
  kb.addAriaLabelledBy(label2);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const attr = dom.getAttribute("aria-labelledby") ?? "";
  assert.ok(attr.includes(label1.getId()), "Contains first label ID");
  assert.ok(attr.includes(label2.getId()), "Contains second label ID");

  label1.destroy();
  label2.destroy();
  kb.destroy();
});

QUnit.test("ariaLabel + ariaLabelledBy coexist", async (assert) => {
  const label = new InvisibleText({ text: "External label" });
  label.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ ariaLabel: "Custom Keyboard" });
  kb.addAriaLabelledBy(label);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const labelledBy = dom.getAttribute("aria-labelledby") ?? "";
  assert.ok(labelledBy.includes(label.getId()), "ariaLabelledBy ID included in aria-labelledby");

  label.destroy();
  kb.destroy();
});

QUnit.test("removeAriaLabelledBy clears attribute after re-render", async (assert) => {
  const label = new InvisibleText({ text: "Removable label" });
  label.placeAt("qunit-fixture");
  const kb = new KioskKeyboard();
  kb.addAriaLabelledBy(label);
  await placeAndWait(kb);

  let attr = kb.getDomRef()!.getAttribute("aria-labelledby") ?? "";
  assert.ok(attr.includes(label.getId()), "Label ID initially present");

  kb.removeAriaLabelledBy(label);
  await waitForRender();

  attr = kb.getDomRef()!.getAttribute("aria-labelledby") ?? "";
  assert.notOk(attr.includes(label.getId()), "Label ID removed after re-render");

  label.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// aria-controls
// ──────────────────────────────────────────────

QUnit.test("aria-controls points to targetInput on initial render", async (assert) => {
  const input = new Input("a11y-target");
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  assert.strictEqual(
    kb.getDomRef()!.getAttribute("aria-controls"),
    input.getId(),
    "aria-controls set to target input ID",
  );

  input.destroy();
  kb.destroy();
});

QUnit.test("aria-controls absent when no targetInput", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.notOk(kb.getDomRef()!.hasAttribute("aria-controls"), "No aria-controls without target");

  kb.destroy();
});

QUnit.test("aria-controls updates when setTargetInput is called", async (assert) => {
  const input1 = new Input("a11y-input1");
  const input2 = new Input("a11y-input2");
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");
  await nextUIUpdate();

  const kb = new KioskKeyboard({ targetInput: input1 });
  await placeAndWait(kb);

  assert.strictEqual(kb.getDomRef()!.getAttribute("aria-controls"), input1.getId(), "Initially points to input1");

  kb.setTargetInput(input2);
  assert.strictEqual(
    kb.getDomRef()!.getAttribute("aria-controls"),
    input2.getId(),
    "Updated to input2 without re-render",
  );

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// QWERTZ-DE Shift Symbols Highlight
// ──────────────────────────────────────────────

QUnit.test('Physical "\\\"" highlights "2" key (Shift+2 on QWERTZ-DE)', async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ layout: "qwertz-de" });
  kb.setTargetInput(input);
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: '"', bubbles: true }));
  await nextUIUpdate();

  const key2 = kb.getDomRef()!.querySelector('[data-key="2"]') as HTMLElement;
  assert.ok(key2.classList.contains("ui5KioskKey--highlight"), "Key '2' highlighted for '\"'");

  inputDom.dispatchEvent(new KeyboardEvent("keyup", { key: '"', bubbles: true }));
  await nextUIUpdate();
  assert.notOk(key2.classList.contains("ui5KioskKey--highlight"), "Highlight removed on release");

  input.destroy();
  kb.destroy();
});

QUnit.test('Physical "/" highlights "7" key (Shift+7 on QWERTZ-DE)', async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ layout: "qwertz-de" });
  kb.setTargetInput(input);
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
  await nextUIUpdate();

  const key7 = kb.getDomRef()!.querySelector('[data-key="7"]') as HTMLElement;
  assert.ok(key7.classList.contains("ui5KioskKey--highlight"), "Key '7' highlighted for '/'");

  inputDom.dispatchEvent(new KeyboardEvent("keyup", { key: "/", bubbles: true }));
  await nextUIUpdate();
  assert.notOk(key7.classList.contains("ui5KioskKey--highlight"), "Highlight removed on release");

  input.destroy();
  kb.destroy();
});

QUnit.test('Physical "\u00DC" (capital U-umlaut) highlights "\u00FC" key', async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ layout: "qwertz-de" });
  kb.setTargetInput(input);
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "\u00DC", bubbles: true }));
  await nextUIUpdate();

  const keyU = kb.getDomRef()!.querySelector('[data-key="\u00FC"]') as HTMLElement;
  assert.ok(keyU.classList.contains("ui5KioskKey--highlight"), "\u00FC key highlighted for capital \u00DC");

  inputDom.dispatchEvent(new KeyboardEvent("keyup", { key: "\u00DC", bubbles: true }));
  await nextUIUpdate();
  assert.notOk(keyU.classList.contains("ui5KioskKey--highlight"), "Highlight removed");

  input.destroy();
  kb.destroy();
});

QUnit.test('Physical "\u00FC" (lowercase) highlights its own key directly', async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ layout: "qwertz-de" });
  kb.setTargetInput(input);
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "\u00FC", bubbles: true }));
  await nextUIUpdate();

  const keyU = kb.getDomRef()!.querySelector('[data-key="\u00FC"]') as HTMLElement;
  assert.ok(keyU.classList.contains("ui5KioskKey--highlight"), "\u00FC key highlighted directly");

  inputDom.dispatchEvent(new KeyboardEvent("keyup", { key: "\u00FC", bubbles: true }));
  await nextUIUpdate();
  assert.notOk(keyU.classList.contains("ui5KioskKey--highlight"), "Highlight removed");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// applyFocusInfo preventScroll
// ──────────────────────────────────────────────

QUnit.test("applyFocusInfo with preventScroll: true does not throw", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  kb.applyFocusInfo({ preventScroll: true });
  assert.ok(true, "No error with preventScroll: true");

  kb.destroy();
});

QUnit.test("applyFocusInfo with preventScroll: false does not throw", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  kb.applyFocusInfo({ preventScroll: false });
  assert.ok(true, "No error with preventScroll: false");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Target Input Destroyed While Open
// ──────────────────────────────────────────────

QUnit.test("Destroying target while open: tap/backspace/enter/close do not throw", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ docked: true });
  kb.setTargetInput(input);
  await placeAndWait(kb);
  kb.show();

  input.destroy();

  tapKey(kb, "a");
  tapKey(kb, "{backspace}");
  tapKey(kb, "{enter}");
  kb.close();

  assert.ok(true, "No errors after target input destroyed");

  kb.destroy();
});

QUnit.test("New input focused after target destroyed adopts correctly via autoShow", async (assert) => {
  const input1 = new Input();
  const input2 = new Input();
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);
  await waitForRender();

  // Focus input1 triggers autoShow
  (input1.getFocusDomRef() as HTMLElement).focus();
  await waitForRender();

  // Destroy input1 while keyboard is open
  input1.destroy();

  // Focus input2 — autoShow should adopt it without error
  (input2.getFocusDomRef() as HTMLElement).focus();
  await waitForRender();

  assert.ok(kb.isOpen(), "Keyboard remains open after adopting a new input");
  assert.strictEqual(kb.getTargetInput(), input2.getId(), "Target switched to the newly focused input");

  input2.destroy();
  kb.destroy();
});

QUnit.test(
  "Switching target while open after old target destroy still suppresses new target inputmode",
  async (assert) => {
    const input1 = new Input();
    const input2 = new Input();
    input1.placeAt("qunit-fixture");
    input2.placeAt("qunit-fixture");

    const kb = new KioskKeyboard({ docked: true, mobileKeyboard: "Custom" });
    kb.setTargetInput(input1);
    await placeAndWait(kb);

    const inputDom1 = input1.getFocusDomRef() as HTMLInputElement;
    const inputDom2 = input2.getFocusDomRef() as HTMLInputElement;
    const originalInputMode2 = inputDom2.getAttribute("inputmode");

    kb.show();
    assert.strictEqual(
      inputDom1.getAttribute("inputmode"),
      "none",
      "Old target inputmode suppressed while keyboard open",
    );

    input1.destroy();
    kb.setTargetInput(input2);

    assert.strictEqual(kb.getTargetInput(), input2.getId(), "Target switches to surviving input");
    assert.strictEqual(inputDom2.getAttribute("inputmode"), "none", "New target inputmode suppressed after switch");

    kb.close();
    if (originalInputMode2 !== null) {
      assert.strictEqual(
        inputDom2.getAttribute("inputmode"),
        originalInputMode2,
        "Original inputmode restored after close",
      );
    } else {
      assert.notOk(inputDom2.hasAttribute("inputmode"), "inputmode attribute removed after close");
    }

    input2.destroy();
    kb.destroy();
  },
);

// ──────────────────────────────────────────────
// Shift State on Numpad/Numeric
// ──────────────────────────────────────────────

QUnit.test("Numpad has no shift key rendered", async (assert) => {
  const kb = new KioskKeyboard({ keyboardType: "Numpad" });
  await placeAndWait(kb);

  const shiftKey = kb.getDomRef()!.querySelector('[data-key="{shift}"]');
  assert.notOk(shiftKey, "No shift key in numpad layout");

  kb.destroy();
});

QUnit.test("Numeric layout has no shift key rendered", async (assert) => {
  const kb = new KioskKeyboard({ keyboardType: "Numeric" });
  await placeAndWait(kb);

  const shiftKey = kb.getDomRef()!.querySelector('[data-key="{shift}"]');
  assert.notOk(shiftKey, "No shift key in numeric layout");

  kb.destroy();
});

QUnit.test("Prior shift state does not leak into Numpad rendering", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Activate shift on full layout
  tapKey(kb, "{shift}");
  assert.ok(kb.isShiftActive(), "Shift is active on full layout");

  // Switch to numpad
  kb.setKeyboardType("Numpad");
  await waitForRender();

  const shiftKey = kb.getDomRef()!.querySelector('[data-key="{shift}"]');
  assert.notOk(shiftKey, "No shift key rendered in numpad despite prior shift");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Rapid Show/Close Cycling
// ──────────────────────────────────────────────

QUnit.test("20 show/close cycles without error or state desync", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  for (let i = 0; i < 20; i++) {
    kb.show();
    kb.close();
  }

  assert.notOk(kb.isOpen(), "Keyboard is closed after all cycles");
  assert.ok(kb.getDomRef()!.classList.contains("ui5KioskKeyboard--closed"), "Closed CSS class present");

  kb.destroy();
});

QUnit.test("Rapid cycling preserves inputmode restoration", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ docked: true });
  kb.setTargetInput(input);
  await placeAndWait(kb);

  const inputEl = input.getFocusDomRef() as HTMLInputElement;
  const originalInputMode = inputEl.inputMode;

  for (let i = 0; i < 10; i++) {
    kb.show();
    kb.close();
  }

  assert.strictEqual(inputEl.inputMode, originalInputMode, "inputMode restored after cycling");

  input.destroy();
  kb.destroy();
});

QUnit.test("Event counts match actual show/close transitions", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  let openCount = 0;
  let closeCount = 0;
  kb.attachEvent("afterOpen", () => openCount++);
  kb.attachEvent("afterClose", () => closeCount++);

  for (let i = 0; i < 5; i++) {
    kb.show();
    kb.close();
  }

  assert.strictEqual(openCount, 5, "5 afterOpen events fired");
  assert.strictEqual(closeCount, 5, "5 afterClose events fired");

  kb.destroy();
});

// ──────────────────────────────────────────────
// setDocked Runtime Toggling
// ──────────────────────────────────────────────

QUnit.test("docked false \u2192 true \u2192 show \u2192 false \u2192 true resets to closed", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  kb.setDocked(true);
  kb.show();
  assert.ok(kb.isOpen(), "Open after show()");

  kb.setDocked(false);
  kb.setDocked(true);
  assert.notOk(kb.isOpen(), "Closed after toggling docked off and on");

  kb.destroy();
});

QUnit.test("setDocked(true) adds docked CSS classes after render", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  kb.setDocked(true);
  await waitForRender();

  const dom = kb.getDomRef()!;
  assert.ok(dom.classList.contains("ui5KioskKeyboard--docked"), "Docked class present");
  assert.ok(dom.classList.contains("ui5KioskKeyboard--closed"), "Closed class present (starts closed)");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Static API: getKeyIcon
// ──────────────────────────────────────────────

QUnit.test('getKeyIcon: {shift} \u2192 "sap-icon://arrow-top"', (assert) => {
  assert.strictEqual(KioskKeyboard.getKeyIcon("{shift}"), "sap-icon://arrow-top");
});

QUnit.test('getKeyIcon: {enter} \u2192 "sap-icon://accept"', (assert) => {
  assert.strictEqual(KioskKeyboard.getKeyIcon("{enter}"), "sap-icon://accept");
});

QUnit.test('getKeyIcon: {backspace} \u2192 "sap-icon://arrow-left"', (assert) => {
  assert.strictEqual(KioskKeyboard.getKeyIcon("{backspace}"), "sap-icon://arrow-left");
});

QUnit.test('getKeyIcon: "a" \u2192 undefined', (assert) => {
  assert.strictEqual(KioskKeyboard.getKeyIcon("a"), undefined);
});

QUnit.test('getKeyIcon: " " \u2192 undefined', (assert) => {
  assert.strictEqual(KioskKeyboard.getKeyIcon(" "), undefined);
});

// ──────────────────────────────────────────────
// getKeyAriaLabel for Special Keys
// ──────────────────────────────────────────────

QUnit.test('getKeyAriaLabel: {backspace} (label: "") \u2192 "Backspace"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(kb.getKeyAriaLabel({ value: "{backspace}", label: "" }), "Backspace");

  kb.destroy();
});

QUnit.test('getKeyAriaLabel: {enter} (label: "") \u2192 "Enter"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(kb.getKeyAriaLabel({ value: "{enter}", label: "" }), "Enter");

  kb.destroy();
});

QUnit.test('getKeyAriaLabel: {shift} (label: "") \u2192 "Shift"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(kb.getKeyAriaLabel({ value: "{shift}", label: "" }), "Shift");

  kb.destroy();
});

QUnit.test('getKeyAriaLabel: " " \u2192 "Space"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(kb.getKeyAriaLabel({ value: " " }), "Space");

  kb.destroy();
});

QUnit.test('getKeyAriaLabel: "a" \u2192 "a"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(kb.getKeyAriaLabel({ value: "a" }), "a");

  kb.destroy();
});

QUnit.test('getKeyAriaLabel after shift: "a" \u2192 "A", "1" with shiftLabel "!" \u2192 "!"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");

  assert.strictEqual(kb.getKeyAriaLabel({ value: "a" }), "A", "'a' becomes 'A' with shift");
  assert.strictEqual(
    kb.getKeyAriaLabel({ value: "1", shiftLabel: "!" }),
    "!",
    "'1' with shiftLabel '!' becomes '!' with shift",
  );

  kb.destroy();
});

// ──────────────────────────────────────────────
// Cross-Layout Special Char Consistency
// ──────────────────────────────────────────────

QUnit.test("Numeric layout keys identical regardless of base layout (qwerty vs qwertz-de)", async (assert) => {
  const kbQwerty = new KioskKeyboard({ layout: "qwerty", keyboardType: "Numeric" });
  const kbQwertz = new KioskKeyboard({ layout: "qwertz-de", keyboardType: "Numeric" });
  await placeAndWait(kbQwerty);
  kbQwertz.placeAt("qunit-fixture");
  await waitForRender();

  const keysQwerty = Array.from(getKeyElements(kbQwerty)).map((el) => el.dataset.key);
  const keysQwertz = Array.from(getKeyElements(kbQwertz)).map((el) => el.dataset.key);

  assert.deepEqual(keysQwerty, keysQwertz, "Same key values in same order");

  kbQwerty.destroy();
  kbQwertz.destroy();
});

// autoShow detection and deferred-close tests moved to KioskKeyboard-autoshow.qunit.ts

// ──────────────────────────────────────────────
// Custom Control Targeting (DOM Fallback)
// ──────────────────────────────────────────────

// Minimal custom control: renders a textual <input> but has no "value" metadata property.
// Verifies that the DOM-fallback path in _setTargetValue works for non-standard controls.
const CustomWrapper = (Control as any).extend("test.CustomWrapper", {
  metadata: { properties: {} },
  renderer: {
    apiVersion: 2,
    render(rm: any, ctrl: any) {
      rm.openStart("div", ctrl).openEnd();
      rm.voidStart("input")
        .attr("id", ctrl.getId() + "-inner")
        .attr("type", "text")
        .voidEnd();
      rm.close("div");
    },
  },
  getFocusDomRef() {
    return document.getElementById((this as any).getId() + "-inner");
  },
}) as any;

QUnit.test("typing works for custom control without value property (DOM fallback)", async (assert) => {
  const custom = new CustomWrapper();
  custom.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(custom);
  await placeAndWait(kb);

  const keyEl = kb.getDomRef()!.querySelector('[data-key="a"]') as HTMLElement;
  simulateTap(kb, keyEl);

  const dom = custom.getFocusDomRef() as HTMLInputElement;
  assert.strictEqual(dom.value, "a", "Character typed into custom control via DOM fallback");

  kb.destroy();
  custom.destroy();
});

QUnit.test("backspace works for custom control without value property (DOM fallback)", async (assert) => {
  const custom = new CustomWrapper();
  custom.placeAt("qunit-fixture");

  const kb = new KioskKeyboard();
  kb.setTargetInput(custom);
  await placeAndWait(kb);

  // Type "ab" then backspace
  simulateTap(kb, kb.getDomRef()!.querySelector('[data-key="a"]') as HTMLElement);
  simulateTap(kb, kb.getDomRef()!.querySelector('[data-key="b"]') as HTMLElement);
  simulateTap(kb, kb.getDomRef()!.querySelector('[data-key="{backspace}"]') as HTMLElement);

  const dom = custom.getFocusDomRef() as HTMLInputElement;
  assert.strictEqual(dom.value, "a", "Backspace removes last character from custom control");

  kb.destroy();
  custom.destroy();
});

// keyboardTypeChange and RTL tests moved to KioskKeyboard-events.qunit.ts
