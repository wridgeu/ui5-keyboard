import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import StepInput from "sap/m/StepInput";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import { getKeyElements, placeAndWait, waitForRender } from "./test-helpers";

QUnit.module("KioskKeyboard autoType and mobile keyboard", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Default autoType is false", (assert) => {
  const kb = new KioskKeyboard();
  assert.strictEqual(kb.getAutoType(), false, "autoType defaults to false");
  kb.destroy();
});

QUnit.test("autoType detects Number input and switches to Numpad", async (assert) => {
  const input = new Input({ type: "Number" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
  });
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getKeyboardType(), "Numpad", "Auto-detected Numpad for Number input");

  input.destroy();
  kb.destroy();
});

QUnit.test("autoType detects Tel input and switches to Numpad", async (assert) => {
  const input = new Input({ type: "Tel" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
  });
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getKeyboardType(), "Numpad", "Auto-detected Numpad for Tel input");

  input.destroy();
  kb.destroy();
});

QUnit.test("autoType detects StepInput and switches to Numpad", async (assert) => {
  const stepInput = new StepInput();
  stepInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
  });
  await placeAndWait(kb);

  try {
    const inputDom = stepInput.getFocusDomRef() as HTMLElement;
    inputDom.focus();
    await nextUIUpdate();

    assert.strictEqual(kb.getKeyboardType(), "Numpad", "Auto-detected Numpad for StepInput");
  } finally {
    stepInput.destroy();
    kb.destroy();
  }
});

QUnit.test("autoType stays Full for regular text input", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
  });
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getKeyboardType(), "Full", "Stays Full for regular text input");

  input.destroy();
  kb.destroy();
});

QUnit.test("autoType switches back from Numpad to Full when focus moves", async (assert) => {
  const numInput = new Input({ type: "Number" });
  const textInput = new Input();
  numInput.placeAt("qunit-fixture");
  textInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
  });
  await placeAndWait(kb);

  (numInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.strictEqual(kb.getKeyboardType(), "Numpad", "Numpad for number input");

  (textInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.strictEqual(kb.getKeyboardType(), "Full", "Switched back to Full for text input");

  numInput.destroy();
  textInput.destroy();
  kb.destroy();
});

QUnit.test("Explicit setKeyboardType disables autoType", async (assert) => {
  const numInput = new Input({ type: "Number" });
  numInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
  });
  kb.setKeyboardType("Full");
  await placeAndWait(kb);

  (numInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getKeyboardType(), "Full", "Explicit keyboardType prevents auto-detection");

  numInput.destroy();
  kb.destroy();
});

QUnit.test("Constructor keyboardType also disables autoType", async (assert) => {
  const numInput = new Input({ type: "Number" });
  numInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
    keyboardType: "Full",
  });
  await placeAndWait(kb);

  (numInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getKeyboardType(), "Full", "Constructor keyboardType prevents auto-detection");

  numInput.destroy();
  kb.destroy();
});

QUnit.test("autoType=false does not switch keyboardType on focus", async (assert) => {
  const numInput = new Input({ type: "Number" });
  numInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: false,
  });
  await placeAndWait(kb);

  (numInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getKeyboardType(), "Full", "autoType=false keeps Full for Number input");

  numInput.destroy();
  kb.destroy();
});

QUnit.test("autoType Email input stays Full", async (assert) => {
  const input = new Input({ type: "Email" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
  });
  await placeAndWait(kb);

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getKeyboardType(), "Full", "Email input keeps Full keyboard");

  input.destroy();
  kb.destroy();
});

QUnit.test("autoType renders numpad keys after switching to Numpad", async (assert) => {
  const numInput = new Input({ type: "Number" });
  numInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
  });
  await placeAndWait(kb);

  (numInput.getFocusDomRef() as HTMLElement).focus();
  await waitForRender();

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("7"), "Numpad keys present after auto-switch");
  assert.notOk(keys.includes("q"), "No alphabetic keys in auto-switched numpad");

  numInput.destroy();
  kb.destroy();
});

QUnit.test("resetKeyboardType re-enables autoType after explicit setKeyboardType", async (assert) => {
  const numInput = new Input({ type: "Number" });
  const textInput = new Input();
  numInput.placeAt("qunit-fixture");
  textInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
  });
  kb.setKeyboardType("Full");
  await placeAndWait(kb);

  (numInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.strictEqual(kb.getKeyboardType(), "Full", "Locked: Number input stays Full");

  (textInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  kb.resetKeyboardType();

  (numInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.strictEqual(kb.getKeyboardType(), "Numpad", "After reset: Number input triggers Numpad");

  numInput.destroy();
  textInput.destroy();
  kb.destroy();
});

QUnit.test("resetKeyboardType re-enables autoType after constructor keyboardType", async (assert) => {
  const numInput = new Input({ type: "Number" });
  const textInput = new Input();
  numInput.placeAt("qunit-fixture");
  textInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
    keyboardType: "Full",
  });
  await placeAndWait(kb);

  (numInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.strictEqual(kb.getKeyboardType(), "Full", "Constructor lock: Number input stays Full");

  (textInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  kb.resetKeyboardType();

  (numInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.strictEqual(kb.getKeyboardType(), "Numpad", "After reset: constructor lock cleared, Numpad detected");

  numInput.destroy();
  textInput.destroy();
  kb.destroy();
});

QUnit.test("Default mobileKeyboard is Custom", (assert) => {
  const kb = new KioskKeyboard();
  assert.strictEqual(kb.getMobileKeyboard(), "Custom", "mobileKeyboard defaults to Custom");
  kb.destroy();
});

QUnit.test("mobileKeyboard Custom never defers to native (desktop)", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: "Custom",
  });
  await placeAndWait(kb);

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "Keyboard opens with mobileKeyboard=Custom");

  input.destroy();
  kb.destroy();
});

QUnit.test("show() sets inputmode=none on target input", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    mobileKeyboard: "Custom",
  });
  kb.setTargetInput(input);
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  const originalMode = inputDom.getAttribute("inputmode");

  kb.show();
  assert.strictEqual(inputDom.getAttribute("inputmode"), "none", "inputmode set to none on show");

  kb.close();
  assert.strictEqual(inputDom.getAttribute("inputmode"), originalMode, "inputmode restored on close");

  input.destroy();
  kb.destroy();
});

QUnit.test("exit() restores inputmode if keyboard was open", async (assert) => {
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
  assert.strictEqual(inputDom.getAttribute("inputmode"), "none", "inputmode suppressed");

  kb.destroy();

  assert.notStrictEqual(inputDom.getAttribute("inputmode"), "none", "inputmode restored after destroy");

  input.destroy();
});

QUnit.test("Native mode always defers to native keyboard", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: "Native",
  });
  await placeAndWait(kb);

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "mobileKeyboard=Native defers even on desktop");

  input.destroy();
  kb.destroy();
});

QUnit.test("Auto mode still opens on desktop", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: "Auto",
  });
  await placeAndWait(kb);

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "mobileKeyboard=Auto still opens on desktop");

  input.destroy();
  kb.destroy();
});

QUnit.test("Existing inputmode attribute is preserved and restored", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    mobileKeyboard: "Custom",
  });
  kb.setTargetInput(input);
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  inputDom.setAttribute("inputmode", "email");

  kb.show();
  assert.strictEqual(inputDom.getAttribute("inputmode"), "none", "inputmode overridden to none");

  kb.close();
  assert.strictEqual(inputDom.getAttribute("inputmode"), "email", "Original inputmode=email restored");

  input.destroy();
  kb.destroy();
});

QUnit.test("show() without target input does not throw", async (assert) => {
  const kb = new KioskKeyboard({
    docked: true,
    mobileKeyboard: "Custom",
  });
  await placeAndWait(kb);

  kb.show();
  assert.ok(kb.isOpen(), "Keyboard opens without error even without target input");

  kb.close();
  kb.destroy();
});

QUnit.test("Switching target while open restores old and suppresses new", async (assert) => {
  const input1 = new Input();
  const input2 = new Input();
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: "Custom",
  });
  await placeAndWait(kb);

  (input1.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  const dom1 = input1.getFocusDomRef() as HTMLInputElement;
  assert.strictEqual(dom1.getAttribute("inputmode"), "none", "input1 suppressed");

  (input2.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  const dom2 = input2.getFocusDomRef() as HTMLInputElement;
  assert.strictEqual(dom2.getAttribute("inputmode"), "none", "input2 suppressed");
  assert.notStrictEqual(dom1.getAttribute("inputmode"), "none", "input1 restored");

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

QUnit.test("setTargetInput while closed does not suppress inputmode", async (assert) => {
  const input1 = new Input();
  const input2 = new Input();
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    mobileKeyboard: "Custom",
  });
  kb.setTargetInput(input1);
  await placeAndWait(kb);

  kb.setTargetInput(input2);

  const dom2 = input2.getFocusDomRef() as HTMLInputElement;
  assert.notStrictEqual(dom2.getAttribute("inputmode"), "none", "input2 not suppressed while closed");

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

QUnit.test("setTargetInput to null while open restores old inputmode", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    mobileKeyboard: "Custom",
  });
  kb.setTargetInput(input);
  await placeAndWait(kb);

  kb.show();
  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  assert.strictEqual(inputDom.getAttribute("inputmode"), "none", "inputmode suppressed");

  kb.setTargetInput("");
  assert.notStrictEqual(inputDom.getAttribute("inputmode"), "none", "inputmode restored after clearing target");

  kb.close();
  kb.destroy();
  input.destroy();
});

QUnit.test("Rapid target switches while open: each intermediate target is restored", async (assert) => {
  const input1 = new Input();
  const input2 = new Input();
  const input3 = new Input();
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");
  input3.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    mobileKeyboard: "Custom",
  });
  kb.setTargetInput(input1);
  await placeAndWait(kb);

  kb.show();
  const dom1 = input1.getFocusDomRef() as HTMLInputElement;
  assert.strictEqual(dom1.getAttribute("inputmode"), "none", "input1 suppressed");

  kb.setTargetInput(input2);
  const dom2 = input2.getFocusDomRef() as HTMLInputElement;
  assert.notStrictEqual(dom1.getAttribute("inputmode"), "none", "input1 restored after switch to input2");
  assert.strictEqual(dom2.getAttribute("inputmode"), "none", "input2 suppressed");

  kb.setTargetInput(input3);
  const dom3 = input3.getFocusDomRef() as HTMLInputElement;
  assert.notStrictEqual(dom2.getAttribute("inputmode"), "none", "input2 restored after switch to input3");
  assert.strictEqual(dom3.getAttribute("inputmode"), "none", "input3 suppressed");

  kb.close();
  assert.notStrictEqual(dom3.getAttribute("inputmode"), "none", "input3 restored on close");

  input1.destroy();
  input2.destroy();
  input3.destroy();
  kb.destroy();
});
