import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import { placeAndWait, tapKey, waitForRender } from "./test-helpers";

QUnit.module("KioskKeyboard autoshow black-box", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// 1. Docked auto-show open/close
// ──────────────────────────────────────────────

QUnit.test("Docked auto-show opens on input focus and closes via API", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  const dom = () => kb.getDomRef()!;

  assert.notOk(kb.isOpen(), "Keyboard closed initially");
  assert.ok(dom().classList.contains("ui5KioskKeyboard--closed"), "Has closed CSS class initially");

  // Focus input → keyboard opens
  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "Keyboard opens on input focus");
  assert.notOk(dom().classList.contains("ui5KioskKeyboard--closed"), "Closed CSS class removed");
  assert.strictEqual(kb.getTargetInput(), input.getId(), "Target input is set");

  // Close via public API
  kb.close();
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard closed after close()");
  assert.ok(dom().classList.contains("ui5KioskKeyboard--closed"), "Closed CSS class restored");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// 2. Auto-type switch by focused input
// ──────────────────────────────────────────────

QUnit.test("Auto-type switches keyboard type based on focused input", async (assert) => {
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

  // Focus number input → should switch to Numpad
  (numInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  await waitForRender();

  assert.strictEqual(kb.getKeyboardType(), "Numpad", "Switched to Numpad for Number input");
  assert.ok(kb.getDomRef()!.classList.contains("ui5KioskKeyboard--numpad"), "DOM has numpad class after auto-type");

  // Focus text input → should switch back to Full
  (textInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  await waitForRender();

  assert.strictEqual(kb.getKeyboardType(), "Full", "Switched back to Full for text input");
  assert.notOk(kb.getDomRef()!.classList.contains("ui5KioskKeyboard--numpad"), "DOM no longer has numpad class");

  numInput.destroy();
  textInput.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// 3. keyboardTypeChange event contract
// ──────────────────────────────────────────────

QUnit.test("keyboardTypeChange event on auto-detected transitions", async (assert) => {
  const numInput = new Input({ type: "Number" });
  const textInput = new Input();
  numInput.placeAt("qunit-fixture");
  textInput.placeAt("qunit-fixture");

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

  // Focus number input → auto-switch to Numpad
  (numInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.strictEqual(events.length, 1, "One event after focusing number input");
  assert.strictEqual(events[0].keyboardType, "Numpad", "Transitioned to Numpad");
  assert.strictEqual(events[0].previousKeyboardType, "Full", "Was Full before");
  assert.strictEqual(events[0].autoDetected, true, "Flagged as auto-detected");

  // Focus text input → auto-switch back to Full
  (textInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.strictEqual(events.length, 2, "Two events total after focusing text input");
  assert.strictEqual(events[1].keyboardType, "Full", "Transitioned back to Full");
  assert.strictEqual(events[1].previousKeyboardType, "Numpad", "Was Numpad before");
  assert.strictEqual(events[1].autoDetected, true, "Second transition also auto-detected");

  numInput.destroy();
  textInput.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// 4. Re-entrant setTargetInput via change handler
// ──────────────────────────────────────────────

QUnit.test(
  "setTargetInput re-entrancy: change handler focusing another input lands on correct target",
  async (assert) => {
    const inputA = new Input({ value: "" });
    const inputB = new Input({ value: "" });
    const inputC = new Input({ value: "" });
    inputA.placeAt("qunit-fixture");
    inputB.placeAt("qunit-fixture");
    inputC.placeAt("qunit-fixture");

    const kb = new KioskKeyboard({ docked: true, autoShow: true });
    await placeAndWait(kb);

    // Focus inputA → keyboard targets it and opens
    (inputA.getFocusDomRef() as HTMLElement).focus();
    await nextUIUpdate();

    assert.strictEqual(kb.getTargetInput(), inputA.getId(), "Target is inputA after focus");
    assert.ok(kb.isOpen(), "Keyboard is open");

    // Type a character to mark the session dirty (needed for change event)
    tapKey(kb, "x");

    // Attach change handler that synchronously focuses inputC
    // (simulates a validation-then-advance pattern in form-heavy apps)
    inputA.attachChange(() => {
      (inputC.getFocusDomRef() as HTMLElement).focus();
    });

    // Focus inputB → triggers setTargetInput(inputB) → deferred change
    // fires on inputA → handler focuses inputC → setTargetInput(inputC)
    (inputB.getFocusDomRef() as HTMLElement).focus();
    await nextUIUpdate();

    // The final target must be inputC (the last focus destination),
    // NOT inputB (which was superseded by the re-entrant call)
    assert.strictEqual(
      kb.getTargetInput(),
      inputC.getId(),
      "Target is inputC — re-entrant setTargetInput from change handler wins",
    );

    inputA.destroy();
    inputB.destroy();
    inputC.destroy();
    kb.destroy();
  },
);

// ──────────────────────────────────────────────
// 5. Re-entrant setTargetInput preserves auto-type from inner call
// ──────────────────────────────────────────────

QUnit.test(
  "Auto-type re-entrancy: inner call's keyboard type wins over outer call's stale detection",
  async (assert) => {
    // inputA = text (Full), inputB = text (Full), inputC = number (Numpad)
    const inputA = new Input({ value: "" });
    const inputB = new Input({ value: "" });
    const inputC = new Input({ type: "Number", value: "" });
    inputA.placeAt("qunit-fixture");
    inputB.placeAt("qunit-fixture");
    inputC.placeAt("qunit-fixture");

    const kb = new KioskKeyboard({ docked: true, autoShow: true, autoType: true });
    await placeAndWait(kb);

    // Focus inputA → keyboard targets it, auto-type → Full
    (inputA.getFocusDomRef() as HTMLElement).focus();
    await nextUIUpdate();

    assert.strictEqual(kb.getKeyboardType(), "Full", "Starts as Full for text inputA");

    // Type a character to mark the session dirty (needed for change event)
    tapKey(kb, "x");

    // Change handler on A synchronously focuses the number input (inputC)
    inputA.attachChange(() => {
      (inputC.getFocusDomRef() as HTMLElement).focus();
    });

    // Focus inputB (text) → triggers setTargetInput(inputB) → deferred change
    // fires on inputA → handler focuses inputC (number) → setTargetInput(inputC)
    // The inner call should detect Numpad; outer call must NOT overwrite it with Full.
    (inputB.getFocusDomRef() as HTMLElement).focus();
    await nextUIUpdate();

    assert.strictEqual(kb.getTargetInput(), inputC.getId(), "Target is inputC — re-entrant call wins");
    assert.strictEqual(
      kb.getKeyboardType(),
      "Numpad",
      "Keyboard type is Numpad from inputC — outer call did not overwrite",
    );

    inputA.destroy();
    inputB.destroy();
    inputC.destroy();
    kb.destroy();
  },
);
