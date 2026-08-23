import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import { placeAndWait, getRequiredKeyElement, isShiftActive, tapKey, waitForRender } from "./test-helpers";
import { BACKSPACE_AUTO_REPEAT } from "ui5/kiosk/internal/auto-repeat";

// Integration coverage for the Backspace press-and-hold wiring: ontouchstart
// arms the repeat, the accelerating ticks drive grapheme-aware deletes through
// the real target session, and ontouchend stops the repeat while suppressing
// the trailing single delete. Timing is driven by sinon fake timers; the
// keyboard itself is rendered with real timers first (placeAndWait), then the
// clock is faked only for the hold sequence.

const T = BACKSPACE_AUTO_REPEAT;

function press(kb: KioskKeyboard, el: HTMLElement): void {
  const event = new Event("touchstart", { bubbles: true });
  Object.defineProperty(event, "target", { value: el, writable: false });
  kb.ontouchstart(event);
}

function release(kb: KioskKeyboard, el: HTMLElement): void {
  const event = new Event("touchend", { bubbles: true });
  Object.defineProperty(event, "target", { value: el, writable: false });
  kb.ontouchend(event);
}

QUnit.module("KioskKeyboard backspace auto-repeat", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("press-and-hold deletes repeatedly and stops on release", async (assert) => {
  const input = new Input({ value: "abcdefghij" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  input.focus();
  (input.getFocusDomRef() as HTMLInputElement).setSelectionRange(10, 10);

  const bksp = getRequiredKeyElement(kb, "{backspace}");
  const clock = sinon.useFakeTimers();
  try {
    press(kb, bksp);
    assert.strictEqual(input.getValue(), "abcdefghij", "no delete before the initial hold delay");

    clock.tick(T.initialDelayMs);
    assert.strictEqual(input.getValue(), "abcdefghi", "first repeat deletes one character");

    clock.tick(T.startIntervalMs);
    assert.strictEqual(input.getValue(), "abcdefgh", "second repeat deletes another character");

    clock.tick(1000); // let several accelerated repeats run
    const afterHold = input.getValue();
    assert.ok(afterHold.length < 8, "the hold keeps deleting as it accelerates");

    release(kb, bksp);
    clock.tick(2000);
    assert.strictEqual(input.getValue(), afterHold, "release stops the repeat with no trailing delete");
  } finally {
    clock.restore();
  }

  input.destroy();
  kb.destroy();
});

QUnit.test("a quick tap (release before the delay) deletes exactly once", async (assert) => {
  const input = new Input({ value: "abc" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  input.focus();
  (input.getFocusDomRef() as HTMLInputElement).setSelectionRange(3, 3);

  const bksp = getRequiredKeyElement(kb, "{backspace}");
  const clock = sinon.useFakeTimers();
  try {
    press(kb, bksp);
    clock.tick(T.initialDelayMs - 1); // release before the first repeat
    release(kb, bksp);
    clock.tick(2000);
    assert.strictEqual(input.getValue(), "ab", "exactly one character removed on a quick tap");
  } finally {
    clock.restore();
  }

  input.destroy();
  kb.destroy();
});

QUnit.test("holding over an empty input deletes nothing", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  input.focus();
  (input.getFocusDomRef() as HTMLInputElement).setSelectionRange(0, 0);

  const bksp = getRequiredKeyElement(kb, "{backspace}");
  const clock = sinon.useFakeTimers();
  try {
    press(kb, bksp);
    clock.tick(T.initialDelayMs + 2000);
    release(kb, bksp);
    assert.strictEqual(input.getValue(), "", "empty input is left untouched");
  } finally {
    clock.restore();
  }

  input.destroy();
  kb.destroy();
});

QUnit.test("a disabled keyboard does not auto-repeat", async (assert) => {
  const input = new Input({ value: "abcdef" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()], enabled: false });
  await placeAndWait(kb);

  input.focus();
  (input.getFocusDomRef() as HTMLInputElement).setSelectionRange(6, 6);

  const bksp = getRequiredKeyElement(kb, "{backspace}");
  const clock = sinon.useFakeTimers();
  try {
    press(kb, bksp);
    clock.tick(T.initialDelayMs + 2000);
    release(kb, bksp);
    assert.strictEqual(input.getValue(), "abcdef", "no deletion while the keyboard is disabled");
  } finally {
    clock.restore();
  }

  input.destroy();
  kb.destroy();
});

// The release lives inside `_performBackspaceDelete`, shared by the single tap
// and every repeat tick, so a hold spends the latch rather than leaving it
// armed for whatever the user types next (#240).
//
// Asserted after `clock.restore()` and a real render: `isShiftActive` reads the
// rendered `aria-pressed`, and UI5's re-render never runs while sinon's fake
// timers are installed, so an in-hold assertion would read a stale attribute
// and fail whether or not the latch was spent.
QUnit.test("a held Backspace spends the one-shot Shift", async (assert) => {
  const input = new Input({ value: "abcdef" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  input.focus();
  (input.getFocusDomRef() as HTMLInputElement).setSelectionRange(6, 6);
  await waitForRender();

  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Precondition: Shift is latched");

  const bksp = getRequiredKeyElement(kb, "{backspace}");
  const clock = sinon.useFakeTimers();
  try {
    press(kb, bksp);
    clock.tick(T.initialDelayMs + 1000);
    release(kb, bksp);
  } finally {
    clock.restore();
  }
  await waitForRender();

  // Guards the assertion below against passing for the wrong reason: a hold
  // that deleted nothing would also leave no latch to spend.
  assert.ok(input.getValue().length < 6, "Precondition: the hold actually deleted");
  assert.notOk(isShiftActive(kb), "The hold spends the one-shot Shift");

  input.destroy();
  kb.destroy();
});
