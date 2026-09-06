import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { KeyboardType, MobileKeyboard } from "ui5/kiosk/library";
import CheckBox from "sap/m/CheckBox";
import Control from "sap/ui/core/Control";
import Input from "sap/m/Input";
import RadioButton from "sap/m/RadioButton";
import type RenderManager from "sap/ui/core/RenderManager";
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

QUnit.test("autoShow ignores non-textual input types (radio)", async (assert) => {
  const radio = new RadioButton();
  radio.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  const innerInput = radio.getDomRef()?.querySelector("input") as HTMLElement;
  assert.ok(innerInput, "RadioButton renders an inner <input>");
  innerInput.focus();
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard does not open for radio input");

  radio.destroy();
  kb.destroy();
});

QUnit.test("autoShow ignores disabled inputs", async (assert) => {
  const DisabledWrapper = Control.extend("test.DisabledWrapper", {
    metadata: { properties: {} },
    renderer: {
      apiVersion: 2,
      render(rm: RenderManager, ctrl: Control) {
        rm.openStart("div", ctrl).openEnd();
        rm.voidStart("input")
          .attr("id", ctrl.getId() + "-inner")
          .attr("type", "text")
          .attr("disabled", "disabled")
          .voidEnd();
        rm.close("div");
      },
    },
    getFocusDomRef(this: Control) {
      return document.getElementById(this.getId() + "-inner");
    },
  }) as new () => Control;

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
  assert.strictEqual(kb.getActiveControl(), null, "No target input was set");

  kb.destroy();
});

QUnit.test("autoShow ignores date/time input types", async (assert) => {
  const DateWrapper = Control.extend("test.DateWrapper", {
    metadata: { properties: {} },
    renderer: {
      apiVersion: 2,
      render(rm: RenderManager, ctrl: Control) {
        rm.openStart("div", ctrl).openEnd();
        rm.voidStart("input")
          .attr("id", ctrl.getId() + "-inner")
          .attr("type", "date")
          .voidEnd();
        rm.close("div");
      },
    },
    getFocusDomRef(this: Control) {
      return document.getElementById(this.getId() + "-inner");
    },
  }) as new () => Control;

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

QUnit.test("autoShow keeps the keyboard open when focus moves from one input to another", async (assert) => {
  const input1 = new Input();
  const input2 = new Input();
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  (input1.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.ok(kb.isOpen(), "Keyboard opened for the first input");

  (input2.getFocusDomRef() as HTMLElement).focus();
  // Give a wrongly scheduled deferred close its frame before asserting it did not run.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "Keyboard stays open across the move");
  assert.strictEqual(kb.getActiveControl()?.getId(), input2.getId(), "Target followed focus to the second input");

  input1.destroy();
  input2.destroy();
  kb.destroy();
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
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await nextUIUpdate();

    assert.ok(kb.isOpen(), "Keyboard stays open after deferred close check");
    assert.strictEqual(kb.getActiveControl()?.getId(), input2.getId(), "Target switched to second input");

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
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard closed after deferred close check");

  input.destroy();
  kb.destroy();
});

QUnit.test("show() overrides a deferred close scheduled in the same task", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const outside = document.createElement("button");
  outside.id = "kb-show-wins-focus-target";
  document.getElementById("qunit-fixture")!.appendChild(outside);

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.ok(kb.isOpen(), "Keyboard opened for input");

  dispatchNullRelatedFocusOut(input.getFocusDomRef() as HTMLElement);
  outside.focus();
  kb.show();

  await new Promise((resolve) => requestAnimationFrame(resolve));
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "show() outranks the deferred auto-show close");

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

  // Capture the rAF id the focusout handler schedules for the deferred close.
  const rafSpy = sinon.spy(window, "requestAnimationFrame");
  dispatchNullRelatedFocusOut(input.getFocusDomRef() as HTMLElement);
  const deferredCloseId = rafSpy.lastCall?.returnValue as number | undefined;
  rafSpy.restore();

  // The rAF callback self-guards, so a leaked frame would not throw; assert the
  // pending frame is actually cancelled on destroy.
  const cancelSpy = sinon.spy(window, "cancelAnimationFrame");
  kb.destroy();
  const cancelled = cancelSpy.calledWith(deferredCloseId as number);
  cancelSpy.restore();

  assert.notStrictEqual(deferredCloseId, undefined, "focusout with null relatedTarget schedules a deferred close");
  assert.ok(cancelled, "destroy cancels the pending deferred-close rAF");

  input.destroy();
});

QUnit.test("Hidden keyboard target does not block auto-show", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const hiddenKb = new KioskKeyboard({
    keyboardType: KeyboardType.Numpad,
    controls: [input.getId()],
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
  assert.strictEqual(dockedKb.getActiveControl()?.getId(), input.getId(), "Docked keyboard claims the focused input");

  input.destroy();
  hiddenKb.destroy();
  dockedKb.destroy();
});

QUnit.test("setVisible(false) closes the keyboard and restores inputmode", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: MobileKeyboard.Custom,
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

  assert.notOk(kb.isOpen(), "Keyboard closes when it is hidden");
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
    mobileKeyboard: MobileKeyboard.Custom,
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
  await new Promise((resolve) => requestAnimationFrame(resolve));
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
    keyboardType: KeyboardType.Numpad,
    controls: [input.getId()],
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
    keyboardType: KeyboardType.Numpad,
    controls: [input1.getId()],
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

  inlineKb.setControls([input2.getId()]);

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
    keyboardType: KeyboardType.Numpad,
    controls: [claimedInput.getId()],
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
  assert.strictEqual(dockedKb.getActiveControl()?.getId(), freeInput.getId(), "Target set to unclaimed input");

  (claimedInput.getFocusDomRef() as HTMLElement).focus();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await nextUIUpdate();
  assert.notOk(dockedKb.isOpen(), "Docked keyboard closed after focus moved to claimed input");

  freeInput.destroy();
  claimedInput.destroy();
  inlineKb.destroy();
  dockedKb.destroy();
});

QUnit.test("controls rebinds delegates after control recreation in autoShow flow", async (assert) => {
  const box = new VBox("churn-box");
  box.placeAt("qunit-fixture");

  const input1 = new Input("churn-input");
  box.addItem(input1);

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    controls: ["churn-input"],
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

  // Focus the new input - _onDocumentFocusIn must re-resolve controls
  // and attach the delegate to the new instance automatically
  (input2.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "Keyboard reopens for recreated input");
  assert.strictEqual(kb.getActiveControl()?.getId(), input2.getId(), "Target updated to recreated input");

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
