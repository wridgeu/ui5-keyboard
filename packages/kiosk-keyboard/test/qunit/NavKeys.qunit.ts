import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { FKeyMode } from "ui5/kiosk/library";
import fkeyRow from "ui5/kiosk/layouts/fkey-row";
import navRow from "ui5/kiosk/layouts/nav-row";
import type { LayoutDefinition } from "ui5/kiosk/types";
import Input from "sap/m/Input";
import TextArea from "sap/m/TextArea";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import {
  getFirstKeyElement,
  getKeyboardDom,
  getKeyElement,
  getKeyElements,
  getRequiredKeyElement,
  getRowElements,
  hasKeyClass,
  placeAndWait,
  tapKey,
  waitForRender,
} from "./test-helpers";

const DOM = KioskKeyboard.DOM;

// Composite layout for tests that need both nav row and base layout rows.
const qwertyBase = KioskKeyboard.getRegisteredLayout("qwerty")!;
const qwertyNav: LayoutDefinition = [navRow, ...qwertyBase];

QUnit.module("NavKeys", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("nav is a registered built-in layout", (assert) => {
  assert.ok(KioskKeyboard.isBuiltInLayout("nav"), "nav is built-in");

  const names = KioskKeyboard.getRegisteredLayoutNames();
  assert.ok(names.includes("nav"), "nav in registered names");
});

QUnit.test("nav-row exports 8 navigation key definitions", (assert) => {
  assert.strictEqual(navRow.length, 8, "Row has 8 keys");
  assert.strictEqual(navRow[0].value, "{fkey:Home}", "First key is Home");
  assert.strictEqual(navRow[7].value, "{fkey:ArrowRight}", "Last key is ArrowRight");
  assert.strictEqual(navRow[0].type, "modifier", "Nav-row uses modifier key styling");
});

QUnit.test("Standalone nav layout renders expected keys", async (assert) => {
  const kb = new KioskKeyboard({ layout: "nav" });
  await placeAndWait(kb);

  assert.ok(getKeyElement(kb, "{fkey:ArrowLeft}"), "ArrowLeft rendered");
  assert.ok(getKeyElement(kb, "{fkey:ArrowRight}"), "ArrowRight rendered");
  assert.ok(getKeyElement(kb, "{fkey:ArrowUp}"), "ArrowUp rendered");
  assert.ok(getKeyElement(kb, "{fkey:ArrowDown}"), "ArrowDown rendered");
  assert.ok(getKeyElement(kb, "{fkey:Home}"), "Home rendered");
  assert.ok(getKeyElement(kb, "{fkey:End}"), "End rendered");
  assert.ok(getKeyElement(kb, "{fkey:PageUp}"), "PageUp rendered");
  assert.ok(getKeyElement(kb, "{fkey:PageDown}"), "PageDown rendered");

  kb.destroy();
});

QUnit.test("Nav/fkey icon scales up yet its label stays within the key on wide keys", async (assert) => {
  const kb = new KioskKeyboard({ layout: "nav" });
  await placeAndWait(kb);

  // Widen the keyboard so nav keys are wide enough to drive the fkey icon to its
  // clamp cap (and stay above the 7rem threshold where the label goes sr-only).
  // A dual [data-fkey] key clips its stacked label against its overflow:hidden
  // box once the icon grows too tall.
  const dom = getKeyboardDom(kb);
  dom.style.width = "1200px";
  await nextUIUpdate();

  // Theme-loaded canary: without the stylesheet the geometry below collapses to
  // the browser default and the fit checks would false-pass.
  assert.strictEqual(window.getComputedStyle(getFirstKeyElement(kb)).cursor, "pointer", "theme CSS is loaded");

  const navKeys = Array.from(getKeyElements(kb)).filter((k) => k.hasAttribute("data-fkey"));
  assert.strictEqual(navKeys.length, 8, "eight nav fkey keys rendered");

  let maxKeyWidth = 0;
  for (const navKey of navKeys) {
    const icon = navKey.querySelector<HTMLElement>(`.${DOM.classes.keyIcon}`)!;
    const label = navKey.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`)!;
    const keyRect = navKey.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const name = label.textContent ?? "";
    maxKeyWidth = Math.max(maxKeyWidth, keyRect.width);

    const keyFs = Number.parseFloat(window.getComputedStyle(navKey).fontSize);
    const iconFs = Number.parseFloat(window.getComputedStyle(icon).fontSize);
    assert.ok(
      iconFs > keyFs + 1,
      `"${name}" icon scales past the 1em reset (${iconFs.toFixed(1)} > ${keyFs.toFixed(1)}px)`,
    );
    assert.ok(keyRect.top - iconRect.top <= 0.5, `"${name}" icon does not overflow the key top`);
    assert.ok(labelRect.bottom - keyRect.bottom <= 0.5, `"${name}" label is not clipped at the key bottom`);
  }

  // Non-vacuous: the clip only manifests once keys are wide enough to hit the cap.
  assert.ok(maxKeyWidth > 250, `nav keys are wide (${Math.round(maxKeyWidth)}px), so the icon reaches its cap`);

  kb.destroy();
});

QUnit.test("Nav/fkey icon takes the icon-only bump like every other dual key", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty-nav", instanceLayouts: { "qwerty-nav": qwertyNav } });
  await placeAndWait(kb);

  // Narrow the keyboard until every dual key is under the 7rem threshold where the
  // label goes sr-only and the icon is scaled up to fill the otherwise empty key.
  const dom = getKeyboardDom(kb);
  dom.style.width = "320px";
  await nextUIUpdate();

  const shift = getRequiredKeyElement(kb, "{shift}");
  const shiftLabel = shift.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`)!;
  assert.strictEqual(
    window.getComputedStyle(shiftLabel).clipPath,
    "inset(50%)",
    "keys are narrow enough that dual labels are sr-only",
  );

  const shiftIconFs = Number.parseFloat(
    window.getComputedStyle(shift.querySelector<HTMLElement>(`.${DOM.classes.keyIcon}`)!).fontSize,
  );

  const navKeys = Array.from(getKeyElements(kb)).filter((k) => k.hasAttribute("data-fkey"));
  assert.strictEqual(navKeys.length, 8, "eight nav fkey keys rendered");

  for (const navKey of navKeys) {
    const icon = navKey.querySelector<HTMLElement>(`.${DOM.classes.keyIcon}`)!;
    const name = navKey.getAttribute("data-key") ?? "";
    const iconFs = Number.parseFloat(window.getComputedStyle(icon).fontSize);
    assert.ok(
      Math.abs(iconFs - shiftIconFs) <= 0.5,
      `"${name}" icon matches the Shift icon (${iconFs.toFixed(1)} vs ${shiftIconFs.toFixed(1)}px)`,
    );
  }

  kb.destroy();
});

QUnit.test("Navigation key tap fires keyPress and does not insert text", async (assert) => {
  const input = new Input({ value: "test" });
  const kb = new KioskKeyboard({ layout: "nav", controls: [input.getId()] });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  const events: string[] = [];
  kb.attachEvent("keyPress", (e: any) => {
    events.push((e.getParameter("key") ?? "") as string);
  });

  input.focus();
  await waitForRender();

  tapKey(kb, "{fkey:ArrowLeft}");
  tapKey(kb, "{fkey:PageDown}");
  await waitForRender();

  assert.deepEqual(events, ["ArrowLeft", "PageDown"], "keyPress emits navigation key names");
  assert.strictEqual(input.getValue(), "test", "Input value unchanged");

  input.destroy();
  kb.destroy();
});

QUnit.test("ArrowLeft and ArrowRight move caret in target input", async (assert) => {
  const input = new Input({ value: "55555" });
  const kb = new KioskKeyboard({ layout: "nav", controls: [input.getId()] });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  input.focus();
  await waitForRender();

  const dom = input.getFocusDomRef() as HTMLInputElement;
  dom.setSelectionRange(5, 5);

  tapKey(kb, "{fkey:ArrowLeft}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 4, "ArrowLeft moves caret one position left");

  tapKey(kb, "{fkey:ArrowLeft}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 3, "ArrowLeft moves caret left again");

  tapKey(kb, "{fkey:ArrowRight}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 4, "ArrowRight moves caret one position right");

  input.destroy();
  kb.destroy();
});

QUnit.test("FKeyMode.None fires keyPress but suppresses built-in caret navigation", async (assert) => {
  // Contrast with the default mode (see "ArrowLeft and ArrowRight move caret"),
  // where the same tap moves the caret. FKeyMode.None returns early in
  // FKeyController.handle, so the navigation action never runs.
  const input = new Input({ value: "55555" });
  const kb = new KioskKeyboard({ layout: "nav", controls: [input.getId()] });
  kb.setFKeyMode(FKeyMode.None);
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  input.focus();
  await waitForRender();

  const dom = input.getFocusDomRef() as HTMLInputElement;
  dom.setSelectionRange(3, 3);

  let pressedKey = "";
  kb.attachEvent("keyPress", (e: any) => {
    pressedKey = e.getParameter("key");
  });

  tapKey(kb, "{fkey:ArrowLeft}");
  await waitForRender();

  assert.strictEqual(pressedKey, "ArrowLeft", "keyPress still fires the arrow key in FKeyMode.None");
  assert.strictEqual(dom.selectionStart, 3, "Caret stays put because built-in navigation is suppressed");

  input.destroy();
  kb.destroy();
});

QUnit.test("nav is treated as secondary layout and returns to base via {layout:base}", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty" });
  await placeAndWait(kb);

  kb.setLayout("nav");
  await waitForRender();
  assert.strictEqual(kb.getLayout(), "nav", "Switched to nav");

  tapKey(kb, "{layout:base}");
  await waitForRender();
  assert.strictEqual(kb.getLayout(), "qwerty", "Returned to base qwerty layout");

  kb.destroy();
});

QUnit.test("Consumers can compose fkey-row + nav-row + base layout", async (assert) => {
  const base = KioskKeyboard.getRegisteredLayout("qwerty");
  assert.ok(base, "qwerty base layout exists");
  if (!base) return;

  const composite: LayoutDefinition = [fkeyRow, navRow, ...base];

  const kb = new KioskKeyboard({
    layout: "qwerty-fk-nav-test",
    instanceLayouts: { "qwerty-fk-nav-test": composite },
  });
  await placeAndWait(kb);

  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 7, "Composite layout has 7 rows (fkey + nav + qwerty)");
  assert.ok(getKeyElement(kb, "{fkey:F1}"), "Composite includes fkey row");
  assert.ok(getKeyElement(kb, "{fkey:ArrowLeft}"), "Composite includes nav row");

  kb.destroy();
});

QUnit.test("ArrowUp and ArrowDown move caret vertically in TextArea", async (assert) => {
  const textarea = new TextArea({ value: "abc\ndefgh\nij", rows: 4 });
  const kb = new KioskKeyboard({ layout: "nav", controls: [textarea.getId()] });
  textarea.placeAt("qunit-fixture");
  await placeAndWait(kb);

  textarea.focus();
  await waitForRender();

  const dom = textarea.getFocusDomRef() as HTMLTextAreaElement;
  // Place caret at column 2 of line 2 ("defgh") → position 6 ("abc\nde|fgh\nij")
  dom.setSelectionRange(6, 6);

  // ArrowDown: line 2 col 2 → line 3 col 2 ("ij" has length 2, so clamps to 2)
  tapKey(kb, "{fkey:ArrowDown}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 12, "ArrowDown moves caret to line 3 col 2");

  // ArrowDown at last line → end of value
  tapKey(kb, "{fkey:ArrowDown}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, dom.value.length, "ArrowDown at last line moves to end");

  // Reset to line 2 col 2
  dom.setSelectionRange(6, 6);

  // ArrowUp: line 2 col 2 → line 1 col 2 ("abc" has length 3, col 2 fits)
  tapKey(kb, "{fkey:ArrowUp}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 2, "ArrowUp moves caret to line 1 col 2");

  // ArrowUp at first line → position 0
  tapKey(kb, "{fkey:ArrowUp}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 0, "ArrowUp at first line moves to position 0");

  textarea.destroy();
  kb.destroy();
});

QUnit.test("ArrowDown clamps column to shorter line", async (assert) => {
  const textarea = new TextArea({ value: "abcdef\nhi", rows: 4 });
  const kb = new KioskKeyboard({ layout: "nav", controls: [textarea.getId()] });
  textarea.placeAt("qunit-fixture");
  await placeAndWait(kb);

  textarea.focus();
  await waitForRender();

  const dom = textarea.getFocusDomRef() as HTMLTextAreaElement;
  // Caret at column 5 of line 1 ("abcdef") → position 5
  dom.setSelectionRange(5, 5);

  // ArrowDown to line 2 ("hi" length 2) → should clamp to col 2 → position 9
  tapKey(kb, "{fkey:ArrowDown}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 9, "Column clamped to shorter line length");

  textarea.destroy();
  kb.destroy();
});

QUnit.test("PageUp moves caret to start, PageDown moves to end", async (assert) => {
  const input = new Input({ value: "hello world" });
  const kb = new KioskKeyboard({ layout: "nav", controls: [input.getId()] });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  input.focus();
  await waitForRender();

  const dom = input.getFocusDomRef() as HTMLInputElement;
  dom.setSelectionRange(5, 5);

  tapKey(kb, "{fkey:PageUp}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 0, "PageUp moves caret to position 0");

  tapKey(kb, "{fkey:PageDown}");
  await waitForRender();
  assert.strictEqual(dom.selectionStart, 11, "PageDown moves caret to end of value");

  input.destroy();
  kb.destroy();
});

QUnit.test("Physical Arrow key highlights matching virtual nav key", async (assert) => {
  const input = new Input();
  const kb = new KioskKeyboard({
    layout: "test-qwerty-nav",
    controls: [input.getId()],
    instanceLayouts: { "test-qwerty-nav": qwertyNav },
  });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  const left = getRequiredKeyElement(kb, "{fkey:ArrowLeft}");
  assert.ok(left, "ArrowLeft key exists");

  input.focus();

  input.getFocusDomRef()!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  await nextUIUpdate();
  assert.ok(hasKeyClass(kb, "{fkey:ArrowLeft}", DOM.classes.keyHighlight), "ArrowLeft highlighted on physical keydown");

  input.getFocusDomRef()!.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowLeft", bubbles: true }));
  await nextUIUpdate();
  assert.notOk(hasKeyClass(kb, "{fkey:ArrowLeft}", DOM.classes.keyHighlight), "ArrowLeft unhighlighted on keyup");

  input.destroy();
  kb.destroy();
});
