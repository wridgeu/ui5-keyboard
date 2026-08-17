import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import { hasKeyboardClass, isShiftActive, placeAndWait, tapKey, waitForRender } from "./test-helpers";

const DOM = KioskKeyboard.DOM;

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

  assert.notOk(kb.isOpen(), "Keyboard closed initially");
  assert.ok(hasKeyboardClass(kb, DOM.classes.rootClosed), "Has closed CSS class initially");

  // Focus input → keyboard opens
  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "Keyboard opens on input focus");
  assert.notOk(hasKeyboardClass(kb, DOM.classes.rootClosed), "Closed CSS class removed");
  assert.strictEqual(kb.getActiveControl()?.getId(), input.getId(), "Target input is set");

  // Close via public API
  kb.close();
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard closed after close()");
  assert.ok(hasKeyboardClass(kb, DOM.classes.rootClosed), "Closed CSS class restored");

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
  assert.ok(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "DOM has numpad class after auto-type");

  // Focus text input → should switch back to Full
  (textInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  await waitForRender();

  assert.strictEqual(kb.getKeyboardType(), "Full", "Switched back to Full for text input");
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "DOM no longer has numpad class");

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

  kb.attachKeyboardTypeChange((event) => {
    const params = event.getParameters();
    events.push({
      keyboardType: params.keyboardType!,
      previousKeyboardType: params.previousKeyboardType!,
      autoDetected: params.autoDetected!,
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
// 4. Re-entrant _setActiveTarget via change handler
// ──────────────────────────────────────────────

QUnit.test(
  "_setActiveTarget re-entrancy: change handler focusing another input lands on correct target",
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

    assert.strictEqual(kb.getActiveControl()?.getId(), inputA.getId(), "Target is inputA after focus");
    assert.ok(kb.isOpen(), "Keyboard is open");

    // Type a character to mark the session dirty (needed for change event)
    tapKey(kb, "x");

    // Attach change handler that synchronously focuses inputC
    // (simulates a validation-then-advance pattern in form-heavy apps)
    inputA.attachChange(() => {
      (inputC.getFocusDomRef() as HTMLElement).focus();
    });

    // Focus inputB → triggers _setActiveTarget(inputB) → deferred change
    // fires on inputA → handler focuses inputC → _setActiveTarget(inputC)
    (inputB.getFocusDomRef() as HTMLElement).focus();
    await nextUIUpdate();

    // The final target must be inputC (the last focus destination),
    // NOT inputB (which was superseded by the re-entrant call)
    assert.strictEqual(
      kb.getActiveControl()?.getId(),
      inputC.getId(),
      "Target is inputC - re-entrant _setActiveTarget from change handler wins",
    );

    inputA.destroy();
    inputB.destroy();
    inputC.destroy();
    kb.destroy();
  },
);

QUnit.test("Re-entrant target switch fires activeControlChange once for the final target", async (assert) => {
  const inputA = new Input({ value: "" });
  const inputB = new Input({ value: "" });
  const inputC = new Input({ value: "" });
  inputA.placeAt("qunit-fixture");
  inputB.placeAt("qunit-fixture");
  inputC.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  (inputA.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.strictEqual(kb.getActiveControl()?.getId(), inputA.getId(), "Target is inputA after focus");

  // Type a character to mark the session dirty (needed for change event)
  tapKey(kb, "x");

  // Change handler on A synchronously focuses inputC (re-entrant switch)
  inputA.attachChange(() => {
    (inputC.getFocusDomRef() as HTMLElement).focus();
  });

  const events: string[] = [];
  kb.attachEvent("activeControlChange", (e: { getParameter(name: string): string }) => {
    events.push(e.getParameter("controlId"));
  });

  // Outer switch A→B; its deferred change handler re-enters with B→C. The
  // inner call announces C; the outer call must not announce it again.
  (inputB.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.deepEqual(events, [inputC.getId()], "Exactly one activeControlChange, carrying the final target");

  inputA.destroy();
  inputB.destroy();
  inputC.destroy();
  kb.destroy();
});

QUnit.test("Armed shift survives a same-input refocus (caret reposition)", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  const dom = input.getFocusDomRef() as HTMLElement;
  dom.focus();
  await nextUIUpdate();

  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Shift armed after tapping {shift}");

  // Same-input refocus: blur and immediately refocus, so the focusin path
  // runs _setActiveTarget with an unchanged target.
  dom.blur();
  dom.focus();
  await waitForRender();

  assert.strictEqual(kb.getActiveControl()?.getId(), input.getId(), "Target unchanged after refocus");
  assert.ok(isShiftActive(kb), "Shift is still armed after refocusing the same input");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// 5. Re-entrant _setActiveTarget preserves auto-type from inner call
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

    // Focus inputB (text) → triggers _setActiveTarget(inputB) → deferred change
    // fires on inputA → handler focuses inputC (number) → _setActiveTarget(inputC)
    // The inner call should detect Numpad; outer call must NOT overwrite it with Full.
    (inputB.getFocusDomRef() as HTMLElement).focus();
    await nextUIUpdate();

    assert.strictEqual(kb.getActiveControl()?.getId(), inputC.getId(), "Target is inputC - re-entrant call wins");
    assert.strictEqual(
      kb.getKeyboardType(),
      "Numpad",
      "Keyboard type is Numpad from inputC - outer call did not overwrite",
    );

    inputA.destroy();
    inputB.destroy();
    inputC.destroy();
    kb.destroy();
  },
);

// ──────────────────────────────────────────────
// 6. Composition middleware is committed on target switch
// ──────────────────────────────────────────────

QUnit.test(
  "Composition middleware commits to the old target on target switch (no leak into the new target)",
  async (assert) => {
    const inputA = new Input({ value: "" });
    const inputB = new Input({ value: "" });
    inputA.placeAt("qunit-fixture");
    inputB.placeAt("qunit-fixture");

    const kb = new KioskKeyboard({ docked: true, autoShow: true, layout: "ko-hangul" });
    await placeAndWait(kb);

    const domA = inputA.getFocusDomRef() as HTMLInputElement;
    const domB = inputB.getFocusDomRef() as HTMLInputElement;

    // Focus inputA → keyboard targets it and opens
    domA.focus();
    await nextUIUpdate();
    assert.strictEqual(kb.getActiveControl()?.getId(), inputA.getId(), "Target is inputA after focus");

    // Compose a partial syllable in inputA: ㅎ + ㅏ → 하 (still composing)
    tapKey(kb, "ㅎ");
    tapKey(kb, "ㅏ");
    assert.strictEqual(domA.value, "하", "inputA shows composing 하 (preedit live)");

    // Switch target to inputB mid-composition
    domB.focus();
    await nextUIUpdate();
    assert.strictEqual(kb.getActiveControl()?.getId(), inputB.getId(), "Target switched to inputB");

    // The in-progress syllable must be committed to inputA, not abandoned
    assert.strictEqual(domA.value, "하", "inputA keeps the committed 하 after the target switch");

    // The next keypress starts a FRESH composition on inputB; inputA's state
    // must not leak (the bug produced 한 in inputB and corrupted offsets).
    tapKey(kb, "ㄴ");
    assert.strictEqual(domB.value, "ᄂ", "inputB starts fresh with ㄴ (leading jamo), no leak from inputA");
    assert.strictEqual(domA.value, "하", "inputA is unchanged by typing into inputB");

    inputA.destroy();
    inputB.destroy();
    kb.destroy();
  },
);
