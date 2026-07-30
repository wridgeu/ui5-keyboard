import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { KeyboardType } from "ui5/kiosk/library";
import Input from "sap/m/Input";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import { placeAndWait } from "./test-helpers";

/**
 * Puts the document into RTL the way OpenUI5 does, by setting `dir` on the
 * document element (`sap/ui/core/boot/initDOM.js`). `sapUiRtl` is a
 * configuration parameter name, not a class the framework applies, so a test
 * that sets it exercises nothing a real app reaches.
 */
function withDocumentRtl(): void {
  document.documentElement.setAttribute("dir", "rtl");
}

function restoreDocumentDir(): void {
  document.documentElement.removeAttribute("dir");
}

QUnit.module("KioskKeyboard events and RTL", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("setKeyboardType fires keyboardTypeChange event", (assert) => {
  const kb = new KioskKeyboard();
  const events: Array<{ keyboardType: string; previousKeyboardType: string; autoDetected: boolean }> = [];

  kb.attachEvent("keyboardTypeChange", (event: { getParameters: () => Record<string, unknown> }) => {
    const params = event.getParameters();
    events.push({
      keyboardType: params.keyboardType as string,
      previousKeyboardType: params.previousKeyboardType as string,
      autoDetected: params.autoDetected as boolean,
    });
  });

  kb.setKeyboardType(KeyboardType.Numpad);

  assert.strictEqual(events.length, 1, "Event fired once");
  assert.strictEqual(events[0].keyboardType, "Numpad", "New type is Numpad");
  assert.strictEqual(events[0].previousKeyboardType, "Full", "Previous type is Full");
  assert.strictEqual(events[0].autoDetected, false, "Not auto-detected");

  kb.destroy();
});

QUnit.test("setKeyboardType does not fire when type is unchanged", (assert) => {
  const kb = new KioskKeyboard();
  let fireCount = 0;

  kb.attachEvent("keyboardTypeChange", () => {
    fireCount++;
  });

  kb.setKeyboardType(KeyboardType.Full);

  assert.strictEqual(fireCount, 0, "Event not fired when type is unchanged");

  kb.destroy();
});

QUnit.test("resetKeyboardType fires keyboardTypeChange when type was different", (assert) => {
  const kb = new KioskKeyboard();
  const events: Array<{ keyboardType: string; previousKeyboardType: string; autoDetected: boolean }> = [];

  kb.setKeyboardType(KeyboardType.Numpad);

  kb.attachEvent("keyboardTypeChange", (event: { getParameters: () => Record<string, unknown> }) => {
    const params = event.getParameters();
    events.push({
      keyboardType: params.keyboardType as string,
      previousKeyboardType: params.previousKeyboardType as string,
      autoDetected: params.autoDetected as boolean,
    });
  });

  kb.resetKeyboardType();

  assert.strictEqual(events.length, 1, "Event fired once");
  assert.strictEqual(events[0].keyboardType, "Full", "New type is Full");
  assert.strictEqual(events[0].previousKeyboardType, "Numpad", "Previous type is Numpad");
  assert.strictEqual(events[0].autoDetected, false, "Not auto-detected");

  kb.destroy();
});

QUnit.test("resetKeyboardType does not fire when already Full", (assert) => {
  const kb = new KioskKeyboard();
  let fireCount = 0;

  kb.attachEvent("keyboardTypeChange", () => {
    fireCount++;
  });

  kb.resetKeyboardType();

  assert.strictEqual(fireCount, 0, "Event not fired when type is unchanged");

  kb.destroy();
});

QUnit.test("autoType fires keyboardTypeChange with autoDetected=true", async (assert) => {
  const input = new Input({ type: "Number" });
  input.placeAt("qunit-fixture");

  const events: Array<{ keyboardType: string; previousKeyboardType: string; autoDetected: boolean }> = [];

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
  });

  kb.attachEvent("keyboardTypeChange", (event: { getParameters: () => Record<string, unknown> }) => {
    const params = event.getParameters();
    events.push({
      keyboardType: params.keyboardType as string,
      previousKeyboardType: params.previousKeyboardType as string,
      autoDetected: params.autoDetected as boolean,
    });
  });

  await placeAndWait(kb);

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.strictEqual(events.length, 1, "Event fired once");
  assert.strictEqual(events[0].keyboardType, "Numpad", "Auto-detected Numpad");
  assert.strictEqual(events[0].previousKeyboardType, "Full", "Was Full before");
  assert.strictEqual(events[0].autoDetected, true, "Flagged as auto-detected");

  input.destroy();
  kb.destroy();
});

QUnit.test("autoType does not fire keyboardTypeChange when type stays Full", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  let fireCount = 0;

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
  });

  kb.attachEvent("keyboardTypeChange", () => {
    fireCount++;
  });

  await placeAndWait(kb);

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.strictEqual(fireCount, 0, "No event when type stays Full");

  input.destroy();
  kb.destroy();
});

QUnit.test("RTL: renders with direction rtl under a document dir of rtl", async (assert) => {
  const kb = new KioskKeyboard();
  withDocumentRtl();
  try {
    await placeAndWait(kb);
    const computed = window.getComputedStyle(kb.getDomRef() as HTMLElement);
    assert.strictEqual(computed.direction, "rtl", "Keyboard has direction: rtl in RTL context");
  } finally {
    restoreDocumentDir();
    kb.destroy();
  }
});

QUnit.test("RTL: renders with direction ltr when not in RTL container", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef() as HTMLElement;
  const computed = window.getComputedStyle(dom);
  assert.strictEqual(computed.direction, "ltr", "Keyboard has direction: ltr by default");

  kb.destroy();
});

QUnit.test("RTL: ArrowRight moves focus to the visually right (lower-index) key", async (assert) => {
  const kb = new KioskKeyboard();
  withDocumentRtl();
  await placeAndWait(kb);

  const origin = document.getElementById(`${kb.getId()}-key-1-1`)!;
  origin.setAttribute("tabindex", "0");
  origin.focus();

  origin.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", keyCode: 39, bubbles: true }));

  assert.strictEqual(
    document.activeElement,
    document.getElementById(`${kb.getId()}-key-1-0`),
    "ArrowRight lands on the neighbour one column lower",
  );

  restoreDocumentDir();
  kb.destroy();
});

QUnit.test("RTL: ArrowLeft moves focus to the visually left (higher-index) key", async (assert) => {
  const kb = new KioskKeyboard();
  withDocumentRtl();
  await placeAndWait(kb);

  const origin = document.getElementById(`${kb.getId()}-key-1-1`)!;
  origin.setAttribute("tabindex", "0");
  origin.focus();

  origin.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", keyCode: 37, bubbles: true }));

  assert.strictEqual(
    document.activeElement,
    document.getElementById(`${kb.getId()}-key-1-2`),
    "ArrowLeft lands on the neighbour one column higher",
  );

  restoreDocumentDir();
  kb.destroy();
});

QUnit.test("LTR: horizontal arrow navigation is not mirrored", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const origin = document.getElementById(`${kb.getId()}-key-1-1`)!;
  origin.setAttribute("tabindex", "0");
  origin.focus();

  origin.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", keyCode: 39, bubbles: true }));
  assert.strictEqual(
    document.activeElement,
    document.getElementById(`${kb.getId()}-key-1-2`),
    "ArrowRight lands on the neighbour one column higher",
  );

  const back = document.getElementById(`${kb.getId()}-key-1-2`)!;
  back.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", keyCode: 37, bubbles: true }));
  assert.strictEqual(
    document.activeElement,
    document.getElementById(`${kb.getId()}-key-1-1`),
    "ArrowLeft lands on the neighbour one column lower",
  );

  kb.destroy();
});
