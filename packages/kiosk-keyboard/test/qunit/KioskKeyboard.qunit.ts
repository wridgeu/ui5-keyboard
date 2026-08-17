import CustomLayout from "ui5/kiosk/CustomLayout";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { KeyboardType, MobileKeyboard } from "ui5/kiosk/library";
import Control from "sap/ui/core/Control";
import Input from "sap/m/Input";
import type RenderManager from "sap/ui/core/RenderManager";
import TextArea from "sap/m/TextArea";
import Popover from "sap/m/Popover";
import VBox from "sap/m/VBox";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import {
  createFakeKeyElement,
  freezeDoubleClickWindow,
  getFirstKeyElement,
  getFocusableKeys,
  getKeyElement,
  placeAndWait,
  getKeyElements,
  getKeyboardDom,
  getRenderedKeyLabel,
  getRequiredKeyElement,
  getRowElements,
  hasKeyboardClass,
  hasKeyClass,
  isCapsLock,
  isShiftActive,
  simulateTap,
  tapKey,
  waitForRender,
} from "./test-helpers";

const DOM = KioskKeyboard.DOM;

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

QUnit.module("KioskKeyboard", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// Properties
// ──────────────────────────────────────────────

QUnit.test("Default property values", (assert) => {
  const kb = new KioskKeyboard();

  assert.strictEqual(kb.getLayout(), "qwerty", "Default layout is qwerty");
  assert.strictEqual(kb.getKeyboardType(), "Full", "Default keyboardType is Full");
  assert.strictEqual(kb.getEnabled(), true, "Default enabled is true");
  assert.strictEqual(kb.getAriaLabel(), "", "Default ariaLabel is empty (resolved from i18n at render)");
  assert.strictEqual(kb.getDocked(), false, "Default docked is false");

  kb.destroy();
});

QUnit.test("DOM contract is frozen", (assert) => {
  assert.ok(Object.isFrozen(KioskKeyboard.DOM), "Root DOM contract object is frozen");
  assert.ok(Object.isFrozen(KioskKeyboard.DOM.classes), "DOM classes map is frozen");
  assert.ok(Object.isFrozen(KioskKeyboard.DOM.attributes), "DOM attributes map is frozen");
  assert.ok(Object.isFrozen(KioskKeyboard.DOM.selectors), "DOM selectors map is frozen");
});

QUnit.test("Modifier/action icon keys honor modifierFontSize", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = getKeyboardDom(kb);
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  dom.style.setProperty("--ui5KioskKeyboard-keyFontSize", "2rem");
  dom.style.setProperty("--ui5KioskKeyboard-modifierFontSize", "0.5rem");
  await nextUIUpdate();

  const shiftIcon = getRequiredKeyElement(kb, "{shift}").querySelector<HTMLElement>(".sapUiIcon");
  const enterIcon = getRequiredKeyElement(kb, "{enter}").querySelector<HTMLElement>(".sapUiIcon");

  assert.ok(shiftIcon, "Shift key renders an icon");
  assert.ok(enterIcon, "Enter key renders an icon");
  assert.ok(
    Math.abs(Number.parseFloat(window.getComputedStyle(shiftIcon!).fontSize) - 0.5 * remPx) <= 0.25,
    "Shift icon follows modifierFontSize",
  );
  assert.ok(
    Math.abs(Number.parseFloat(window.getComputedStyle(enterIcon!).fontSize) - 0.5 * remPx) <= 0.25,
    "Enter icon follows modifierFontSize",
  );

  kb.destroy();
});

// ──────────────────────────────────────────────
// Rendering
// ──────────────────────────────────────────────

QUnit.test("Renders with default properties", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = getKeyboardDom(kb);
  assert.ok(dom, "Control is rendered");
  assert.ok(hasKeyboardClass(kb, DOM.classes.root), "Has root CSS class");
  assert.strictEqual(dom.getAttribute("role"), "group", "Root has role=group");
  assert.strictEqual(dom.getAttribute("aria-label"), "Virtual Keyboard", "Default aria-label");
  assert.strictEqual(dom.getAttribute("aria-roledescription"), "keyboard", "Root has aria-roledescription");
  assert.strictEqual(dom.getAttribute("data-sap-ui-fastnavgroup"), "true", "F6 group enabled");

  const keys = getKeyElements(kb);
  assert.ok(keys.length > 0, "Keys are rendered");

  // First key should have tabindex=0 (roving tabindex)
  assert.strictEqual(keys[0].getAttribute("tabindex"), "0", "First key has tabindex=0");
  // Second key should have tabindex=-1
  assert.strictEqual(keys[1].getAttribute("tabindex"), "-1", "Other keys have tabindex=-1");

  kb.destroy();
});

QUnit.test("Renders rows matching QWERTY layout", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 5, "QWERTY layout has 5 rows");

  kb.destroy();
});

QUnit.test("Renders custom ariaLabel", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setAriaLabel("Custom Label");
  await placeAndWait(kb);

  assert.strictEqual(getKeyboardDom(kb).getAttribute("aria-label"), "Custom Label", "Custom aria-label rendered");

  kb.destroy();
});

QUnit.test("Disabled state renders correctly", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setEnabled(false);
  await placeAndWait(kb);

  const dom = getKeyboardDom(kb);
  assert.ok(hasKeyboardClass(kb, DOM.classes.rootDisabled), "Has disabled CSS class");
  assert.strictEqual(dom.getAttribute("aria-disabled"), "true", "Root has aria-disabled");

  assert.strictEqual(getFirstKeyElement(kb).getAttribute("aria-disabled"), "true", "Keys have aria-disabled");

  const focusableKeys = getFocusableKeys(kb);
  assert.strictEqual(focusableKeys.length, 0, "No key is keyboard-focusable when disabled");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Key labels and shift
// ──────────────────────────────────────────────

QUnit.test("Rendered key shows its label or value", async (assert) => {
  const kb = new KioskKeyboard({
    layout: "test-labels",
    customLayouts: [
      new CustomLayout({ name: "test-labels", rows: [[{ value: "x" }, { value: "y", label: "Custom" }]] }),
    ],
  });
  await placeAndWait(kb);

  assert.strictEqual(getRenderedKeyLabel(kb, "x"), "x", "Key without explicit label shows value");
  assert.strictEqual(getRenderedKeyLabel(kb, "y"), "Custom", "Key with explicit label shows label");

  kb.destroy();
});

QUnit.test("Rendered key labels update to shift variants when shift active", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();

  assert.strictEqual(getRenderedKeyLabel(kb, "a"), "A", "Shifted single char is uppercase");
  assert.strictEqual(getRenderedKeyLabel(kb, "1"), "!", "Shifted key shows shift variant");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Shift / Caps Lock toggle
// ──────────────────────────────────────────────

QUnit.test("Shift toggles: off -> shift -> caps -> off", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.notOk(isShiftActive(kb), "Initially not shifted");
  assert.notOk(isCapsLock(kb), "Initially no caps lock");

  const clock = freezeDoubleClickWindow();
  try {
    tapKey(kb, "{shift}");
    await waitForRender();
    assert.ok(isShiftActive(kb), "After first tap: shift active");
    assert.notOk(isCapsLock(kb), "After first tap: not caps lock");

    tapKey(kb, "{shift}");
    await waitForRender();
    assert.ok(isShiftActive(kb), "After second tap: still active (caps)");
    assert.ok(isCapsLock(kb), "After second tap: caps lock on");

    tapKey(kb, "{shift}");
    await waitForRender();
    assert.notOk(isShiftActive(kb), "After third tap: shift off");
    assert.notOk(isCapsLock(kb), "After third tap: caps lock off");
  } finally {
    clock.restore();
  }

  kb.destroy();
});

QUnit.test("Shift auto-releases after character key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Shift is active");

  tapKey(kb, "q");
  await waitForRender();
  assert.notOk(isShiftActive(kb), "Shift auto-released after character");

  kb.destroy();
});

QUnit.test("Caps Lock does NOT auto-release after character key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Double-tap shift for caps lock
  tapKey(kb, "{shift}");
  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isCapsLock(kb), "Caps lock is on");

  tapKey(kb, "q");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Still shifted after character");
  assert.ok(isCapsLock(kb), "Caps lock still on");

  kb.destroy();
});

QUnit.test("Shift key renders active class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const shiftKey = getKeyElement(kb, "{shift}");
  assert.ok(shiftKey, "Shift key exists");
  assert.notOk(hasKeyClass(kb, "{shift}", DOM.classes.keyShiftActive), "Shift not active initially");

  tapKey(kb, "{shift}");

  // Wait for re-render
  await waitForRender();

  assert.ok(getKeyElement(kb, "{shift}"), "Shift key still exists after re-render");
  assert.ok(hasKeyClass(kb, "{shift}", DOM.classes.keyShiftActive), "Shift key has active class");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Key press event
// ──────────────────────────────────────────────

QUnit.test("keyPress event fires on character key tap", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const done = assert.async();
  kb.attachKeyPress((event) => {
    assert.strictEqual(event.getParameter("key"), "q", "Key is 'q'");
    assert.strictEqual(event.getParameter("shiftKey"), false, "shiftKey is false");
    done();
  });

  tapKey(kb, "q");
  kb.destroy();
});

QUnit.test("keyPress event fires shifted value", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");

  const done = assert.async();
  kb.attachKeyPress((event) => {
    assert.strictEqual(event.getParameter("key"), "Q", "Shifted key is 'Q'");
    assert.strictEqual(event.getParameter("shiftKey"), true, "shiftKey is true");
    done();
  });

  tapKey(kb, "q");
  kb.destroy();
});

QUnit.test("keyPress event fires shift value for number keys", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");

  const done = assert.async();
  kb.attachKeyPress((event) => {
    assert.strictEqual(event.getParameter("key"), "!", "Shift+1 produces !");
    done();
  });

  tapKey(kb, "1");
  kb.destroy();
});

QUnit.test("keyPress event fires for Backspace", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const done = assert.async();
  kb.attachKeyPress((event) => {
    assert.strictEqual(event.getParameter("key"), "Backspace", "Key is Backspace");
    done();
  });

  tapKey(kb, "{backspace}");
  kb.destroy();
});

QUnit.test("keyPress event fires for Enter", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const done = assert.async();
  kb.attachKeyPress((event) => {
    assert.strictEqual(event.getParameter("key"), "Enter", "Key is Enter");
    done();
  });

  tapKey(kb, "{enter}");
  kb.destroy();
});

QUnit.test("keyPress preventDefault skips input insertion", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  kb.attachEvent("keyPress", (event: { preventDefault(): void }) => {
    event.preventDefault();
  });

  tapKey(kb, "q");
  assert.strictEqual(input.getValue(), "", "Value unchanged after preventDefault");

  // preventDefault is per-event, not a latch that arms once: a second key must
  // still be suppressed by the same handler.
  tapKey(kb, "y");
  assert.strictEqual(input.getValue(), "", "Still unchanged for second key");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Target input integration
// ──────────────────────────────────────────────

QUnit.test("Typing into target sap.m.Input", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  tapKey(kb, "h");
  tapKey(kb, "i");

  assert.strictEqual(input.getValue(), "hi", "Input value updated");

  input.destroy();
  kb.destroy();
});

QUnit.test("Typing into a target whose ID was supplied with surrounding whitespace", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  // The settings path never parses, so this is the layer a type's parse hook cannot
  // reach: a padded ID handed over programmatically, or delivered by a model binding.
  const kb = new KioskKeyboard({ controls: [` ${input.getId()}`] });
  await placeAndWait(kb);

  tapKey(kb, "h");
  tapKey(kb, "i");

  assert.strictEqual(input.getValue(), "hi", "the padded ID still resolves to the input");

  input.destroy();
  kb.destroy();
});

QUnit.test("Backspace deletes last character from target input", async (assert) => {
  const input = new Input({ value: "abc" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  tapKey(kb, "{backspace}");

  assert.strictEqual(input.getValue(), "ab", "Last character deleted");

  input.destroy();
  kb.destroy();
});

// Two discrete taps from an explicit caret, not the auto-repeat path: the
// session has to advance its own cursor after the first delete, or the second
// deletes the wrong character.
QUnit.test("Consecutive backspaces delete from the tracked caret", async (assert) => {
  const input = new Input({ value: "abc" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  input.focus();
  (input.getFocusDomRef() as HTMLInputElement).setSelectionRange(3, 3);

  tapKey(kb, "{backspace}");
  assert.strictEqual(input.getValue(), "ab", "One character removed by backspace");

  tapKey(kb, "{backspace}");
  assert.strictEqual(input.getValue(), "a", "Second backspace removes another character");

  input.destroy();
  kb.destroy();
});

QUnit.test("Space key inserts a space character", async (assert) => {
  const input = new Input({ value: "hi" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  input.focus();
  (input.getFocusDomRef() as HTMLInputElement).setSelectionRange(2, 2);

  tapKey(kb, " ");
  assert.strictEqual(input.getValue(), "hi ", "Space character appended");

  input.destroy();
  kb.destroy();
});

QUnit.test("Enter does nothing for single-line Input", async (assert) => {
  const input = new Input({ value: "abc" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  tapKey(kb, "{enter}");

  assert.strictEqual(input.getValue(), "abc", "Input value unchanged after Enter");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Enabled / disabled
// ──────────────────────────────────────────────

QUnit.test("Disabled keyboard ignores tap events", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setEnabled(false);
  await placeAndWait(kb);

  let keyPressed = false;
  kb.attachEvent("keyPress", () => {
    keyPressed = true;
  });

  const fakeEl = createFakeKeyElement("a", "fake-key");

  simulateTap(kb, fakeEl);

  assert.notOk(keyPressed, "No keyPress event when disabled");

  kb.destroy();
});

QUnit.test("Disabled keyboard ignores keyboard events", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setEnabled(false);
  await placeAndWait(kb);

  let keyPressed = false;
  kb.attachEvent("keyPress", () => {
    keyPressed = true;
  });

  const fakeTarget = createFakeKeyElement("a");

  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
  Object.defineProperty(event, "target", { value: fakeTarget, writable: false });
  kb.onsapselect(event);

  assert.notOk(keyPressed, "No keyPress event from keyboard when disabled");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Target setting does not trigger re-render
// ──────────────────────────────────────────────

QUnit.test("controls auto-target does not trigger re-render", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  kb.placeAt("qunit-fixture");
  await waitForRender();

  const domBefore = kb.getDomRef();
  assert.ok(domBefore, "Keyboard is rendered after controls auto-target");

  // Wait a tick to let any potential async re-render occur
  await nextUIUpdate();

  // Should still be the same DOM ref (no re-render from suppressInvalidate)
  assert.strictEqual(kb.getDomRef(), domBefore, "DOM ref unchanged after auto-target");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Auto-show
// ──────────────────────────────────────────────

/**
 * The `AbortSignal` a listener was registered with, or `undefined` when the call
 * carried none. Detachment runs through `signal.abort()`, so a listener whose signal
 * never aborts is a leaked listener.
 */
function signalOf(call: sinon.SinonSpyCall | undefined): AbortSignal | undefined {
  const signal: unknown = call?.args[2]?.signal;
  return signal instanceof AbortSignal ? signal : undefined;
}

QUnit.test("exit() cleans up auto-show listeners", async (assert) => {
  assert.expect(4);
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  // Spy the document listener seam so detachment is asserted directly, not via a
  // no-throw smoke test (a leaked focus listener is otherwise unobservable).
  const addSpy = sinon.spy(document, "addEventListener");

  kb.setAutoShow(true);

  const focusInSignal = signalOf(addSpy.getCalls().find((c) => c.args[0] === "focusin"));
  const focusOutSignal = signalOf(addSpy.getCalls().find((c) => c.args[0] === "focusout"));
  assert.notOk(focusInSignal?.aborted, "setAutoShow(true) attaches a live document focusin listener");
  assert.notOk(focusOutSignal?.aborted, "setAutoShow(true) attaches a live document focusout listener");

  kb.destroy();
  addSpy.restore();

  assert.ok(focusInSignal?.aborted, "destroy detaches the focusin listener");
  assert.ok(focusOutSignal?.aborted, "destroy detaches the focusout listener");
});

QUnit.test("exit() removes escape key listener", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  // Spy the document listener seam so detachment is asserted directly, not via a
  // no-throw smoke test (a leaked keydown listener is otherwise unobservable).
  const addSpy = sinon.spy(document, "addEventListener");

  kb.show();
  assert.ok(kb.isOpen(), "Keyboard is open");

  const escapeCall = addSpy
    .getCalls()
    .find((c) => c.args[0] === "keydown" && (c.args[2] as AddEventListenerOptions | undefined)?.capture === true);
  const escapeSignal = signalOf(escapeCall);
  assert.notOk(escapeSignal?.aborted, "show() attaches a live capturing document keydown listener");

  kb.destroy();
  addSpy.restore();

  assert.ok(escapeSignal?.aborted, "destroy detaches the capturing keydown listener");
});

// ──────────────────────────────────────────────
// liveChange event parameters
// ──────────────────────────────────────────────

QUnit.test("fireLiveChange receives value parameter", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const done = assert.async();
  input.attachLiveChange((event) => {
    assert.strictEqual(event.getParameter("value"), "a", "value parameter is correct");
    done();
  });

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  tapKey(kb, "a");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Enter fires change on single-line Input
// ──────────────────────────────────────────────

QUnit.test("Enter key fires change event on target sap.m.Input", async (assert) => {
  const input = new Input({ value: "hello" });
  input.placeAt("qunit-fixture");

  const done = assert.async();
  input.attachChange((event) => {
    assert.strictEqual(event.getParameter("value"), "hello", "change fired with correct value");
    done();
  });

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  tapKey(kb, "{enter}");

  input.destroy();
  kb.destroy();
});

QUnit.test("Enter key does not fire change on TextArea (inserts newline instead)", async (assert) => {
  const textarea = new TextArea({ value: "line1" });
  textarea.placeAt("qunit-fixture");

  let changeFired = false;
  textarea.attachChange(() => {
    changeFired = true;
  });

  const kb = new KioskKeyboard({ controls: [textarea.getId()] });
  await placeAndWait(kb);

  tapKey(kb, "{enter}");
  assert.strictEqual(textarea.getValue(), "line1\n", "Newline inserted");
  assert.notOk(changeFired, "change event not fired on TextArea");

  textarea.destroy();
  kb.destroy();
});

QUnit.test("change fires on close after typing", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  let changeValue: string | undefined;
  input.attachChange((event) => {
    changeValue = event.getParameter("value");
  });

  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
  await placeAndWait(kb);
  kb.show();

  tapKey(kb, "a");
  tapKey(kb, "b");
  kb.close();

  assert.strictEqual(changeValue, "ab", "change fired with correct value on close");

  input.destroy();
  kb.destroy();
});

QUnit.test("change does NOT fire on close without typing", async (assert) => {
  const input = new Input({ value: "hello" });
  input.placeAt("qunit-fixture");

  let changeFired = false;
  input.attachChange(() => {
    changeFired = true;
  });

  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
  await placeAndWait(kb);
  kb.show();
  kb.close();

  assert.notOk(changeFired, "change not fired when nothing was typed");

  input.destroy();
  kb.destroy();
});

QUnit.test("change fires on active target switch after typing", async (assert) => {
  const input1 = new Input({ value: "" });
  const input2 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  let changeValue: string | undefined;
  input1.attachChange((event) => {
    changeValue = event.getParameter("value");
  });

  const kb = new KioskKeyboard({ controls: [input1.getId(), input2.getId()] });
  await placeAndWait(kb);

  input1.focus();
  await nextUIUpdate();

  tapKey(kb, "x");
  input2.focus();
  await nextUIUpdate();

  assert.strictEqual(changeValue, "x", "change fired on input1 when switching to input2");

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

QUnit.test("change doesn't double-fire after Enter then close", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  let changeCount = 0;
  input.attachChange(() => {
    changeCount++;
  });

  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
  await placeAndWait(kb);
  kb.show();

  tapKey(kb, "a");
  tapKey(kb, "{enter}");
  kb.close();

  assert.strictEqual(changeCount, 1, "change fired exactly once (by Enter, not again on close)");

  input.destroy();
  kb.destroy();
});

QUnit.test("change NOT fired for TextArea on close", async (assert) => {
  const textarea = new TextArea({ value: "" });
  textarea.placeAt("qunit-fixture");

  let changeFired = false;
  textarea.attachChange(() => {
    changeFired = true;
  });

  const kb = new KioskKeyboard({ docked: true, controls: [textarea.getId()] });
  await placeAndWait(kb);
  kb.show();

  tapKey(kb, "a");
  kb.close();

  assert.notOk(changeFired, "change not fired for TextArea on close");

  textarea.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Physical keyboard highlighting
// ──────────────────────────────────────────────

QUnit.test("Physical keydown adds highlight class to matching key", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  assert.notOk(hasKeyClass(kb, "q", DOM.classes.keyHighlight), "No highlight initially");

  // Simulate physical keydown on the target input via delegation
  // The delegation uses onkeydown which is called by UI5's event delegation
  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));

  // Allow event delegation to process
  await nextUIUpdate();

  assert.ok(hasKeyClass(kb, "q", DOM.classes.keyHighlight), "Highlight class added on keydown");

  input.destroy();
  kb.destroy();
});

QUnit.test("Physical keyup removes highlight class", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));
  await nextUIUpdate();
  assert.ok(hasKeyClass(kb, "q", DOM.classes.keyHighlight), "Highlight present after keydown");

  inputDom.dispatchEvent(new KeyboardEvent("keyup", { key: "q", bubbles: true }));
  await nextUIUpdate();
  assert.notOk(hasKeyClass(kb, "q", DOM.classes.keyHighlight), "Highlight removed after keyup");

  input.destroy();
  kb.destroy();
});

QUnit.test("Changing target input moves highlight delegation", async (assert) => {
  const registered = new Input({ value: "" });
  const unregistered = new Input({ value: "" });
  registered.placeAt("qunit-fixture");
  unregistered.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [registered.getId()] });
  await placeAndWait(kb);

  // Keydown on unregistered input should NOT highlight (not targeted)
  const unregDom = unregistered.getFocusDomRef() as HTMLElement;
  unregDom.focus();
  unregDom.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));
  await nextUIUpdate();
  assert.notOk(hasKeyClass(kb, "q", DOM.classes.keyHighlight), "Unregistered input keydown does not highlight");

  // Keydown on registered input SHOULD highlight (targeted via auto-target)
  const regDom = registered.getFocusDomRef() as HTMLElement;
  regDom.focus();
  regDom.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));
  await nextUIUpdate();
  assert.ok(hasKeyClass(kb, "q", DOM.classes.keyHighlight), "Registered target keydown does highlight");

  registered.destroy();
  unregistered.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Physical keyboard shift/CapsLock sync
// ──────────────────────────────────────────────

QUnit.test("Physical Shift keydown syncs virtual shift state", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  assert.notOk(isShiftActive(kb), "Shift is not active initially");

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true, bubbles: true }));
  await nextUIUpdate();

  assert.ok(isShiftActive(kb), "Virtual shift state synced from physical Shift keydown");

  input.destroy();
  kb.destroy();
});

QUnit.test("Physical Shift keyup releases virtual shift state", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();

  // Press Shift down first
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true, bubbles: true }));
  await nextUIUpdate();
  assert.ok(isShiftActive(kb), "Shift is active after keydown");

  // Release Shift
  inputDom.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", shiftKey: false, bubbles: true }));
  await nextUIUpdate();
  assert.notOk(isShiftActive(kb), "Shift released after physical Shift keyup");

  input.destroy();
  kb.destroy();
});

QUnit.test("Physical key with CapsLock modifier syncs virtual CapsLock state", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  assert.notOk(isCapsLock(kb), "CapsLock is not active initially");

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();

  // Simulate a keydown with CapsLock active via getModifierState.
  // Native KeyboardEvent constructor does not support getModifierState
  // directly, so we create the event and override the method.
  const event = new KeyboardEvent("keydown", { key: "a", bubbles: true });
  Object.defineProperty(event, "getModifierState", {
    value: (modifier: string) => modifier === "CapsLock",
  });
  inputDom.dispatchEvent(event);
  await nextUIUpdate();

  assert.ok(isShiftActive(kb), "Virtual shift state is active (CapsLock implies shifted)");
  assert.ok(isCapsLock(kb), "Virtual CapsLock state synced from physical keyboard");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Popover integration (consumption scenario)
// ──────────────────────────────────────────────

QUnit.test("Keyboard renders inside a Popover", async (assert) => {
  const trigger = document.createElement("button");
  trigger.id = "popover-trigger";
  document.getElementById("qunit-fixture")!.appendChild(trigger);

  const input = new Input({ value: "" });
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  const popover = new Popover({
    title: "Kiosk Input",
    contentWidth: "360px",
    content: [new VBox({ items: [input, kb] })],
  });

  try {
    popover.openBy(trigger);
    await waitForRender();

    assert.ok(popover.isOpen(), "Popover is open");
    assert.ok(kb.getDomRef(), "Keyboard is rendered inside popover");

    const keys = getKeyElements(kb);
    assert.ok(keys.length > 0, "Keyboard keys are rendered");
  } finally {
    popover.close();
    await waitForRender();
    popover.destroy();
  }
});

QUnit.test("Typing into input inside a Popover", async (assert) => {
  const trigger = document.createElement("button");
  trigger.id = "popover-trigger-typing";
  document.getElementById("qunit-fixture")!.appendChild(trigger);

  const input = new Input({ value: "" });
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  const popover = new Popover({
    title: "Kiosk Input",
    contentWidth: "360px",
    content: [new VBox({ items: [input, kb] })],
  });

  try {
    popover.openBy(trigger);
    await waitForRender();

    input.focus();

    tapKey(kb, "h");
    tapKey(kb, "i");
    assert.strictEqual(input.getValue(), "hi", "Typing works inside popover");

    tapKey(kb, "{shift}");
    tapKey(kb, "a");
    assert.strictEqual(input.getValue(), "hiA", "Shift works inside popover");

    tapKey(kb, "{backspace}");
    assert.strictEqual(input.getValue(), "hi", "Backspace works inside popover");
  } finally {
    popover.close();
    await waitForRender();
    popover.destroy();
  }
});

QUnit.test("Popover stays open while interacting with keyboard", async (assert) => {
  const trigger = document.createElement("button");
  trigger.id = "popover-trigger-focus";
  document.getElementById("qunit-fixture")!.appendChild(trigger);

  const input = new Input({ value: "" });
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  const popover = new Popover({
    title: "Kiosk Input",
    contentWidth: "360px",
    content: [new VBox({ items: [input, kb] })],
  });

  try {
    popover.openBy(trigger);
    await waitForRender();

    input.focus();

    // Tap several keys - popover should remain open
    tapKey(kb, "a");
    tapKey(kb, "b");
    tapKey(kb, "c");

    await nextUIUpdate();
    assert.ok(popover.isOpen(), "Popover stays open during keyboard interaction");
    assert.strictEqual(input.getValue(), "abc", "Input value accumulated correctly");
  } finally {
    popover.close();
    await waitForRender();
    popover.destroy();
  }
});

// ──────────────────────────────────────────────
// Caps Lock visual indicator
// ──────────────────────────────────────────────

QUnit.test("Caps Lock renders lock icon on shift key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Double-tap shift for caps lock
  tapKey(kb, "{shift}");
  tapKey(kb, "{shift}");

  await waitForRender();
  assert.ok(isCapsLock(kb), "Caps lock is on");

  const shiftKey = getRequiredKeyElement(kb, "{shift}");
  assert.ok(hasKeyClass(kb, "{shift}", DOM.classes.keyCapsLock), "Shift key has capsLock CSS class");
  assert.ok(hasKeyClass(kb, "{shift}", DOM.classes.keyShiftActive), "Shift key also has active CSS class");

  // Should render a lock icon (sapUiIcon element)
  const icon = shiftKey.querySelector(".sapUiIcon");
  assert.ok(icon, "Lock icon is rendered inside shift key");

  // Visible label changes to "Caps Lock" during CapsLock state
  assert.strictEqual(
    shiftKey.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "Caps Lock",
    "Visible label is Caps Lock",
  );

  kb.destroy();
});

QUnit.test("Caps Lock ring is visible over the modifier key (light-DOM specificity)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Theme-loaded guard: `.ui5KioskKey` unconditionally sets `cursor: pointer`.
  // If the compiled theme CSS is absent from this harness, every box-shadow
  // reads "none" and the ring assertion below would be vacuously green.
  const plainKey = getRequiredKeyElement(kb, "a");
  assert.strictEqual(window.getComputedStyle(plainKey).cursor, "pointer", "theme CSS is loaded");

  tapKey(kb, "{shift}");
  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isCapsLock(kb), "Caps lock is on");

  // The ring animates in over a 0.1s box-shadow transition; cancel it so
  // getComputedStyle reads the settled cascade winner, not a mid-transition frame.
  const shiftKey = getRequiredKeyElement(kb, "{shift}");
  shiftKey.style.transition = "none";
  void shiftKey.offsetHeight;

  // The caps-lock indicator is a `0 0 0 2px` ring (zero offset/blur, 2px spread).
  // The modifier key's own drop-shadow has offset/blur, so a 2px-spread shadow
  // proves the ring wins the cascade against the modifier styling.
  const shadow = window.getComputedStyle(shiftKey).boxShadow;
  assert.ok(/\b0px 0px 0px 2px\b/.test(shadow), `caps-lock ring is visible (got: ${shadow})`);

  kb.destroy();
});

QUnit.test("Glyph font-override is scoped to key labels and does not leak in the light DOM", async (assert) => {
  // Rendering the control loads the compiled theme stylesheet into the page.
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const addSpan = (apply: (el: HTMLElement) => void): HTMLElement => {
    const el = document.createElement("span");
    el.textContent = "あ"; // Hiragana あ, a CJK glyph
    apply(el);
    document.body.appendChild(el);
    return el;
  };

  const plain = addSpan(() => {});
  const scoped = addSpan((el) => {
    el.className = DOM.classes.keyLabel;
    el.setAttribute(DOM.attributes.glyphScript, "cjk");
  });
  const bare = addSpan((el) => el.setAttribute(DOM.attributes.glyphScript, "cjk"));

  const plainFont = window.getComputedStyle(plain).fontFamily;
  const scopedFont = window.getComputedStyle(scoped).fontFamily;
  const bareFont = window.getComputedStyle(bare).fontFamily;

  // Guard against a vacuous pass: the label-scoped rule must actually swap in the
  // CJK stack, proving the theme CSS is loaded and the selector matches. Without
  // this the leak assertion below would be meaningless on a stylesheet-less harness.
  assert.notStrictEqual(scopedFont, plainFont, ".ui5KioskKey__label[data-glyph-script] applies the CJK font stack");

  // The rule is namespaced to the label class, so a bare [data-glyph-script]
  // element elsewhere in the light DOM must be untouched.
  assert.strictEqual(bareFont, plainFont, "a bare [data-glyph-script] element is unaffected by the keyboard styles");

  plain.remove();
  scoped.remove();
  bare.remove();
  kb.destroy();
});

QUnit.test("Arabic keycaps turn the isol feature off and no other label does", async (assert) => {
  // A keycap is a specimen, so the font's `isol` lookup must not restyle it into a
  // joining form. `font-feature-settings` inherits, so the declaration has to sit on the
  // Arabic labels alone: on the label class or the keyboard root it would turn the
  // feature off for every keycap in the layout. The arabic number row renders Western
  // digits, so the unscoped label that guards against that always exists.
  const kb = new KioskKeyboard({ layout: "arabic" });
  await placeAndWait(kb);

  const dom = getKeyboardDom(kb);
  const arabicLabel = dom.querySelector<HTMLElement>(
    `.${DOM.classes.keyLabel}[${DOM.attributes.glyphScript}="arabic"]`,
  )!;
  const plainLabel = dom.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}:not([${DOM.attributes.glyphScript}])`)!;

  assert.strictEqual(
    window.getComputedStyle(arabicLabel).fontFeatureSettings,
    '"isol" 0',
    "an arabic keycap turns isol off",
  );
  assert.strictEqual(
    window.getComputedStyle(plainLabel).fontFeatureSettings,
    "normal",
    "a label with no glyph script keeps the font default",
  );

  kb.destroy();
});

QUnit.test("Shift toggle works via keyboard (Enter key)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const shiftKey = getRequiredKeyElement(kb, "{shift}");

  // Simulate Enter keydown on the Shift key
  const pressEnter = () => {
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    shiftKey.dispatchEvent(event);
  };

  // Off → Shift
  pressEnter();
  await waitForRender();
  assert.ok(isShiftActive(kb), "Shift active after first Enter");
  assert.notOk(isCapsLock(kb), "Not caps lock yet");

  // Shift → Caps Lock
  pressEnter();
  await waitForRender();
  assert.ok(isCapsLock(kb), "Caps Lock after second Enter");

  // Caps Lock → Off
  pressEnter();
  await waitForRender();
  assert.notOk(isShiftActive(kb), "Shift off after third Enter");
  assert.notOk(isCapsLock(kb), "Caps Lock off after third Enter");

  kb.destroy();
});

QUnit.test("Single Shift does NOT show capsLock class or lock icon", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Shift is active");
  assert.notOk(isCapsLock(kb), "Caps lock is NOT on");

  const shiftKey = getRequiredKeyElement(kb, "{shift}");
  assert.ok(hasKeyClass(kb, "{shift}", DOM.classes.keyShiftActive), "Has active class");
  assert.notOk(hasKeyClass(kb, "{shift}", DOM.classes.keyCapsLock), "No capsLock class");

  // Should render arrow-top icon, not the lock icon used for caps lock
  const icon = shiftKey.querySelector(".sapUiIcon");
  assert.ok(icon, "Shift icon is rendered");
  assert.strictEqual(icon!.getAttribute("aria-label"), "arrow-top", "Shows arrow icon, not lock icon");
  assert.strictEqual(
    shiftKey.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "Shift",
    "Visible label is Shift",
  );

  kb.destroy();
});

// ──────────────────────────────────────────────
// Highlight fix for shifted characters
// ──────────────────────────────────────────────

QUnit.test("Physical Shift+1 highlights the '1' key via data-shift-value", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  assert.notOk(hasKeyClass(kb, "1", DOM.classes.keyHighlight), "No highlight initially");

  // Simulate typing "!" (Shift+1) on physical keyboard
  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "!", bubbles: true }));
  await nextUIUpdate();

  assert.ok(hasKeyClass(kb, "1", DOM.classes.keyHighlight), "'1' key highlighted when '!' typed");

  inputDom.dispatchEvent(new KeyboardEvent("keyup", { key: "!", bubbles: true }));
  await nextUIUpdate();

  assert.notOk(hasKeyClass(kb, "1", DOM.classes.keyHighlight), "Highlight removed on keyup");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Popover integration (continued)
// ──────────────────────────────────────────────

QUnit.test("Layout switching works inside a Popover", async (assert) => {
  // Trigger must be visible on-screen so the Popover can reposition after
  // the layout switch changes the keyboard's content height.
  // (Offscreen triggers cause _applyPosition to close the Popover.)
  const trigger = document.createElement("button");
  trigger.id = "popover-trigger-layout";
  trigger.style.cssText = "position:fixed;top:50px;left:50px";
  document.body.appendChild(trigger);

  const input = new Input({ value: "" });
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  const popover = new Popover({
    title: "Kiosk Input",
    contentWidth: "360px",
    content: [new VBox({ items: [input, kb] })],
  });

  try {
    popover.openBy(trigger);
    await waitForRender();

    // Verify QWERTY is active
    let keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.ok(keys.includes("q"), "QWERTY layout initially");

    // Switch to numeric
    tapKey(kb, "{layout:numeric}");
    await waitForRender();

    keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.notOk(keys.includes("q"), "Numeric layout after switch");
    assert.ok(popover.isOpen(), "Popover still open after layout switch");
  } finally {
    popover.close();
    await waitForRender();
    popover.destroy();
    trigger.remove();
  }
});

// ──────────────────────────────────────────────
// setAutoShow property setter
// ──────────────────────────────────────────────

QUnit.test("setAutoShow(true) activates auto-show listeners", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  // Enable auto-show via the property setter (not enableAutoShow directly)
  kb.setAutoShow(true);

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "Keyboard opens after setAutoShow(true)");

  input.destroy();
  kb.destroy();
});

QUnit.test("setAutoShow(false) deactivates auto-show listeners", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  // Disable auto-show via the property setter
  kb.setAutoShow(false);

  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.notOk(kb.isOpen(), "Keyboard does not open after setAutoShow(false)");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Backspace with selection
// ──────────────────────────────────────────────

QUnit.test("Backspace deletes selected text range", async (assert) => {
  const input = new Input({ value: "abcde" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  // Select "bcd" (positions 1-4)
  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  inputDom.focus();
  inputDom.setSelectionRange(1, 4);

  tapKey(kb, "{backspace}");
  assert.strictEqual(input.getValue(), "ae", "Selected range deleted");

  input.destroy();
  kb.destroy();
});

QUnit.test("Backspace at position 0 does nothing", async (assert) => {
  const input = new Input({ value: "abc" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  // Place cursor at position 0
  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  inputDom.focus();
  inputDom.setSelectionRange(0, 0);

  tapKey(kb, "{backspace}");
  assert.strictEqual(input.getValue(), "abc", "Value unchanged when backspace at position 0");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Typing with cursor in the middle
// ──────────────────────────────────────────────

QUnit.test("Typing inserts at cursor position, not at end", async (assert) => {
  const input = new Input({ value: "ac" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  // Place cursor between 'a' and 'c'
  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  inputDom.focus();
  inputDom.setSelectionRange(1, 1);

  tapKey(kb, "b");
  assert.strictEqual(input.getValue(), "abc", "Character inserted at cursor position");

  input.destroy();
  kb.destroy();
});

QUnit.test("Typing replaces selected text", async (assert) => {
  const input = new Input({ value: "hello" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  // Select "ell"
  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  inputDom.focus();
  inputDom.setSelectionRange(1, 4);

  tapKey(kb, "a");
  assert.strictEqual(input.getValue(), "hao", "Selected text replaced by typed character");

  input.destroy();
  kb.destroy();
});

QUnit.test("Programmatic setValue while unfocused resets cached cursor to end", async (assert) => {
  const input = new Input({ value: "abcd" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLInputElement;
  inputDom.focus();
  inputDom.setSelectionRange(1, 1);
  tapKey(kb, "x");
  assert.strictEqual(input.getValue(), "axbcd", "Initial insert used the focused caret position");

  inputDom.blur();
  input.setValue("12345");

  tapKey(kb, "y");
  assert.strictEqual(input.getValue(), "12345y", "Insert after external setValue appends at end when unfocused");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Keyboard activation (Enter / Space via onsapselect)
// ──────────────────────────────────────────────

QUnit.test("Enter on focused key activates it via onsapselect", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);
  input.focus();
  await waitForRender();

  const aKey = getRequiredKeyElement(kb, "a");
  aKey.setAttribute("tabindex", "0");
  aKey.focus();

  aKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await waitForRender();

  assert.strictEqual(input.getValue(), "a", "Enter on focused 'a' key inserts 'a'");

  input.destroy();
  kb.destroy();
});

QUnit.test("Space on focused key activates it via onsapselect", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);
  input.focus();
  await waitForRender();

  const bKey = getRequiredKeyElement(kb, "b");
  bKey.setAttribute("tabindex", "0");
  bKey.focus();

  bKey.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
  await waitForRender();

  assert.strictEqual(input.getValue(), "b", "Space on focused 'b' key inserts 'b'");

  input.destroy();
  kb.destroy();
});

QUnit.test("Ctrl+Space on focused key does NOT activate (modifier filtering)", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);
  input.focus();
  await waitForRender();

  const aKey = getRequiredKeyElement(kb, "a");
  aKey.setAttribute("tabindex", "0");
  aKey.focus();

  aKey.dispatchEvent(new KeyboardEvent("keydown", { key: " ", ctrlKey: true, bubbles: true, cancelable: true }));
  await waitForRender();

  assert.strictEqual(input.getValue(), "", "Ctrl+Space does NOT activate the focused key");

  input.destroy();
  kb.destroy();
});

QUnit.test("Shift+Enter on focused key does NOT activate (modifier filtering)", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);
  input.focus();
  await waitForRender();

  const aKey = getRequiredKeyElement(kb, "a");
  aKey.setAttribute("tabindex", "0");
  aKey.focus();

  aKey.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true }));
  await waitForRender();

  assert.strictEqual(input.getValue(), "", "Shift+Enter does NOT activate the focused key");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Pressed-state safety net (window blur)
// ──────────────────────────────────────────────

QUnit.test("Window blur clears stuck keyPressed state", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const qKey = getRequiredKeyElement(kb, "q");

  const start = new Event("touchstart", { bubbles: true });
  Object.defineProperty(start, "target", { value: qKey, writable: false });
  kb.ontouchstart(start);

  assert.ok(hasKeyClass(kb, "q", DOM.classes.keyPressed), "Pressed class is applied on touchstart");

  // Simulate user Alt-Tabbing away while still holding the mouse button:
  // window blur fires without ontouchend ever firing.
  window.dispatchEvent(new Event("blur"));

  assert.notOk(hasKeyClass(kb, "q", DOM.classes.keyPressed), "Pressed class is cleared on window blur");

  kb.destroy();
});

QUnit.test("Window blur safety listener is detached on touchend", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const qKey = getRequiredKeyElement(kb, "q");

  // Spy the window listener seam so detachment is asserted directly, not via a
  // no-throw smoke test (a stacked/leaked listener clears already-clear state
  // and is otherwise unobservable).
  const addSpy = sinon.spy(window, "addEventListener");

  const start = new Event("touchstart", { bubbles: true });
  Object.defineProperty(start, "target", { value: qKey, writable: false });
  kb.ontouchstart(start);

  const blurSignal = signalOf(addSpy.getCalls().find((c) => c.args[0] === "blur"));
  assert.notOk(blurSignal?.aborted, "touchstart attaches a live window blur safety listener");

  const end = new Event("touchend", { bubbles: true });
  Object.defineProperty(end, "target", { value: qKey, writable: false });
  kb.ontouchend(end);
  addSpy.restore();

  assert.ok(blurSignal?.aborted, "touchend detaches the blur listener (no stacking across taps)");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Tap cancellation (drag away)
// ──────────────────────────────────────────────

QUnit.test("Tap cancelled when release is on a different key", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  let keyPressed = false;
  kb.attachEvent("keyPress", () => {
    keyPressed = true;
  });

  const qKey = getRequiredKeyElement(kb, "q");
  const wKey = getRequiredKeyElement(kb, "w");

  // Press on 'q', release on 'w'
  const start = new Event("touchstart", { bubbles: true });
  Object.defineProperty(start, "target", { value: qKey, writable: false });
  kb.ontouchstart(start);

  const end = new Event("touchend", { bubbles: true });
  Object.defineProperty(end, "target", { value: wKey, writable: false });
  kb.ontouchend(end);

  assert.notOk(keyPressed, "No keyPress when drag away from original key");

  kb.destroy();
});

QUnit.test("Touch cancel clears pressed state and prevents activation", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  let keyPressed = false;
  kb.attachEvent("keyPress", () => {
    keyPressed = true;
  });

  const key = getRequiredKeyElement(kb, "q");

  const start = new Event("touchstart", { bubbles: true });
  Object.defineProperty(start, "target", { value: key, writable: false });
  kb.ontouchstart(start);
  assert.ok(hasKeyClass(kb, "q", DOM.classes.keyPressed), "Pressed state is applied on touchstart");

  kb.ontouchcancel();
  assert.notOk(hasKeyClass(kb, "q", DOM.classes.keyPressed), "Pressed state is cleared on touchcancel");

  const end = new Event("touchend", { bubbles: true });
  Object.defineProperty(end, "target", { value: key, writable: false });
  kb.ontouchend(end);

  assert.notOk(keyPressed, "No keyPress after cancelled touch");

  kb.destroy();
});

QUnit.test("Touch handlers ignore non-element event targets", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  let keyPressed = false;
  kb.attachEvent("keyPress", () => {
    keyPressed = true;
  });

  const start = new Event("touchstart", { bubbles: true });
  Object.defineProperty(start, "target", { value: window, writable: false });
  kb.ontouchstart(start);

  const end = new Event("touchend", { bubbles: true });
  Object.defineProperty(end, "target", { value: window, writable: false });
  kb.ontouchend(end);

  assert.notOk(keyPressed, "No keyPress for non-element touch targets");

  kb.destroy();
});

// ──────────────────────────────────────────────
// No target input - typing does not throw
// ──────────────────────────────────────────────

QUnit.test("Typing with no target input does not throw", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // No target set - tap should not throw
  tapKey(kb, "a");
  tapKey(kb, "{backspace}");
  tapKey(kb, " ");
  tapKey(kb, "{enter}");

  assert.ok(true, "No errors when typing without a target input");

  kb.destroy();
});

// ──────────────────────────────────────────────
// QWERTZ-DE Shift Symbols Highlight
// ──────────────────────────────────────────────

QUnit.test('Physical "\\\"" highlights "2" key (Shift+2 on QWERTZ-DE)', async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ layout: "qwertz-de", controls: [input.getId()] });
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: '"', bubbles: true }));
  await nextUIUpdate();

  assert.ok(hasKeyClass(kb, "2", DOM.classes.keyHighlight), "Key '2' highlighted for '\"'");

  inputDom.dispatchEvent(new KeyboardEvent("keyup", { key: '"', bubbles: true }));
  await nextUIUpdate();
  assert.notOk(hasKeyClass(kb, "2", DOM.classes.keyHighlight), "Highlight removed on release");

  input.destroy();
  kb.destroy();
});

QUnit.test('Physical "/" highlights "7" key (Shift+7 on QWERTZ-DE)', async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ layout: "qwertz-de", controls: [input.getId()] });
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
  await nextUIUpdate();

  assert.ok(hasKeyClass(kb, "7", DOM.classes.keyHighlight), "Key '7' highlighted for '/'");

  inputDom.dispatchEvent(new KeyboardEvent("keyup", { key: "/", bubbles: true }));
  await nextUIUpdate();
  assert.notOk(hasKeyClass(kb, "7", DOM.classes.keyHighlight), "Highlight removed on release");

  input.destroy();
  kb.destroy();
});

QUnit.test('Physical "\u00DC" (capital U-umlaut) highlights "\u00FC" key', async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ layout: "qwertz-de", controls: [input.getId()] });
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "\u00DC", bubbles: true }));
  await nextUIUpdate();

  assert.ok(hasKeyClass(kb, "\u00FC", DOM.classes.keyHighlight), "\u00FC key highlighted for capital \u00DC");

  inputDom.dispatchEvent(new KeyboardEvent("keyup", { key: "\u00DC", bubbles: true }));
  await nextUIUpdate();
  assert.notOk(hasKeyClass(kb, "\u00FC", DOM.classes.keyHighlight), "Highlight removed");

  input.destroy();
  kb.destroy();
});

QUnit.test('Physical "\u00FC" (lowercase) highlights its own key directly', async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ layout: "qwertz-de", controls: [input.getId()] });
  await placeAndWait(kb);

  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "\u00FC", bubbles: true }));
  await nextUIUpdate();

  assert.ok(hasKeyClass(kb, "\u00FC", DOM.classes.keyHighlight), "\u00FC key highlighted directly");

  inputDom.dispatchEvent(new KeyboardEvent("keyup", { key: "\u00FC", bubbles: true }));
  await nextUIUpdate();
  assert.notOk(hasKeyClass(kb, "\u00FC", DOM.classes.keyHighlight), "Highlight removed");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Target Input Destroyed While Open
// ──────────────────────────────────────────────

QUnit.test("Destroying target while open: tap/backspace/enter/close do not throw", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
  await placeAndWait(kb);
  kb.show();

  input.destroy();

  tapKey(kb, "a");
  tapKey(kb, "{backspace}");
  tapKey(kb, "{enter}");
  kb.close();

  assert.ok(true, "No errors after target input destroyed");

  kb.destroy();
});

QUnit.test("New input focused after target destroyed adopts correctly via autoShow", async (assert) => {
  const input1 = new Input();
  const input2 = new Input();
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);
  await waitForRender();

  // Focus input1 triggers autoShow
  (input1.getFocusDomRef() as HTMLElement).focus();
  await waitForRender();

  // Destroy input1 while keyboard is open
  input1.destroy();

  // Focus input2 - autoShow should adopt it without error
  (input2.getFocusDomRef() as HTMLElement).focus();
  await waitForRender();

  assert.ok(kb.isOpen(), "Keyboard remains open after adopting a new input");
  assert.strictEqual(kb.getActiveControl()?.getId(), input2.getId(), "Target switched to the newly focused input");

  input2.destroy();
  kb.destroy();
});

QUnit.test("Switching target while open suppresses new target inputmode and restores on close", async (assert) => {
  const input1 = new Input();
  const input2 = new Input();
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: MobileKeyboard.Custom,
  });
  await placeAndWait(kb);

  const inputDom2 = input2.getFocusDomRef() as HTMLInputElement;
  const originalInputMode2 = inputDom2.getAttribute("inputmode");

  // Focus input1 to open the keyboard and set target via autoShow
  (input1.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "Keyboard opened via autoShow");

  // Focus input2 to switch target while open
  (input2.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getActiveControl()?.getId(), input2.getId(), "Target switches to input2");
  assert.strictEqual(inputDom2.getAttribute("inputmode"), "none", "New target inputmode suppressed after switch");

  kb.close();
  if (originalInputMode2 !== null) {
    assert.strictEqual(
      inputDom2.getAttribute("inputmode"),
      originalInputMode2,
      "Original inputmode restored after close",
    );
  } else {
    assert.notOk(inputDom2.hasAttribute("inputmode"), "inputmode attribute removed after close");
  }

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Shift State on Numpad/Numeric
// ──────────────────────────────────────────────

QUnit.test("Numpad has no shift key rendered", async (assert) => {
  const kb = new KioskKeyboard({ keyboardType: KeyboardType.Numpad });
  await placeAndWait(kb);

  const shiftKey = getKeyElement(kb, "{shift}");
  assert.notOk(shiftKey, "No shift key in numpad layout");

  kb.destroy();
});

QUnit.test("Numeric layout has no shift key rendered", async (assert) => {
  const kb = new KioskKeyboard({ keyboardType: KeyboardType.Numeric });
  await placeAndWait(kb);

  const shiftKey = getKeyElement(kb, "{shift}");
  assert.notOk(shiftKey, "No shift key in numeric layout");

  kb.destroy();
});

QUnit.test("Prior shift state does not leak into Numpad rendering", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Activate shift on full layout
  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "Shift is active on full layout");

  // Switch to numpad
  kb.setKeyboardType(KeyboardType.Numpad);
  await waitForRender();

  const shiftKey = getKeyElement(kb, "{shift}");
  assert.notOk(shiftKey, "No shift key rendered in numpad despite prior shift");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Custom Control Targeting (DOM Fallback)
// ──────────────────────────────────────────────

// Minimal custom control: renders a textual <input> but has no "value" metadata property.
// Verifies that the DOM-fallback path in _setTargetValue works for non-standard controls.
const CustomWrapper = Control.extend("test.CustomWrapper", {
  metadata: { properties: {} },
  renderer: {
    apiVersion: 2,
    render(rm: RenderManager, ctrl: Control) {
      rm.openStart("div", ctrl).openEnd();
      rm.voidStart("input")
        .attr("id", ctrl.getId() + "-inner")
        .attr("type", "text")
        .voidEnd();
      rm.close("div");
    },
  },
  getFocusDomRef(this: Control) {
    return document.getElementById(this.getId() + "-inner");
  },
}) as new () => Control;

QUnit.test("typing works for custom control without value property (DOM fallback)", async (assert) => {
  const custom = new CustomWrapper();
  custom.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [custom.getId()] });
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "a");
  simulateTap(kb, keyEl);

  const dom = custom.getFocusDomRef() as HTMLInputElement;
  assert.strictEqual(dom.value, "a", "Character typed into custom control via DOM fallback");

  kb.destroy();
  custom.destroy();
});

QUnit.test("backspace works for custom control without value property (DOM fallback)", async (assert) => {
  const custom = new CustomWrapper();
  custom.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ controls: [custom.getId()] });
  await placeAndWait(kb);

  // Type "ab" then backspace
  simulateTap(kb, getRequiredKeyElement(kb, "a"));
  simulateTap(kb, getRequiredKeyElement(kb, "b"));
  simulateTap(kb, getRequiredKeyElement(kb, "{backspace}"));

  const dom = custom.getFocusDomRef() as HTMLInputElement;
  assert.strictEqual(dom.value, "a", "Backspace removes last character from custom control");

  kb.destroy();
  custom.destroy();
});

QUnit.test("getActiveControl resolves active control instance", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  input.focus();

  const target = kb.getActiveControl();
  assert.ok(target instanceof Control, "Resolved target is a control instance");
  assert.strictEqual(target, input, "Resolved target matches the associated control");

  kb.destroy();
  input.destroy();
});

QUnit.test("getActiveControl returns null when no target is associated", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(kb.getActiveControl(), null, "Returns null without target association");

  kb.destroy();
});
