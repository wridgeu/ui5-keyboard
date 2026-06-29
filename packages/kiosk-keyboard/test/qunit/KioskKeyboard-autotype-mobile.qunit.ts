import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { KeyboardType, MobileKeyboard } from "ui5/kiosk/library";
import Input from "sap/m/Input";
import StepInput from "sap/m/StepInput";
import Control from "sap/ui/core/Control";
import Device from "sap/ui/Device";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import {
  createFakeKeyElement,
  getKeyElements,
  getRowKeyValues,
  placeAndWait,
  simulateTap,
  waitForRender,
} from "./test-helpers";

// Device.system is writable at runtime; the readonly modifier only exists in the .d.ts.
const deviceSystem = Device.system as Record<string, boolean>;
let savedDeviceFlags: Record<string, boolean> = {};

type DeviceProfile = Record<"phone" | "tablet" | "desktop", boolean>;

const deviceProfiles: Record<string, DeviceProfile> = {
  phone: { phone: true, tablet: false, desktop: false },
  tablet: { phone: false, tablet: true, desktop: false },
  desktop: { phone: false, tablet: false, desktop: true },
};

function emulateDevice(profile: keyof typeof deviceProfiles): void {
  for (const [key, value] of Object.entries(deviceProfiles[profile])) {
    if (!(key in savedDeviceFlags)) {
      savedDeviceFlags[key] = deviceSystem[key];
    }
    deviceSystem[key] = value;
  }
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

type DetectCase = {
  title: string;
  make: () => Control;
  prep?: (dom: HTMLElement) => void;
  expected: string;
  message: string;
};

const detectCases: DetectCase[] = [
  {
    title: "autoType detects Number input and switches to Numpad",
    make: () => new Input({ type: "Number" }),
    expected: "Numpad",
    message: "Auto-detected Numpad for Number input",
  },
  {
    title: "autoType detects Tel input and switches to Numpad",
    make: () => new Input({ type: "Tel" }),
    expected: "Numpad",
    message: "Auto-detected Numpad for Tel input",
  },
  {
    title: "autoType matches a mixed-case inputmode attribute (inputmode=Numeric)",
    make: () => new Input(),
    // inputmode is an enumerated HTML attribute matched case-insensitively.
    prep: (dom) => dom.setAttribute("inputmode", "Numeric"),
    expected: "Numpad",
    message: "Auto-detected Numpad for inputmode=Numeric",
  },
  {
    title: "autoType detects StepInput and switches to Numpad",
    make: () => new StepInput(),
    expected: "Numpad",
    message: "Auto-detected Numpad for StepInput",
  },
  {
    title: "autoType stays Full for regular text input",
    make: () => new Input(),
    expected: "Full",
    message: "Stays Full for regular text input",
  },
  {
    title: "autoType Email input stays Full",
    make: () => new Input({ type: "Email" }),
    expected: "Full",
    message: "Email input keeps Full keyboard",
  },
];

for (const { title, make, prep, expected, message } of detectCases) {
  QUnit.test(title, async (assert) => {
    const control = make();
    control.placeAt("qunit-fixture");

    const kb = new KioskKeyboard({
      docked: true,
      autoShow: true,
      autoType: true,
    });
    await placeAndWait(kb);

    try {
      const inputDom = control.getFocusDomRef() as HTMLElement;
      prep?.(inputDom);
      inputDom.focus();
      await nextUIUpdate();

      assert.strictEqual(kb.getKeyboardType(), expected, message);
    } finally {
      control.destroy();
      kb.destroy();
    }
  });
}

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
  kb.setKeyboardType(KeyboardType.Full);
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
    keyboardType: KeyboardType.Full,
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
  kb.setKeyboardType(KeyboardType.Full);
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
    keyboardType: KeyboardType.Full,
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

QUnit.test("autoType refocus on the same input preserves a user {layout:*} override", async (assert) => {
  // Regression (#102 review): re-focusing the already-active auto-detected input
  // must NOT re-run auto-detection in a way that wipes a user-driven {layout:*}
  // switch. Before the fix, focusin called _setKeyboardTypeSource on every focus,
  // which reset _layoutSource to "external" and reverted the user's surface.
  const numInput = new Input({ type: "Number" });
  numInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true, autoType: true });
  await placeAndWait(kb);

  const inputDom = numInput.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  await waitForRender();
  assert.strictEqual(kb.getKeyboardType(), "Numpad", "Auto-detected Numpad for Number input");
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "7", "Numpad surface before the user switch (row 0 starts at '7')");

  // User taps a {layout:numeric} key (e.g. from an instanceLayouts override): a
  // user-driven switch that overrides the auto-detected keyboardType constraint.
  simulateTap(kb, createFakeKeyElement("{layout:numeric}", "fake-numeric"));
  await waitForRender();
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "1", "User switch to numeric lands (row 0 starts at '1')");

  // Refocus the SAME input (blur then focus) is a caret reposition, not a new
  // editing context. The user's override must survive.
  inputDom.blur();
  inputDom.focus();
  await waitForRender();

  // The corrupted state is latent: the focusin re-detects the SAME type, so the
  // keyboardType setProperty is a no-op and nothing re-renders immediately. Force
  // the next render (as any subsequent keystroke / interaction would) to surface
  // whether the override was silently dropped.
  kb.invalidate();
  await waitForRender();

  assert.strictEqual(kb.getKeyboardType(), "Numpad", "keyboardType is unchanged by the refocus");
  assert.strictEqual(
    getRowKeyValues(kb, 0)[0],
    "1",
    "User {layout:numeric} override survives refocusing the same input and the next re-render (row 0 still '1')",
  );

  numInput.destroy();
  kb.destroy();
});

QUnit.test("autoType switch to a different same-type input drops a user {layout:*} override", async (assert) => {
  // Regression (#102 review): companion to the same-input refocus case above.
  // Switching to a DIFFERENT input is a new editing context and must drop the
  // override. Both inputs auto-detect to Numpad, so focusin skips re-detection
  // and only the _setActiveTarget target-switch reset can clear it.
  const numA = new Input({ type: "Number" });
  const numB = new Input({ type: "Number" });
  numA.placeAt("qunit-fixture");
  numB.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true, autoType: true });
  await placeAndWait(kb);

  (numA.getFocusDomRef() as HTMLElement).focus();
  await waitForRender();
  assert.strictEqual(kb.getKeyboardType(), "Numpad", "Number input A auto-detects Numpad");

  simulateTap(kb, createFakeKeyElement("{layout:numeric}", "fake-numeric"));
  await waitForRender();
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "1", "User switch to numeric lands (row 0 starts at '1')");

  // Switch to the other Number input: same detected type (Numpad), new context.
  (numB.getFocusDomRef() as HTMLElement).focus();
  await waitForRender();

  assert.strictEqual(kb.getKeyboardType(), "Numpad", "keyboardType stays Numpad across same-type switch");
  assert.strictEqual(
    getRowKeyValues(kb, 0)[0],
    "7",
    "Switching to a different input drops the user override and re-engages the numpad constraint (row 0 '7')",
  );

  numA.destroy();
  numB.destroy();
  kb.destroy();
});

QUnit.test("Default mobileKeyboard is Auto", (assert) => {
  const kb = new KioskKeyboard();
  assert.strictEqual(kb.getMobileKeyboard(), "Auto", "mobileKeyboard defaults to Auto");
  kb.destroy();
});

QUnit.test("mobileKeyboard Custom never defers to native (desktop)", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: MobileKeyboard.Custom,
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
    mobileKeyboard: MobileKeyboard.Custom,
    controls: [input.getId()],
  });
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
    mobileKeyboard: MobileKeyboard.Custom,
    controls: [input.getId()],
  });
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
    mobileKeyboard: MobileKeyboard.Native,
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
    mobileKeyboard: MobileKeyboard.Native,
    controls: [input.getId()],
  });
  await placeAndWait(kb);

  kb.show();

  assert.notOk(kb.isOpen(), "show() does not open when mobileKeyboard=Native");

  input.destroy();
  kb.destroy();
});

for (const { device, open } of [
  { device: "desktop", open: true },
  { device: "phone", open: false },
  { device: "tablet", open: false },
] as const) {
  QUnit.test(`Auto mode ${open ? "still opens" : "defers"} on ${device}`, async (assert) => {
    emulateDevice(device);

    const input = new Input();
    input.placeAt("qunit-fixture");

    const kb = new KioskKeyboard({
      docked: true,
      autoShow: true,
      mobileKeyboard: MobileKeyboard.Auto,
    });
    await placeAndWait(kb);

    (input.getFocusDomRef() as HTMLElement).focus();
    await nextUIUpdate();

    assert.strictEqual(kb.isOpen(), open, `mobileKeyboard=Auto ${open ? "opens" : "defers"} on ${device}`);

    input.destroy();
    kb.destroy();
  });
}

QUnit.test("Auto mode: programmatic show() does not open on phone", async (assert) => {
  emulateDevice("phone");

  const kb = new KioskKeyboard({
    docked: true,
    mobileKeyboard: MobileKeyboard.Auto,
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
    mobileKeyboard: MobileKeyboard.Custom,
    controls: [input.getId()],
  });
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
    mobileKeyboard: MobileKeyboard.Custom,
    controls: [input.getId()],
  });
  await placeAndWait(kb1);

  const kb2 = new KioskKeyboard({
    docked: true,
    mobileKeyboard: MobileKeyboard.Custom,
    controls: [input.getId()],
  });
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
    mobileKeyboard: MobileKeyboard.Custom,
    controls: [input.getId()],
  });
  await placeAndWait(kb1);

  const kb2 = new KioskKeyboard({
    docked: true,
    mobileKeyboard: MobileKeyboard.Custom,
    controls: [input.getId()],
  });
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
    mobileKeyboard: MobileKeyboard.Custom,
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
    mobileKeyboard: MobileKeyboard.Custom,
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

QUnit.test("Switching target while closed does not suppress inputmode", async (assert) => {
  const input1 = new Input();
  const input2 = new Input();
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    mobileKeyboard: MobileKeyboard.Custom,
    controls: [input1.getId(), input2.getId()],
  });
  await placeAndWait(kb);

  // Focus input2 to switch target while keyboard is closed
  input2.focus();
  await nextUIUpdate();

  const dom2 = input2.getFocusDomRef() as HTMLInputElement;
  assert.notStrictEqual(dom2.getAttribute("inputmode"), "none", "input2 not suppressed while closed");

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

QUnit.test("Removing controls while open restores old inputmode", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: MobileKeyboard.Custom,
  });
  await placeAndWait(kb);

  // Focus input to trigger autoShow and set target
  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  assert.ok(kb.isOpen(), "Keyboard is open");
  assert.strictEqual(inputDom.getAttribute("inputmode"), "none", "inputmode suppressed");

  // Move focus away to clear the target
  const outside = document.createElement("button");
  document.getElementById("qunit-fixture")!.appendChild(outside);
  outside.focus();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await nextUIUpdate();

  assert.notStrictEqual(inputDom.getAttribute("inputmode"), "none", "inputmode restored after focus moves away");

  outside.remove();
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
    autoShow: true,
    mobileKeyboard: MobileKeyboard.Custom,
  });
  await placeAndWait(kb);

  // Focus input1 to open keyboard and set target
  (input1.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  const dom1 = input1.getFocusDomRef() as HTMLInputElement;
  assert.ok(kb.isOpen(), "Keyboard opened");
  assert.strictEqual(dom1.getAttribute("inputmode"), "none", "input1 suppressed");

  // Switch to input2
  (input2.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  const dom2 = input2.getFocusDomRef() as HTMLInputElement;
  assert.notStrictEqual(dom1.getAttribute("inputmode"), "none", "input1 restored after switch to input2");
  assert.strictEqual(dom2.getAttribute("inputmode"), "none", "input2 suppressed");

  // Switch to input3
  (input3.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
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
