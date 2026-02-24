import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import fkeyRow from "ui5/kiosk/layouts/fkey-row";
import navRow from "ui5/kiosk/layouts/nav-row";
import type { LayoutDefinition } from "ui5/kiosk/types";
import Input from "sap/m/Input";
import TextArea from "sap/m/TextArea";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import { placeAndWait, tapKey, waitForRender } from "./test-helpers";

QUnit.module("NavKeys", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("nav and *-nav variants are registered built-in layouts", (assert) => {
  assert.ok(KioskKeyboard.isBuiltInLayout("nav"), "nav is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("qwerty-nav"), "qwerty-nav is built-in");
  assert.ok(KioskKeyboard.isBuiltInLayout("qwertz-de-nav"), "qwertz-de-nav is built-in");

  const names = KioskKeyboard.getRegisteredLayoutNames();
  assert.ok(names.includes("nav"), "nav in registered names");
  assert.ok(names.includes("qwerty-nav"), "qwerty-nav in registered names");
  assert.ok(names.includes("qwertz-de-nav"), "qwertz-de-nav in registered names");
});

QUnit.test("nav-row exports 8 navigation key definitions", (assert) => {
  assert.strictEqual(navRow.length, 8, "Row has 8 keys");
  assert.strictEqual(navRow[0].value, "{fkey:Home}", "First key is Home");
  assert.strictEqual(navRow[7].value, "{fkey:ArrowRight}", "Last key is ArrowRight");
});

QUnit.test("Standalone nav layout renders expected keys", async (assert) => {
  const kb = new KioskKeyboard({ layout: "nav" });
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  assert.ok(dom.querySelector('[data-key="{fkey:ArrowLeft}"]'), "ArrowLeft rendered");
  assert.ok(dom.querySelector('[data-key="{fkey:ArrowRight}"]'), "ArrowRight rendered");
  assert.ok(dom.querySelector('[data-key="{fkey:ArrowUp}"]'), "ArrowUp rendered");
  assert.ok(dom.querySelector('[data-key="{fkey:ArrowDown}"]'), "ArrowDown rendered");
  assert.ok(dom.querySelector('[data-key="{fkey:Home}"]'), "Home rendered");
  assert.ok(dom.querySelector('[data-key="{fkey:End}"]'), "End rendered");
  assert.ok(dom.querySelector('[data-key="{fkey:PageUp}"]'), "PageUp rendered");
  assert.ok(dom.querySelector('[data-key="{fkey:PageDown}"]'), "PageDown rendered");

  kb.destroy();
});

QUnit.test("Navigation key tap fires keyPress and does not insert text", async (assert) => {
  const input = new Input({ value: "test" });
  const kb = new KioskKeyboard({ layout: "nav", targetInput: input });
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
  const kb = new KioskKeyboard({ layout: "nav", targetInput: input });
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
  KioskKeyboard.registerLayout("qwerty-fk-nav-test", composite);

  const kb = new KioskKeyboard({ layout: "qwerty-fk-nav-test" });
  await placeAndWait(kb);

  const rows = kb.getDomRef()!.querySelectorAll(".ui5KioskRow");
  assert.strictEqual(rows.length, 7, "Composite layout has 7 rows (fkey + nav + qwerty)");
  assert.ok(kb.getDomRef()!.querySelector('[data-key="{fkey:F1}"]'), "Composite includes fkey row");
  assert.ok(kb.getDomRef()!.querySelector('[data-key="{fkey:ArrowLeft}"]'), "Composite includes nav row");

  kb.destroy();
});

QUnit.test("ArrowUp and ArrowDown move caret vertically in TextArea", async (assert) => {
  const textarea = new TextArea({ value: "abc\ndefgh\nij", rows: 4 });
  const kb = new KioskKeyboard({ layout: "nav", targetInput: textarea });
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
  const kb = new KioskKeyboard({ layout: "nav", targetInput: textarea });
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
  const kb = new KioskKeyboard({ layout: "nav", targetInput: input });
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
  const kb = new KioskKeyboard({ layout: "qwerty-nav", targetInput: input });
  input.placeAt("qunit-fixture");
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const left = dom.querySelector('[data-key="{fkey:ArrowLeft}"]') as HTMLElement;
  assert.ok(left, "ArrowLeft key exists");

  input.focus();

  input.getFocusDomRef()!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  await nextUIUpdate();
  assert.ok(left.classList.contains("ui5KioskKey--highlight"), "ArrowLeft highlighted on physical keydown");

  input.getFocusDomRef()!.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowLeft", bubbles: true }));
  await nextUIUpdate();
  assert.notOk(left.classList.contains("ui5KioskKey--highlight"), "ArrowLeft unhighlighted on keyup");

  input.destroy();
  kb.destroy();
});
