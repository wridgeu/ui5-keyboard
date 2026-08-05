import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { KeyboardType } from "ui5/kiosk/library";
import Input from "sap/m/Input";
import StepInput from "sap/m/StepInput";
import VBox from "sap/m/VBox";
import XMLView from "sap/ui/core/mvc/XMLView";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import {
  getFirstKeyElement,
  getFocusableKeys,
  getKeyboardDom,
  getRowKeys,
  hasKeyboardClass,
  placeAndWait,
  tapKey,
  waitForRender,
} from "./test-helpers";

const DOM = KioskKeyboard.DOM;

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

QUnit.module("KioskKeyboard focus and navigation", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// Home / End key support
// ──────────────────────────────────────────────

QUnit.test("Home key moves focus to first key in row", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const keys = getRowKeys(kb, 0);
  const lastKeyInRow = keys[keys.length - 1];
  const firstKeyInRow = keys[0];

  // Focus the last key in first row
  lastKeyInRow.setAttribute("tabindex", "0");
  lastKeyInRow.focus();

  lastKeyInRow.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", keyCode: 36, bubbles: true }));

  assert.strictEqual(document.activeElement, firstKeyInRow, "Focus moved to first key in row");
  assert.strictEqual(firstKeyInRow.getAttribute("tabindex"), "0", "First key has tabindex=0");
  assert.strictEqual(lastKeyInRow.getAttribute("tabindex"), "-1", "Previous key has tabindex=-1");

  kb.destroy();
});

QUnit.test("End key moves focus to last key in row", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const keys = getRowKeys(kb, 0);
  const firstKeyInRow = keys[0];
  const lastKeyInRow = keys[keys.length - 1];

  // Focus the first key
  firstKeyInRow.setAttribute("tabindex", "0");
  firstKeyInRow.focus();

  firstKeyInRow.dispatchEvent(new KeyboardEvent("keydown", { key: "End", keyCode: 35, bubbles: true }));

  assert.strictEqual(document.activeElement, lastKeyInRow, "Focus moved to last key in row");
  assert.strictEqual(lastKeyInRow.getAttribute("tabindex"), "0", "Last key has tabindex=0");
  assert.strictEqual(firstKeyInRow.getAttribute("tabindex"), "-1", "Previous key has tabindex=-1");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Ctrl+Home / Ctrl+End grid-spanning jumps
// ──────────────────────────────────────────────

QUnit.test("Ctrl+Home jumps focus to first key of first row", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Pick a key in the middle of the grid so the jump is observable.
  const middleRow = getRowKeys(kb, 2);
  const startKey = middleRow[Math.min(2, middleRow.length - 1)];
  startKey.setAttribute("tabindex", "0");
  startKey.focus();

  const firstRowKeys = getRowKeys(kb, 0);
  const expectedFirst = firstRowKeys[0];

  startKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", ctrlKey: true, bubbles: true, cancelable: true }));

  assert.strictEqual(document.activeElement, expectedFirst, "Focus moved to first key of first row");
  assert.strictEqual(expectedFirst.getAttribute("tabindex"), "0", "Target key has tabindex=0");
  assert.strictEqual(startKey.getAttribute("tabindex"), "-1", "Origin key has tabindex=-1");

  kb.destroy();
});

QUnit.test("Ctrl+End jumps focus to last key of last row", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const middleRow = getRowKeys(kb, 2);
  const startKey = middleRow[Math.min(2, middleRow.length - 1)];
  startKey.setAttribute("tabindex", "0");
  startKey.focus();

  const dom = kb.getDomRef() as HTMLElement;
  const allRows = dom.querySelectorAll<HTMLElement>(DOM.selectors.row);
  const lastRow = allRows[allRows.length - 1];
  const lastRowKeys = lastRow.querySelectorAll<HTMLElement>(DOM.selectors.key);
  const expectedLast = lastRowKeys[lastRowKeys.length - 1];

  startKey.dispatchEvent(new KeyboardEvent("keydown", { key: "End", ctrlKey: true, bubbles: true, cancelable: true }));

  assert.strictEqual(document.activeElement, expectedLast, "Focus moved to last key of last row");
  assert.strictEqual(expectedLast.getAttribute("tabindex"), "0", "Target key has tabindex=0");
  assert.strictEqual(startKey.getAttribute("tabindex"), "-1", "Origin key has tabindex=-1");

  kb.destroy();
});

QUnit.test("Ctrl+Home from first key is a no-op", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const firstKey = getFirstKeyElement(kb);
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", ctrlKey: true, bubbles: true, cancelable: true }));

  assert.strictEqual(document.activeElement, firstKey, "Focus stays on the first key");
  assert.strictEqual(firstKey.getAttribute("tabindex"), "0", "tabindex unchanged on no-op");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Arrow key wrapping
// ──────────────────────────────────────────────

QUnit.test("ArrowRight at end of row wraps to next row", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const firstRowKeys = getRowKeys(kb, 0);
  const lastKeyFirstRow = firstRowKeys[firstRowKeys.length - 1];
  const secondRowKeys = getRowKeys(kb, 1);
  const firstKeySecondRow = secondRowKeys[0];

  // Focus the last key in first row
  lastKeyFirstRow.setAttribute("tabindex", "0");
  lastKeyFirstRow.focus();

  lastKeyFirstRow.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", keyCode: 39, bubbles: true }));

  assert.strictEqual(document.activeElement, firstKeySecondRow, "Focus wrapped to first key of next row");

  kb.destroy();
});

QUnit.test("ArrowLeft at start of row wraps to previous row", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const secondRowKeys = getRowKeys(kb, 1);
  const firstKeySecondRow = secondRowKeys[0];
  const firstRowKeys = getRowKeys(kb, 0);
  const lastKeyFirstRow = firstRowKeys[firstRowKeys.length - 1];

  // Focus the first key in second row
  firstKeySecondRow.setAttribute("tabindex", "0");
  firstKeySecondRow.focus();

  firstKeySecondRow.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", keyCode: 37, bubbles: true }));

  assert.strictEqual(document.activeElement, lastKeyFirstRow, "Focus wrapped to last key of previous row");

  kb.destroy();
});

QUnit.test("ArrowDown with column overflow clamps to last key", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType(KeyboardType.Numpad);
  await placeAndWait(kb);

  // Numpad: rows may have different key counts
  // Find a key in a row that has more columns than a later row
  const firstRowKeys = getRowKeys(kb, 0);
  const lastCol = firstRowKeys.length - 1;
  const lastKeyFirstRow = firstRowKeys[lastCol];

  // Focus the last key in first row
  lastKeyFirstRow.setAttribute("tabindex", "0");
  lastKeyFirstRow.focus();

  lastKeyFirstRow.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", keyCode: 40, bubbles: true }));

  // Should land on a key in the second row (clamped if column doesn't exist)
  const secondRowKeys = getRowKeys(kb, 1);
  const expectedTarget = secondRowKeys[Math.min(lastCol, secondRowKeys.length - 1)];
  assert.strictEqual(document.activeElement, expectedTarget, "Focus clamped to last key in target row");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Modified arrow keys not intercepted
// ──────────────────────────────────────────────

QUnit.test("Alt+Arrow keys are not intercepted", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const firstKey = getFirstKeyElement(kb);
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }));
  assert.strictEqual(document.activeElement, firstKey, "Focus unchanged with Alt+Arrow");

  kb.destroy();
});

QUnit.test("Meta+Arrow keys are not intercepted", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const firstKey = getFirstKeyElement(kb);
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  firstKey.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", metaKey: true, bubbles: true }));
  assert.strictEqual(document.activeElement, firstKey, "Focus unchanged with Meta+Arrow");

  kb.destroy();
});

// ──────────────────────────────────────────────
// controls multi-input targeting
// ──────────────────────────────────────────────

QUnit.test("controls resolves controls and registers focus delegation", async (assert) => {
  const input1 = new Input("test-input-1");
  const input2 = new Input("test-input-2");
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: ["test-input-1", "test-input-2"],
  });
  await placeAndWait(kb);

  assert.strictEqual(kb.getControls().length, 2, "controls property has 2 entries");

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

QUnit.test("Focusing a registered input sets it as target", async (assert) => {
  const input1 = new Input("target-input-a");
  const input2 = new Input("target-input-b");
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: ["target-input-a", "target-input-b"],
  });
  await placeAndWait(kb);

  // Focus input2 - should become the target
  const dom2 = input2.getFocusDomRef() as HTMLElement;
  dom2.focus();
  // Wait for delegation to propagate
  await nextUIUpdate();

  assert.strictEqual(kb.getActiveControl()?.getId(), input2.getId(), "Target switched to focused input");

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

QUnit.test("exit() cleans up controls delegates", async (assert) => {
  const input = new Input("cleanup-input");
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: ["cleanup-input"],
  });
  await placeAndWait(kb);

  kb.destroy();

  // If cleanup failed, focusing would throw. Focus and verify no errors.
  const dom = input.getFocusDomRef() as HTMLElement;
  dom.focus();
  dom.blur();

  assert.ok(true, "No errors after destroy with controls");

  input.destroy();
});

// ──────────────────────────────────────────────
// controls control resolution (view-local vs global)
// ──────────────────────────────────────────────

QUnit.test("controls resolves view-local IDs when keyboard is inside a View", async (assert) => {
  const view = await XMLView.create({
    definition: `<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:m="sap.m" xmlns:kiosk="ui5.kiosk">
      <m:Input id="localInput" />
      <kiosk:KioskKeyboard id="kb" controls="localInput" />
    </mvc:View>`,
  });
  view.placeAt("qunit-fixture");
  await waitForRender();

  const kb = view.byId("kb") as KioskKeyboard;
  const input = view.byId("localInput") as Input;

  // Focus the input - delegation should set it as target
  const dom = input.getFocusDomRef() as HTMLElement;
  dom.focus();
  await nextUIUpdate();

  assert.strictEqual(
    kb.getActiveControl()?.getId(),
    input.getId(),
    "View-local input resolved and set as target after focus",
  );

  view.destroy();
});

QUnit.test("controls resolves every entry when the attribute is written with spaces", async (assert) => {
  const view = await XMLView.create({
    definition: `<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:m="sap.m" xmlns:kiosk="ui5.kiosk">
      <m:Input id="firstInput" />
      <m:Input id="secondInput" />
      <kiosk:KioskKeyboard id="kb" controls="firstInput, secondInput" />
    </mvc:View>`,
  });
  view.placeAt("qunit-fixture");
  await waitForRender();

  const kb = view.byId("kb") as KioskKeyboard;
  const second = view.byId("secondInput") as Input;

  // The entry after the comma is the one that carries the space, so it is the one that
  // proves the attribute is read as a token list rather than split verbatim.
  (second.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.strictEqual(
    kb.getActiveControl()?.getId(),
    second.getId(),
    "the entry written after a space is delegated like any other",
  );

  view.destroy();
});

QUnit.test("controls prefers view-local over global when IDs collide", async (assert) => {
  // Create a global control with a short ID that matches the view-local one
  const globalInput = new Input("collisionInput");
  globalInput.placeAt("qunit-fixture");
  await waitForRender();

  const view = await XMLView.create({
    definition: `<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:m="sap.m" xmlns:kiosk="ui5.kiosk">
      <m:Input id="collisionInput" />
      <kiosk:KioskKeyboard id="kb" controls="collisionInput" />
    </mvc:View>`,
  });
  view.placeAt("qunit-fixture");
  await waitForRender();

  const kb = view.byId("kb") as KioskKeyboard;
  const viewLocalInput = view.byId("collisionInput") as Input;

  const dom = viewLocalInput.getFocusDomRef() as HTMLElement;
  dom.focus();
  await nextUIUpdate();

  assert.strictEqual(
    kb.getActiveControl()?.getId(),
    viewLocalInput.getId(),
    "View-local input takes priority over global with same short ID",
  );
  assert.notStrictEqual(kb.getActiveControl()?.getId(), globalInput.getId(), "Global control was NOT selected");

  view.destroy();
  globalInput.destroy();
});

QUnit.test("controls falls back to global when not inside a View", async (assert) => {
  const globalInput = new Input("global-resolution-input");
  globalInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: ["global-resolution-input"],
  });
  await placeAndWait(kb);

  // Focus the input - delegation should set it as target via global fallback
  const dom = globalInput.getFocusDomRef() as HTMLElement;
  dom.focus();
  await nextUIUpdate();

  assert.strictEqual(
    kb.getActiveControl()?.getId(),
    globalInput.getId(),
    "Global input resolved via fallback when keyboard is not inside a View",
  );

  kb.destroy();
  globalInput.destroy();
});

QUnit.test("controls silently skips unresolvable IDs", async (assert) => {
  const input = new Input("real-input");
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: ["nonexistent-input", "real-input"],
  });
  await placeAndWait(kb);

  // Focus the real input - should still work despite the bad ID
  const dom = input.getFocusDomRef() as HTMLElement;
  dom.focus();
  await nextUIUpdate();

  assert.strictEqual(
    kb.getActiveControl()?.getId(),
    input.getId(),
    "Valid input still resolved when mixed with unresolvable IDs",
  );

  kb.destroy();
  input.destroy();
});

QUnit.test("controls deduplicates delegates when aliased IDs resolve to the same control", async (assert) => {
  // Create a view so that "localInput" resolves via view.byId AND via
  // global registry as "myView--localInput" - both should map to the
  // same sap.m.Input instance.
  const view = await XMLView.create({
    id: "myView",
    definition: `<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:m="sap.m" xmlns:kiosk="ui5.kiosk">
      <m:Input id="localInput" />
      <kiosk:KioskKeyboard id="kb" />
    </mvc:View>`,
  });
  view.placeAt("qunit-fixture");
  await nextUIUpdate();

  const input = view.byId("localInput") as Input;
  const kb = view.byId("kb") as KioskKeyboard;

  // Spy on addEventDelegate
  let addCount = 0;
  const origAdd = input.addEventDelegate.bind(input);
  input.addEventDelegate = function (...args: Parameters<typeof origAdd>) {
    addCount++;
    return origAdd(...args);
  };

  // Set controls with both the view-local and the global alias
  kb.setControls(["localInput", "myView--localInput"]);
  await nextUIUpdate();

  // 1 call for focus delegation (deduped despite two aliases) + 1 call for highlight delegation (auto-target)
  assert.strictEqual(
    addCount,
    2,
    "addEventDelegate called twice: once for focus delegation (deduped) + once for highlight delegation (auto-target)",
  );

  view.destroy();
});

QUnit.test("controls removal of one alias keeps delegate when another alias remains", async (assert) => {
  const view = await XMLView.create({
    id: "aliasView",
    definition: `<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:m="sap.m" xmlns:kiosk="ui5.kiosk">
      <m:Input id="sharedInput" />
      <kiosk:KioskKeyboard id="kb" />
    </mvc:View>`,
  });
  view.placeAt("qunit-fixture");
  await nextUIUpdate();

  const input = view.byId("sharedInput") as Input;
  const kb = view.byId("kb") as KioskKeyboard;

  // Register both aliases
  kb.setControls(["sharedInput", "aliasView--sharedInput"]);
  await nextUIUpdate();

  // Spy on removeEventDelegate
  let removeCount = 0;
  const origRemove = input.removeEventDelegate.bind(input);
  input.removeEventDelegate = function (...args: Parameters<typeof origRemove>) {
    removeCount++;
    return origRemove(...args);
  };

  // Remove one alias - delegate should NOT be removed since the other alias still covers it
  kb.setControls(["sharedInput"]);
  await nextUIUpdate();

  assert.strictEqual(removeCount, 0, "removeEventDelegate not called when another alias still covers the control");

  // Focus the input - should still work as a registered controls target
  const dom = input.getFocusDomRef() as HTMLElement;
  dom.focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getActiveControl()?.getId(), input.getId(), "Input still works as target after alias removal");

  view.destroy();
});

QUnit.test("controls works with composite controls (StepInput)", async (assert) => {
  const stepInput = new StepInput("step-input-composite");
  stepInput.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    controls: ["step-input-composite"],
  });
  await placeAndWait(kb);

  // Focus the inner input of StepInput - delegation should resolve to StepInput
  const innerDom = stepInput.getFocusDomRef() as HTMLElement;
  innerDom.focus();
  await nextUIUpdate();

  assert.strictEqual(
    kb.getActiveControl()?.getId(),
    stepInput.getId(),
    "StepInput resolved as target via parent chain",
  );

  stepInput.destroy();
  kb.destroy();
});

QUnit.test("controls rebinds delegate when control is destroyed and recreated with same ID", async (assert) => {
  const box = new VBox("recreate-box");
  box.placeAt("qunit-fixture");

  const input1 = new Input("recreate-input");
  box.addItem(input1);

  // Inline (non-docked, no autoShow) keyboard - only _inputFocusDelegation sets target
  const kb = new KioskKeyboard({
    controls: ["recreate-input"],
  });
  await placeAndWait(kb);

  // Focus input1 → delegate should set target
  (input1.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.strictEqual(kb.getActiveControl()?.getId(), input1.getId(), "Target set for original input instance");

  // Destroy and recreate with same explicit ID
  input1.destroy();
  await nextUIUpdate();

  const input2 = new Input("recreate-input");
  box.addItem(input2);
  await nextUIUpdate();

  // Trigger reconciliation so the new instance gets the delegate
  kb.setControls(["recreate-input"]);

  // Focus the new input - delegate should fire on the new instance
  (input2.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.strictEqual(kb.getActiveControl()?.getId(), input2.getId(), "Target updated to recreated input instance");

  box.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Focus save / restore (getFocusInfo / applyFocusInfo)
// ──────────────────────────────────────────────

QUnit.test("getFocusInfo returns lastFocusedKeyId", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Tap a key to set _lastFocusedKeyId
  tapKey(kb, "q");

  const info = kb.getFocusInfo() as { lastFocusedKeyId: string | null };
  assert.ok(info.lastFocusedKeyId, "lastFocusedKeyId is set after tapping a key");
  assert.ok(info.lastFocusedKeyId!.includes("key-"), "ID looks like a key element ID");

  kb.destroy();
});

QUnit.test("applyFocusInfo restores focus to previously focused key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Tap 'q' to set it as last focused
  tapKey(kb, "q");
  const info = kb.getFocusInfo() as { lastFocusedKeyId: string };

  // Focus something else
  const firstKey = getFirstKeyElement(kb);
  firstKey.setAttribute("tabindex", "0");
  firstKey.focus();

  // Restore focus to the saved key
  kb.applyFocusInfo(info);

  const restoredEl = document.getElementById(info.lastFocusedKeyId);
  assert.strictEqual(document.activeElement, restoredEl, "Focus restored to previously focused key");
  assert.strictEqual(restoredEl!.getAttribute("tabindex"), "0", "Restored key has tabindex=0");

  kb.destroy();
});

QUnit.test("applyFocusInfo falls back to first key when saved key is gone", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Apply focus info with a nonexistent key ID
  kb.applyFocusInfo({ lastFocusedKeyId: "nonexistent-key-id" });

  const firstKey = getFirstKeyElement(kb);
  assert.strictEqual(document.activeElement, firstKey, "Focus falls back to first key");
  assert.strictEqual(firstKey.getAttribute("tabindex"), "0", "First key has tabindex=0");

  kb.destroy();
});

QUnit.test("Layout switch leaves exactly one keyboard-focusable key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "q");
  kb.setLayout("numeric");
  await waitForRender();

  const focusableKeys = getFocusableKeys(kb);
  assert.strictEqual(focusableKeys.length, 1, "Exactly one key remains keyboard-focusable");
  assert.ok(focusableKeys[0].classList.contains(DOM.classes.key), "Focusable key is a rendered keyboard key");

  kb.destroy();
});

QUnit.test("getFocusDomRef returns last focused key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Before any tap, should return the first key
  const initial = kb.getFocusDomRef();
  assert.ok(initial, "getFocusDomRef returns an element before any tap");
  assert.ok(initial!.classList.contains(DOM.classes.key), "Initial focus ref is a key");

  // Tap a specific key
  tapKey(kb, "w");
  const afterTap = kb.getFocusDomRef();
  assert.ok(afterTap, "getFocusDomRef returns an element after tap");
  assert.strictEqual((afterTap as HTMLElement).dataset.key, "w", "Returns the last tapped key");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Focus management - disabled / hidden state
// ──────────────────────────────────────────────

QUnit.test("getFocusInfo includes control id", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const info = kb.getFocusInfo() as { id: string; lastFocusedKeyId: string | null };
  assert.strictEqual(info.id, kb.getId(), "id matches the control's ID");

  kb.destroy();
});

QUnit.test("getFocusDomRef returns null when keyboard is disabled", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  kb.setEnabled(false);
  await waitForRender();

  assert.strictEqual(kb.getFocusDomRef(), null, "getFocusDomRef returns null when disabled");

  kb.destroy();
});

QUnit.test("Programmatic focus() on disabled keyboard does not focus a key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  kb.setEnabled(false);
  await waitForRender();

  kb.focus();
  const dom = kb.getDomRef()!;
  const active = document.activeElement;
  assert.notOk(active && dom.contains(active), "No key inside the keyboard has focus");

  kb.destroy();
});

QUnit.test("applyFocusInfo is a no-op when keyboard is disabled", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "q");
  const info = kb.getFocusInfo() as { lastFocusedKeyId: string };

  kb.setEnabled(false);
  await waitForRender();

  kb.applyFocusInfo(info);

  const focusableKeys = getFocusableKeys(kb);
  assert.strictEqual(focusableKeys.length, 0, "No key has tabindex=0 after applyFocusInfo on disabled keyboard");

  const active = document.activeElement;
  assert.notOk(active && getKeyboardDom(kb).contains(active), "No key inside the keyboard has focus");

  kb.destroy();
});

QUnit.test("Re-render after setEnabled(false) does not leave a focusable key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Focus a key so the framework will attempt focus restoration after re-render
  const firstKey = getFirstKeyElement(kb);
  firstKey.focus();

  kb.setEnabled(false);
  await waitForRender();

  const focusableKeys = getFocusableKeys(kb);
  assert.strictEqual(focusableKeys.length, 0, "No key has tabindex=0 on a disabled keyboard");

  kb.destroy();
});

QUnit.test("getAccessibilityInfo reports focusable=false when disabled", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(kb.getAccessibilityInfo().focusable, true, "focusable is true when enabled");

  kb.setEnabled(false);
  assert.strictEqual(kb.getAccessibilityInfo().focusable, false, "focusable is false when disabled");

  kb.destroy();
});

QUnit.test("setEnabled(false) redirects focus to target input when a key has focus", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  // Focus the input first to activate the target via focus delegation
  input.focus();

  // Focus a key on the keyboard
  const firstKey = getFirstKeyElement(kb);
  firstKey.focus();
  assert.strictEqual(document.activeElement, firstKey, "Key has focus before disabling");

  kb.setEnabled(false);
  await waitForRender();

  assert.strictEqual(
    document.activeElement,
    input.getFocusDomRef(),
    "Focus redirected to target input after disabling",
  );

  input.destroy();
  kb.destroy();
});

QUnit.test("setEnabled(false) without focus on keyboard does not throw", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Focus is not on the keyboard
  kb.setEnabled(false);
  await waitForRender();

  assert.ok(true, "No error when disabling a keyboard that does not have focus");

  kb.destroy();
});

QUnit.test("setEnabled(false) keeps docked keyboard open but disabled", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);
  kb.show();
  assert.ok(kb.isOpen(), "Keyboard is open before disabling");

  kb.setEnabled(false);
  await waitForRender();

  assert.ok(kb.isOpen(), "Docked keyboard stays open (visually greyed out)");
  assert.ok(hasKeyboardClass(kb, DOM.classes.rootDisabled), "Disabled CSS class is applied");

  // Re-enabling restores interaction without needing show()
  kb.setEnabled(true);
  await waitForRender();

  assert.ok(kb.isOpen(), "Keyboard is still open after re-enabling");
  assert.notOk(hasKeyboardClass(kb, DOM.classes.rootDisabled), "Disabled CSS class is removed");

  kb.destroy();
});

QUnit.test("setVisible(false) redirects focus to target input when a key has focus", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  // Focus the input first to activate the target via focus delegation
  input.focus();

  // Focus a key on the keyboard
  const firstKey = getFirstKeyElement(kb);
  firstKey.focus();
  assert.strictEqual(document.activeElement, firstKey, "Key has focus before hiding");

  kb.setVisible(false);
  await waitForRender();

  assert.strictEqual(document.activeElement, input.getFocusDomRef(), "Focus redirected to target input after hiding");

  input.destroy();
  kb.destroy();
});

QUnit.test("setVisible(false) without focus on keyboard does not throw", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  kb.setVisible(false);
  await waitForRender();

  assert.ok(true, "No error when hiding a keyboard that does not have focus");

  kb.destroy();
});

QUnit.test("setEnabled(false) blurs key when no target input is set", async (assert) => {
  const kb = new KioskKeyboard(); // no active target
  await placeAndWait(kb);

  const firstKey = getFirstKeyElement(kb);
  firstKey.focus();
  assert.strictEqual(document.activeElement, firstKey, "Key has focus before disabling");

  kb.setEnabled(false);
  await waitForRender();

  const dom = kb.getDomRef()!;
  assert.notOk(dom.contains(document.activeElement), "Focus is not inside the keyboard");

  kb.destroy();
});

QUnit.test("setVisible(false) closes docked keyboard", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);
  kb.show();
  assert.ok(kb.isOpen(), "Keyboard is open before hiding");

  kb.setVisible(false);
  await waitForRender();

  assert.notOk(kb.isOpen(), "Docked keyboard is closed after hiding");

  kb.destroy();
});

// ──────────────────────────────────────────────
// applyFocusInfo preventScroll
// ──────────────────────────────────────────────

[true, false].forEach((preventScroll) => {
  QUnit.test(`applyFocusInfo fallback focuses the first key (preventScroll: ${preventScroll})`, async (assert) => {
    const kb = new KioskKeyboard();
    await placeAndWait(kb);

    // No lastFocusedKeyId -> fallback path focuses the first key.
    kb.applyFocusInfo({ preventScroll });

    assert.strictEqual(
      document.activeElement,
      getFirstKeyElement(kb),
      "Focus landed on the first key after applyFocusInfo fallback",
    );

    kb.destroy();
  });
});

// ──────────────────────────────────────────────
// show() auto-target
// ──────────────────────────────────────────────

QUnit.test("single controls entry is auto-targeted after rendering", async (assert) => {
  const input = new Input("auto-target-input");
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    controls: ["auto-target-input"],
  });
  await placeAndWait(kb);

  kb.show();
  await nextUIUpdate();

  assert.strictEqual(
    kb.getActiveControl()?.getId(),
    input.getId(),
    "getActiveControl() returns the single controls entry after show()",
  );

  input.destroy();
  kb.destroy();
});
