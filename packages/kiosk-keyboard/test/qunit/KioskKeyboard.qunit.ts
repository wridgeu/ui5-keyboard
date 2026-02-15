import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import TextArea from "sap/m/TextArea";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const RENDER_WAIT = 500;

function placeAndWait(control: KioskKeyboard): Promise<void> {
  control.placeAt("qunit-fixture");
  return new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));
}

function tapKey(keyboard: KioskKeyboard, keyValue: string): void {
  const dom = keyboard.getDomRef();
  if (!dom) throw new Error("Keyboard not rendered");

  const keyEl = dom.querySelector(`[data-key="${keyValue}"]`) as HTMLElement | null;
  if (!keyEl) throw new Error(`Key "${keyValue}" not found`);

  // Simulate UI5 event delegation: call ontap with a synthetic event
  const event = new MouseEvent("tap", { bubbles: true });
  Object.defineProperty(event, "target", { value: keyEl, writable: false });
  keyboard.ontap(event);
}

function tapShiftInternally(kb: KioskKeyboard): void {
  const fakeShiftEl = document.createElement("div");
  fakeShiftEl.classList.add("ui5KioskKey");
  fakeShiftEl.dataset.key = "{shift}";
  fakeShiftEl.id = "fake-shift";

  const event = new MouseEvent("tap", { bubbles: true });
  Object.defineProperty(event, "target", { value: fakeShiftEl, writable: false });
  kb.ontap(event);
}

function getKeyElements(keyboard: KioskKeyboard): NodeListOf<HTMLElement> {
  const dom = keyboard.getDomRef();
  if (!dom) throw new Error("Keyboard not rendered");
  return dom.querySelectorAll<HTMLElement>(".ui5KioskKey");
}

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
  assert.strictEqual(kb.getAriaLabel(), "Virtual Keyboard", "Default ariaLabel");
  assert.strictEqual(kb.getDocked(), false, "Default docked is false");

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
  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

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
  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

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

  const event = new MouseEvent("tap", { bubbles: true });
  Object.defineProperty(event, "target", { value: fakeEl, writable: false });
  kb.ontap(event);

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

  const event = new MouseEvent("tap", { bubbles: true });
  Object.defineProperty(event, "target", { value: fakeEl, writable: false });
  kb.ontap(event);

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
  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

  const domBefore = kb.getDomRef();
  assert.ok(domBefore, "Keyboard is rendered before setTargetInput");

  kb.setTargetInput(input);

  // Wait a tick to let any potential async re-render occur
  await new Promise((resolve) => setTimeout(resolve, 100));

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
  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

  const updatedShift = kb.getDomRef()!.querySelector('[data-key="{shift}"]');
  assert.strictEqual(updatedShift!.getAttribute("aria-pressed"), "true", "After shift: aria-pressed=true");

  kb.destroy();
});

QUnit.test("getAccessibilityInfo returns correct data", (assert) => {
  const kb = new KioskKeyboard();
  const info = kb.getAccessibilityInfo();

  assert.strictEqual(info.role, "group", "Role is group");
  assert.strictEqual(info.type, "Virtual Keyboard", "Type is Virtual Keyboard");
  assert.strictEqual(info.description, "Virtual Keyboard", "Description is default aria label");
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

QUnit.test("show() fires afterOpen event", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  const done = assert.async();
  kb.attachEvent("afterOpen", () => {
    assert.ok(true, "afterOpen fired");
    done();
  });

  kb.show();
  kb.destroy();
});

QUnit.test("close() fires afterClose event", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  kb.show();

  const done = assert.async();
  kb.attachEvent("afterClose", () => {
    assert.ok(true, "afterClose fired");
    done();
  });

  kb.close();
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
// Auto-show
// ──────────────────────────────────────────────

QUnit.test("enableAutoShow / disableAutoShow are idempotent", (assert) => {
  const kb = new KioskKeyboard();

  // Should not throw
  kb.enableAutoShow();
  kb.enableAutoShow();

  kb.disableAutoShow();
  kb.disableAutoShow();

  assert.ok(true, "Multiple enable/disable calls don't throw");

  kb.destroy();
});

QUnit.test("exit() cleans up auto-show listeners", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  kb.enableAutoShow();
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
