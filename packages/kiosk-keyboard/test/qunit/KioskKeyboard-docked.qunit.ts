import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { MobileKeyboard } from "ui5/kiosk/library";
import Input from "sap/m/Input";
import { getFirstKeyElement, hasKeyboardClass, placeAndWait, waitForRender } from "./test-helpers";

const DOM = KioskKeyboard.DOM;

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

QUnit.module("KioskKeyboard docked mode", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// Docked mode
// ──────────────────────────────────────────────

QUnit.test("Docked keyboard starts closed", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  assert.ok(hasKeyboardClass(kb, DOM.classes.rootDocked), "Has docked CSS class");
  assert.ok(hasKeyboardClass(kb, DOM.classes.rootClosed), "Has closed CSS class");
  assert.notOk(kb.isOpen(), "isOpen() returns false");

  kb.destroy();
});

QUnit.test("show() opens docked keyboard", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  kb.show();

  assert.ok(kb.isOpen(), "isOpen() returns true");
  assert.notOk(hasKeyboardClass(kb, DOM.classes.rootClosed), "Closed class removed");

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
  assert.ok(hasKeyboardClass(kb, DOM.classes.rootClosed), "Closed class added");

  kb.destroy();
});

QUnit.test("setDocked(false) closes an open keyboard and restores inputmode", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    mobileKeyboard: MobileKeyboard.Custom,
    controls: [input.getId()],
  });
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

  assert.notOk(hasKeyboardClass(kb, DOM.classes.rootDocked), "No docked class");
  assert.notOk(hasKeyboardClass(kb, DOM.classes.rootClosed), "No closed class");

  kb.destroy();
});

QUnit.test("show()/close() are no-ops when docked is false", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: false,
    mobileKeyboard: MobileKeyboard.Custom,
    controls: [input.getId()],
  });
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  const originalInputMode = inputDom.getAttribute("inputmode");

  let openCount = 0;
  let closeCount = 0;
  kb.attachEvent("afterOpen", () => openCount++);
  kb.attachEvent("afterClose", () => closeCount++);

  kb.show();
  kb.close();

  assert.notOk(kb.isOpen(), "Keyboard remains closed");
  assert.strictEqual(openCount, 0, "afterOpen not fired in non-docked mode");
  assert.strictEqual(closeCount, 0, "afterClose not fired in non-docked mode");
  assert.strictEqual(inputDom.getAttribute("inputmode"), originalInputMode, "inputmode is unchanged");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Escape key closes docked keyboard
// ──────────────────────────────────────────────

QUnit.test(
  "Escape from a keycap closes the keyboard, fires afterClose and returns focus to the input",
  async (assert) => {
    const input = new Input("escape-test-input");
    const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
    input.placeAt("qunit-fixture");
    await placeAndWait(kb);

    kb.show();
    assert.ok(kb.isOpen(), "Keyboard is open");

    let fired = false;
    kb.attachEvent("afterClose", () => (fired = true));

    const firstKey = getFirstKeyElement(kb);
    firstKey.setAttribute("tabindex", "0");
    firstKey.focus();

    firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    assert.notOk(kb.isOpen(), "Keyboard closed after Escape");
    assert.ok(fired, "afterClose event fired");
    assert.strictEqual(document.activeElement, input.getFocusDomRef(), "Focus returned to target input");

    input.destroy();
    kb.destroy();
  },
);

QUnit.test("Escape from the input or from outside closes the keyboard and leaves focus where it is", async (assert) => {
  const input = new Input("escape-input-focus");
  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
  input.placeAt("qunit-fixture");

  const outside = document.createElement("button");
  outside.id = "escape-outside-button";
  document.getElementById("qunit-fixture")!.appendChild(outside);

  await placeAndWait(kb);

  kb.show();
  assert.ok(kb.isOpen(), "Keyboard is open");

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  assert.notOk(kb.isOpen(), "Keyboard closed after Escape on input");
  assert.strictEqual(document.activeElement, inputDom, "Focus stays on the input");

  kb.show();
  assert.ok(kb.isOpen(), "Keyboard is open again");

  outside.focus();
  outside.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

  assert.notOk(kb.isOpen(), "Keyboard closed after Escape outside keyboard/input");
  assert.strictEqual(document.activeElement, outside, "Focus is not pulled onto the input");

  outside.remove();
  input.destroy();
  kb.destroy();
});

QUnit.test("Escape still closes the keyboard on a second open", async (assert) => {
  const input = new Input("escape-rearm-input");
  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  // close() aborts the Escape listener's signal. A signal is one-shot, so the second
  // show() must mint a fresh controller; reusing the aborted one attaches nothing.
  kb.show();
  kb.close();
  kb.show();
  assert.ok(kb.isOpen(), "Keyboard is open again");

  const firstKey = getFirstKeyElement(kb);
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();
  firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  assert.notOk(kb.isOpen(), "Keyboard closed after Escape on the re-opened keyboard");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Rapid Show/Close Cycling
// ──────────────────────────────────────────────

QUnit.test("Show/close cycling ends closed with one afterOpen and one afterClose per cycle", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  let openCount = 0;
  let closeCount = 0;
  kb.attachEvent("afterOpen", () => openCount++);
  kb.attachEvent("afterClose", () => closeCount++);

  for (let i = 0; i < 20; i++) {
    kb.show();
    kb.close();
  }

  assert.notOk(kb.isOpen(), "Keyboard is closed after all cycles");
  assert.ok(hasKeyboardClass(kb, DOM.classes.rootClosed), "Closed CSS class present");
  assert.strictEqual(openCount, 20, "20 afterOpen events fired");
  assert.strictEqual(closeCount, 20, "20 afterClose events fired");

  kb.destroy();
});

QUnit.test("Rapid cycling preserves inputmode restoration", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
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

// ──────────────────────────────────────────────
// setDocked transitions
// ──────────────────────────────────────────────

QUnit.test("setDocked toggles auto-show listener activation", async (assert) => {
  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  // @ts-expect-error Accessing private field for auto-show state verification
  assert.ok(kb._autoShowBehavior.isActive(), "autoShow listeners are active while docked");

  kb.setDocked(false);
  // @ts-expect-error Accessing private field for auto-show state verification
  assert.notOk(kb._autoShowBehavior.isActive(), "autoShow listeners are detached when undocked");

  kb.setDocked(true);
  // @ts-expect-error Accessing private field for auto-show state verification
  assert.ok(kb._autoShowBehavior.isActive(), "autoShow listeners are re-attached after re-docking");

  kb.destroy();
});

QUnit.test("auto-show still opens on focus after an undock/re-dock cycle", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  // Undocking aborts the focus listeners' signal. A signal is one-shot, so re-docking
  // must mint a fresh controller; reusing the aborted one attaches nothing.
  kb.setDocked(false);
  kb.setDocked(true);

  (input.getFocusDomRef() as HTMLElement).focus();
  await waitForRender();

  assert.ok(kb.isOpen(), "Focus opens the keyboard again after re-docking");

  input.destroy();
  kb.destroy();
});

QUnit.test("setDocked(true) adds docked CSS classes after render", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  kb.setDocked(true);
  await waitForRender();

  assert.ok(hasKeyboardClass(kb, DOM.classes.rootDocked), "Docked class present");
  assert.ok(hasKeyboardClass(kb, DOM.classes.rootClosed), "Closed class present (starts closed)");

  kb.destroy();
});
