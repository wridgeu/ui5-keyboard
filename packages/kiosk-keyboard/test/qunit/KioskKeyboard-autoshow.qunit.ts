import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import CheckBox from "sap/m/CheckBox";
import Control from "sap/ui/core/Control";
import Input from "sap/m/Input";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import { placeAndWait, waitForRender } from "./test-helpers";

QUnit.module("KioskKeyboard autoShow", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

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

    const internals = kb as unknown as { _onDocumentFocusOut: (event: FocusEvent) => void };
    internals._onDocumentFocusOut(new FocusEvent("focusout"));

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

  const internals = kb as unknown as { _onDocumentFocusOut: (event: FocusEvent) => void };
  internals._onDocumentFocusOut(new FocusEvent("focusout"));

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

  const internals = kb as unknown as { _onDocumentFocusOut: (event: FocusEvent) => void };
  internals._onDocumentFocusOut(new FocusEvent("focusout"));

  kb.destroy();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(true, "No errors after destroy with deferred close pending");

  input.destroy();
});
