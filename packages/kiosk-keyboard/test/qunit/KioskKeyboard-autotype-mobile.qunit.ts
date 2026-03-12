import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import StepInput from "sap/m/StepInput";
import Device from "sap/ui/Device";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import { getKeyElements, placeAndWait, waitForRender } from "./test-helpers";

// Device.system is writable at runtime; the readonly modifier only exists in the .d.ts.
const deviceSystem = Device.system as Record<string, boolean>;
let savedDeviceFlags: Record<string, boolean> = {};

function overrideDevice(key: "phone" | "tablet" | "desktop", value: boolean): void {
  if (!(key in savedDeviceFlags)) {
    savedDeviceFlags[key] = deviceSystem[key];
  }
  deviceSystem[key] = value;
}

QUnit.module("KioskKeyboard autoType and mobile keyboard", {
  afterEach() {
    for (const [key, value] of Object.entries(savedDeviceFlags)) {
      deviceSystem[key] = value;
    }
    savedDeviceFlags = {};
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

  assert.ok(kb.isKeyboardTypeExplicit(), "Explicit lock flag is true after setKeyboardType");

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

  assert.ok(kb.isKeyboardTypeExplicit(), "Explicit lock flag is true when keyboardType comes from settings");

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

  assert.ok(kb.isKeyboardTypeExplicit(), "Lock flag starts true after explicit set");

  (numInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.strictEqual(kb.getKeyboardType(), "Full", "Locked: Number input stays Full");

  (textInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  kb.resetKeyboardType();
  assert.notOk(kb.isKeyboardTypeExplicit(), "Lock flag is cleared after resetKeyboardType");

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

  assert.ok(kb.isKeyboardTypeExplicit(), "Lock flag starts true from constructor setting");

  (numInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.strictEqual(kb.getKeyboardType(), "Full", "Constructor lock: Number input stays Full");

  (textInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  kb.resetKeyboardType();
  assert.notOk(kb.isKeyboardTypeExplicit(), "Lock flag is cleared after resetKeyboardType");

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

QUnit.test("Native mode: programmatic show() does not open keyboard", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    mobileKeyboard: "Native",
  });
  kb.setTargetInput(input);
  await placeAndWait(kb);

  kb.show();

  assert.notOk(kb.isOpen(), "show() does not open when mobileKeyboard=Native");

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

QUnit.test("Auto mode defers on phone", async (assert) => {
  overrideDevice("phone", true);

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

  assert.notOk(kb.isOpen(), "mobileKeyboard=Auto defers on phone");

  input.destroy();
  kb.destroy();
});

QUnit.test("Auto mode defers on tablet (non-desktop)", async (assert) => {
  overrideDevice("tablet", true);
  overrideDevice("desktop", false);

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

  assert.notOk(kb.isOpen(), "mobileKeyboard=Auto defers on tablet without desktop flag");

  input.destroy();
  kb.destroy();
});

QUnit.test("Auto mode: programmatic show() does not open on phone", async (assert) => {
  overrideDevice("phone", true);

  const kb = new KioskKeyboard({
    docked: true,
    mobileKeyboard: "Auto",
  });
  await placeAndWait(kb);

  kb.show();

  assert.notOk(kb.isOpen(), "show() does not open when mobileKeyboard=Auto on phone");

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

QUnit.test("Shared target suppression is ref-counted across keyboard instances", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb1 = new KioskKeyboard({
    docked: true,
    mobileKeyboard: "Custom",
  });
  kb1.setTargetInput(input);
  await placeAndWait(kb1);

  const kb2 = new KioskKeyboard({
    docked: true,
    mobileKeyboard: "Custom",
  });
  kb2.setTargetInput(input);
  await placeAndWait(kb2);

  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  inputDom.setAttribute("inputmode", "email");

  kb1.show();
  assert.strictEqual(inputDom.getAttribute("inputmode"), "none", "First keyboard suppresses inputmode");

  kb2.show();
  assert.strictEqual(inputDom.getAttribute("inputmode"), "none", "Second keyboard keeps suppression active");

  kb1.close();
  assert.strictEqual(inputDom.getAttribute("inputmode"), "none", "inputmode stays suppressed while kb2 is open");

  kb2.close();
  assert.strictEqual(inputDom.getAttribute("inputmode"), "email", "Original inputmode restored after last close");

  input.destroy();
  kb1.destroy();
  kb2.destroy();
});

QUnit.test("Destroying one shared keyboard keeps suppression for survivor", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb1 = new KioskKeyboard({
    docked: true,
    mobileKeyboard: "Custom",
  });
  kb1.setTargetInput(input);
  await placeAndWait(kb1);

  const kb2 = new KioskKeyboard({
    docked: true,
    mobileKeyboard: "Custom",
  });
  kb2.setTargetInput(input);
  await placeAndWait(kb2);

  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  inputDom.setAttribute("inputmode", "decimal");

  kb1.show();
  kb2.show();
  assert.strictEqual(inputDom.getAttribute("inputmode"), "none", "Shared target is suppressed");

  kb1.destroy();
  assert.strictEqual(inputDom.getAttribute("inputmode"), "none", "Suppression remains while kb2 is still active");

  kb2.close();
  assert.strictEqual(inputDom.getAttribute("inputmode"), "decimal", "Original mode restored after survivor closes");

  input.destroy();
  kb2.destroy();
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
