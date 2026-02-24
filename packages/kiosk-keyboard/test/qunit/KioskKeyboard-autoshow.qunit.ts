import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import CheckBox from "sap/m/CheckBox";
import Control from "sap/ui/core/Control";
import Input from "sap/m/Input";
import VBox from "sap/m/VBox";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import { placeAndWait, waitForRender } from "./test-helpers";

QUnit.module("KioskKeyboard autoShow", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

const dispatchNullRelatedFocusOut = (element: HTMLElement): void => {
  element.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
};

QUnit.test("autoShow with docked=false does not open keyboard on input focus", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ autoShow: true, docked: false });
  await placeAndWait(kb);

  (input.getFocusDomRef() as HTMLElement).focus();
  await waitForRender();

  assert.notOk(kb.isOpen(), "Keyboard does not open when docked is false");

  input.destroy();
  kb.destroy();
});

QUnit.test("autoShow ignores non-textual input types (checkbox)", async (assert) => {
  const cb = new CheckBox();
  cb.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  const innerInput = cb.getDomRef()?.querySelector("input") as HTMLElement;
  assert.ok(innerInput, "CheckBox renders an inner <input>");
  innerInput.focus();
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard does not open for checkbox input");

  cb.destroy();
  kb.destroy();
});

QUnit.test("autoShow ignores readonly inputs", async (assert) => {
  const input = new Input({ editable: false });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard does not open for readonly input");

  input.destroy();
  kb.destroy();
});

QUnit.test("autoShow ignores disabled inputs", async (assert) => {
  const DisabledWrapper = (Control as any).extend("test.DisabledWrapper", {
    metadata: { properties: {} },
    renderer: {
      apiVersion: 2,
      render(rm: any, ctrl: any) {
        rm.openStart("div", ctrl).openEnd();
        rm.voidStart("input")
          .attr("id", ctrl.getId() + "-inner")
          .attr("type", "text")
          .attr("disabled", "disabled")
          .voidEnd();
        rm.close("div");
      },
    },
    getFocusDomRef() {
      return document.getElementById((this as any).getId() + "-inner");
    },
  }) as any;

  const disabledInput = new DisabledWrapper();
  disabledInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  const innerDom = disabledInput.getFocusDomRef() as HTMLElement;
  innerDom.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard does not open for disabled input");

  kb.destroy();
  disabledInput.destroy();
});

QUnit.test("autoShow ignores raw DOM input without UI5 control", async (assert) => {
  const rawInput = document.createElement("input");
  rawInput.type = "text";
  document.getElementById("qunit-fixture")!.appendChild(rawInput);

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  rawInput.focus();
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard does not open for raw DOM input");
  assert.strictEqual(kb.getTargetInput(), null, "No target input was set");

  kb.destroy();
});

QUnit.test("autoShow ignores date/time input types", async (assert) => {
  const DateWrapper = (Control as any).extend("test.DateWrapper", {
    metadata: { properties: {} },
    renderer: {
      apiVersion: 2,
      render(rm: any, ctrl: any) {
        rm.openStart("div", ctrl).openEnd();
        rm.voidStart("input")
          .attr("id", ctrl.getId() + "-inner")
          .attr("type", "date")
          .voidEnd();
        rm.close("div");
      },
    },
    getFocusDomRef() {
      return document.getElementById((this as any).getId() + "-inner");
    },
  }) as any;

  const dateInput = new DateWrapper();
  dateInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  const innerDom = dateInput.getFocusDomRef() as HTMLElement;
  innerDom.focus();
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard does not open for date input type");

  kb.destroy();
  dateInput.destroy();
});

QUnit.test(
  "autoShow keeps keyboard open when null relatedTarget settles on another claimable input",
  async (assert) => {
    const input1 = new Input();
    const input2 = new Input();
    input1.placeAt("qunit-fixture");
    input2.placeAt("qunit-fixture");

    const kb = new KioskKeyboard({ docked: true, autoShow: true });
    await placeAndWait(kb);

    (input1.getFocusDomRef() as HTMLElement).focus();
    await nextUIUpdate();
    assert.ok(kb.isOpen(), "Keyboard opened for first input");

    dispatchNullRelatedFocusOut(input1.getFocusDomRef() as HTMLElement);

    (input2.getFocusDomRef() as HTMLElement).focus();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextUIUpdate();

    assert.ok(kb.isOpen(), "Keyboard stays open after deferred close check");
    assert.strictEqual(kb.getTargetInput(), input2.getId(), "Target switched to second input");

    input1.destroy();
    input2.destroy();
    kb.destroy();
  },
);

QUnit.test("autoShow closes when null relatedTarget settles outside claimable inputs", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const outside = document.createElement("button");
  outside.id = "kb-outside-focus-target";
  document.getElementById("qunit-fixture")!.appendChild(outside);

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.ok(kb.isOpen(), "Keyboard opened for input");

  dispatchNullRelatedFocusOut(input.getFocusDomRef() as HTMLElement);

  outside.focus();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard closed after deferred close check");

  input.destroy();
  kb.destroy();
});

QUnit.test("destroy cancels deferred null-relatedTarget close", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.ok(kb.isOpen(), "Keyboard opened for input");

  dispatchNullRelatedFocusOut(input.getFocusDomRef() as HTMLElement);

  kb.destroy();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(true, "No errors after destroy with deferred close pending");

  input.destroy();
});

QUnit.test("Auto-show skips input targeted by another keyboard", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const inlineKb = new KioskKeyboard({
    keyboardType: "Numpad",
    targetInput: input,
  });
  inlineKb.placeAt("qunit-fixture");

  const dockedKb = new KioskKeyboard({
    docked: true,
    autoShow: true,
  });
  dockedKb.placeAt("qunit-fixture");
  await waitForRender();

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.notOk(dockedKb.isOpen(), "Docked keyboard does not open for input targeted by inline keyboard");

  input.destroy();
  inlineKb.destroy();
  dockedKb.destroy();
});

QUnit.test("Auto-show still works for unclaimed inputs", async (assert) => {
  const claimedInput = new Input();
  const freeInput = new Input();
  claimedInput.placeAt("qunit-fixture");
  freeInput.placeAt("qunit-fixture");

  const inlineKb = new KioskKeyboard({
    keyboardType: "Numpad",
    targetInput: claimedInput,
  });
  inlineKb.placeAt("qunit-fixture");

  const dockedKb = new KioskKeyboard({
    docked: true,
    autoShow: true,
  });
  dockedKb.placeAt("qunit-fixture");
  await waitForRender();

  (freeInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.ok(dockedKb.isOpen(), "Docked keyboard opens for unclaimed input");
  assert.strictEqual(dockedKb.getTargetInput(), freeInput.getId(), "Target set to unclaimed input");

  claimedInput.destroy();
  freeInput.destroy();
  inlineKb.destroy();
  dockedKb.destroy();
});

QUnit.test("Hidden keyboard target does not block auto-show", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const hiddenKb = new KioskKeyboard({
    keyboardType: "Numpad",
    targetInput: input,
    visible: false,
  });
  hiddenKb.placeAt("qunit-fixture");

  const dockedKb = new KioskKeyboard({
    docked: true,
    autoShow: true,
  });
  dockedKb.placeAt("qunit-fixture");
  await waitForRender();

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.ok(dockedKb.isOpen(), "Docked keyboard opens even when hidden keyboard targets the input");
  assert.strictEqual(dockedKb.getTargetInput(), input.getId(), "Docked keyboard claims the focused input");

  input.destroy();
  hiddenKb.destroy();
  dockedKb.destroy();
});

QUnit.test("Open keyboard still closes and restores inputmode after becoming hidden", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const outside = document.createElement("button");
  outside.id = "kb-hidden-close-target";
  document.getElementById("qunit-fixture")!.appendChild(outside);

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: "Custom",
  });
  kb.placeAt("qunit-fixture");
  await waitForRender();

  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  const originalInputMode = inputDom.getAttribute("inputmode");

  inputDom.focus();
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "Keyboard opens for focused input");
  assert.strictEqual(inputDom.getAttribute("inputmode"), "none", "inputmode is suppressed while open");

  kb.setVisible(false);
  await nextUIUpdate();

  outside.focus();
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard closes even after becoming hidden");
  if (originalInputMode !== null) {
    assert.strictEqual(inputDom.getAttribute("inputmode"), originalInputMode, "Original inputmode is restored");
  } else {
    assert.notOk(inputDom.hasAttribute("inputmode"), "inputmode attribute is removed after close");
  }

  input.destroy();
  kb.destroy();
});

QUnit.test("Open keyboard still closes and restores inputmode after becoming disabled", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const outside = document.createElement("button");
  outside.id = "kb-disabled-close-target";
  document.getElementById("qunit-fixture")!.appendChild(outside);

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: "Custom",
  });
  kb.placeAt("qunit-fixture");
  await waitForRender();

  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  const originalInputMode = inputDom.getAttribute("inputmode");

  inputDom.focus();
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "Keyboard opens for focused input");
  assert.strictEqual(inputDom.getAttribute("inputmode"), "none", "inputmode is suppressed while open");

  kb.setEnabled(false);
  await nextUIUpdate();

  outside.focus();
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard closes even after becoming disabled");
  if (originalInputMode !== null) {
    assert.strictEqual(inputDom.getAttribute("inputmode"), originalInputMode, "Original inputmode is restored");
  } else {
    assert.notOk(inputDom.hasAttribute("inputmode"), "inputmode attribute is removed after close");
  }

  input.destroy();
  kb.destroy();
});

QUnit.test("Destroying the claiming keyboard frees the input for auto-show", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const inlineKb = new KioskKeyboard({
    keyboardType: "Numpad",
    targetInput: input,
  });
  inlineKb.placeAt("qunit-fixture");

  const dockedKb = new KioskKeyboard({
    docked: true,
    autoShow: true,
  });
  dockedKb.placeAt("qunit-fixture");
  await waitForRender();

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.notOk(dockedKb.isOpen(), "Docked keyboard blocked while inline keyboard exists");

  (document.getElementById("qunit-fixture") as HTMLElement).focus();
  await nextUIUpdate();
  inlineKb.destroy();

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.ok(dockedKb.isOpen(), "Docked keyboard opens after inline keyboard is destroyed");

  input.destroy();
  dockedKb.destroy();
});

QUnit.test("Re-targeting the claiming keyboard frees the original input", async (assert) => {
  const input1 = new Input();
  const input2 = new Input();
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const inlineKb = new KioskKeyboard({
    keyboardType: "Numpad",
    targetInput: input1,
  });
  inlineKb.placeAt("qunit-fixture");

  const dockedKb = new KioskKeyboard({
    docked: true,
    autoShow: true,
  });
  dockedKb.placeAt("qunit-fixture");
  await waitForRender();

  (input1.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.notOk(dockedKb.isOpen(), "Docked keyboard blocked for input1");

  (input1.getFocusDomRef() as HTMLElement).blur();
  await nextUIUpdate();

  inlineKb.setTargetInput(input2);

  (input1.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.ok(dockedKb.isOpen(), "Docked keyboard opens for input1 after re-target");

  input1.destroy();
  input2.destroy();
  inlineKb.destroy();
  dockedKb.destroy();
});

QUnit.test("Docked keyboard closes when focus moves from unclaimed to claimed input", async (assert) => {
  const freeInput = new Input();
  const claimedInput = new Input();
  freeInput.placeAt("qunit-fixture");
  claimedInput.placeAt("qunit-fixture");

  const inlineKb = new KioskKeyboard({
    keyboardType: "Numpad",
    targetInput: claimedInput,
  });
  inlineKb.placeAt("qunit-fixture");

  const dockedKb = new KioskKeyboard({
    docked: true,
    autoShow: true,
  });
  dockedKb.placeAt("qunit-fixture");
  await waitForRender();

  (freeInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.ok(dockedKb.isOpen(), "Docked keyboard is open for free input");

  (claimedInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.notOk(dockedKb.isOpen(), "Docked keyboard closed after focus moved to claimed input");

  freeInput.destroy();
  claimedInput.destroy();
  inlineKb.destroy();
  dockedKb.destroy();
});

QUnit.test("inputIds rebinds delegates after control recreation in autoShow flow", async (assert) => {
  const box = new VBox("churn-box");
  box.placeAt("qunit-fixture");

  const input1 = new Input("churn-input");
  box.addItem(input1);

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    inputIds: ["churn-input"],
  });
  await placeAndWait(kb);

  (input1.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.ok(kb.isOpen(), "Keyboard opens for initial input");

  // Close and destroy the original input
  kb.close();
  await nextUIUpdate();
  input1.destroy();
  await nextUIUpdate();

  // Recreate with same explicit ID
  const input2 = new Input("churn-input");
  box.addItem(input2);
  await nextUIUpdate();

  // Trigger reconciliation so the new instance gets the delegate
  kb.setInputIds(["churn-input"]);

  // Focus the new input — keyboard should reopen and target should update
  (input2.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "Keyboard reopens for recreated input");
  assert.strictEqual(kb.getTargetInput(), input2.getId(), "Target updated to recreated input");

  box.destroy();
  kb.destroy();
});

QUnit.test("Two docked keyboards with auto-show do not fight over same input", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const docked1 = new KioskKeyboard({
    docked: true,
    autoShow: true,
  });
  docked1.placeAt("qunit-fixture");

  const docked2 = new KioskKeyboard({
    docked: true,
    autoShow: true,
  });
  docked2.placeAt("qunit-fixture");
  await waitForRender();

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  const openCount = [docked1.isOpen(), docked2.isOpen()].filter(Boolean).length;
  assert.strictEqual(openCount, 1, "Exactly one docked keyboard opens");

  input.destroy();
  docked1.destroy();
  docked2.destroy();
});
