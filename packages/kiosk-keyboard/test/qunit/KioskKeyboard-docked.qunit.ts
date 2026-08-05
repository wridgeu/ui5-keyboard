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

QUnit.test("Escape closes docked keyboard when virtual key has focus", async (assert) => {
  const input = new Input("escape-test-input");
  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  kb.show();
  assert.ok(kb.isOpen(), "Keyboard is open");

  // Focus a virtual key and dispatch Escape on it
  const firstKey = getFirstKeyElement(kb);
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  assert.notOk(kb.isOpen(), "Keyboard closed after Escape");

  input.destroy();
  kb.destroy();
});

QUnit.test("Escape closes docked keyboard when target input has focus", async (assert) => {
  const input = new Input("escape-input-focus");
  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
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

QUnit.test("Escape closes docked keyboard when focus is outside keyboard and target input", async (assert) => {
  const input = new Input("escape-outside-focus");
  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
  input.placeAt("qunit-fixture");

  const outside = document.createElement("button");
  outside.id = "escape-outside-button";
  document.getElementById("qunit-fixture")!.appendChild(outside);

  await placeAndWait(kb);

  kb.show();
  assert.ok(kb.isOpen(), "Keyboard is open");

  outside.focus();
  outside.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

  assert.notOk(kb.isOpen(), "Keyboard closed after Escape outside keyboard/input");

  outside.remove();
  input.destroy();
  kb.destroy();
});

QUnit.test("Escape on docked keyboard returns focus to target input", async (assert) => {
  const input = new Input("escape-focus-input");
  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  kb.show();

  const firstKey = getFirstKeyElement(kb);
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

  const firstKey = getFirstKeyElement(kb);
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  assert.ok(fired, "afterClose event fired");

  kb.destroy();
});

QUnit.test("Escape still closes the keyboard on a second open", async (assert) => {
  const input = new Input("escape-rearm-input");
  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  // close() detaches the Escape listener by aborting its signal. A signal is
  // one-shot, so the second show() must mint a fresh controller; reusing the
  // aborted one attaches nothing and Escape goes dead from here on.
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

QUnit.test("Escape does nothing when keyboard is not docked", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const firstKey = getFirstKeyElement(kb);
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  // Non-docked keyboard - Escape listener is never attached (only show()/close() manage it)
  firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  assert.strictEqual(document.activeElement, firstKey, "Focus unchanged - Escape not intercepted");

  kb.destroy();
});

QUnit.test("Escape does nothing when docked keyboard is already closed", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  // Keyboard is docked but closed (default state) - Escape listener not attached
  assert.notOk(kb.isOpen(), "Keyboard starts closed");

  const firstKey = getFirstKeyElement(kb);
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  let closeFired = false;
  kb.attachEvent("afterClose", () => (closeFired = true));

  firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  assert.notOk(closeFired, "afterClose not fired - keyboard was already closed");

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
  assert.ok(hasKeyboardClass(kb, DOM.classes.rootClosed), "Closed CSS class present");

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
// setDocked transitions
// ──────────────────────────────────────────────

QUnit.test("setDocked(true) resets open state", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Starts undocked - set docked should ensure closed
  kb.setDocked(true);
  assert.notOk(kb.isOpen(), "Keyboard is closed after switching to docked mode");

  kb.destroy();
});

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

  // Undocking aborts the focus listeners' signal. A signal is one-shot, so
  // re-docking must mint a fresh controller; reusing the aborted one leaves
  // isActive() reporting true while nothing is actually attached.
  kb.setDocked(false);
  kb.setDocked(true);

  (input.getFocusDomRef() as HTMLElement).focus();
  await waitForRender();

  assert.ok(kb.isOpen(), "Focus opens the keyboard again after re-docking");

  input.destroy();
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

  assert.ok(hasKeyboardClass(kb, DOM.classes.rootDocked), "Docked class present");
  assert.ok(hasKeyboardClass(kb, DOM.classes.rootClosed), "Closed class present (starts closed)");

  kb.destroy();
});
