import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { MobileKeyboard } from "ui5/kiosk/library";
import { VARIANT_HOLD_MS } from "ui5/kiosk/internal/variant-popup-behavior";
import Button from "sap/m/Button";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import { destroyKeyboards, getKeyboardDom, getRequiredKeyElement, placeAndWait } from "./test-helpers";

// A docked keyboard on the page stays usable while a modal sap.m.Dialog is open:
// it stacks above the dialog and its block layer, and the modal focus trap
// leaves the keycaps and the accent-variant popover alone.

const DOM = KioskKeyboard.DOM;
const POPUP_CONTENT_ATTR = "data-sap-ui-integration-popup-content";

/**
 * A modal dialog holding one text input, opened and settled. By default the
 * dialog's first focus lands on that input, which already claims the keyboard;
 * `focusButton` parks it on the Close button instead so a test can observe the
 * state before any claim.
 */
async function openDialog(input: Input, { focusButton = false } = {}): Promise<Dialog> {
  const button = new Button({ text: "Close" });
  const dialog = new Dialog({
    content: [input],
    beginButton: button,
    initialFocus: focusButton ? button : undefined,
  });
  const opened = new Promise<void>((resolve) => dialog.attachEventOnce("afterOpen", () => resolve()));
  dialog.open();
  await opened;
  return dialog;
}

async function closeDialog(dialog: Dialog): Promise<void> {
  const closed = new Promise<void>((resolve) => dialog.attachEventOnce("afterClose", () => resolve()));
  dialog.close();
  await closed;
  dialog.destroy();
}

/** The stacking level as the browser resolves it: Popup's inline value on a dialog, ours on the keyboard. */
function zIndexOf(el: Element | null | undefined): number {
  return el ? Number(getComputedStyle(el).zIndex) : Number.NaN;
}

/** The modal refocus runs in a `setTimeout(0)` after the stray focus; give it that turn. */
async function afterModalRefocus(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function press(kb: KioskKeyboard, el: HTMLElement): void {
  const event = new Event("touchstart", { bubbles: true });
  Object.defineProperty(event, "target", { value: el, writable: false });
  kb.ontouchstart(event);
}

/** A docked keyboard whose stylesheet z-index sits below every popup, so only the raise can lift it. */
async function makeDockedKeyboard(settings: { controls: string[]; autoShow?: boolean; accentVariants?: boolean }) {
  const kb = new KioskKeyboard({ docked: true, mobileKeyboard: MobileKeyboard.Custom, ...settings });
  await placeAndWait(kb);
  const dom = getKeyboardDom(kb);
  dom.style.setProperty("--ui5KioskKeyboard-dockedZIndex", "1");
  return { kb, dom };
}

QUnit.module("KioskKeyboard over a sap.m.Dialog", {
  afterEach() {
    destroyKeyboards();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("the root counts as popup content, docked or not", async (assert) => {
  const inline = new KioskKeyboard();
  await placeAndWait(inline);
  assert.ok(getKeyboardDom(inline).hasAttribute(POPUP_CONTENT_ATTR), "inline keyboard carries the attribute");

  const docked = new KioskKeyboard({ docked: true });
  await placeAndWait(docked);
  assert.ok(getKeyboardDom(docked).hasAttribute(POPUP_CONTENT_ATTR), "docked keyboard carries the attribute");
});

QUnit.test("auto-show claims a dialog input and stacks the keyboard above the dialog", async (assert) => {
  const input = new Input();
  const { kb, dom } = await makeDockedKeyboard({ autoShow: true, controls: [input.getId()] });

  const dialog = await openDialog(input);
  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();

  assert.ok(kb.isOpen(), "keyboard opened for the dialog input");
  assert.strictEqual(kb.getActiveControl()?.getId(), input.getId(), "dialog input is the target");
  const dialogZ = zIndexOf(dialog.getDomRef());
  const blockLayerZ = zIndexOf(document.getElementById("sap-ui-blocklayer-popup"));
  assert.ok(zIndexOf(dom) > dialogZ, `keyboard (${zIndexOf(dom)}) above dialog (${dialogZ})`);
  assert.ok(zIndexOf(dom) > blockLayerZ, `keyboard above block layer (${blockLayerZ})`);
  // Paint order, not numbers: a z-index confined to an ancestor stacking context
  // compares fine and still paints under the block layer. The fixture is a
  // stacking-context-free ancestor, so the raise must reach the hit test.
  const key = getRequiredKeyElement(kb, "q");
  const rect = key.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  assert.ok(key.contains(hit), `a pointer at the keycap centre reaches the keycap, not ${hit?.id || hit?.className}`);

  // Already on top: a further claim takes no new z-index from the popup stack.
  const raised = dom.style.zIndex;
  (input.getFocusDomRef() as HTMLElement).blur();
  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.strictEqual(dom.style.zIndex, raised, "a re-claim while topmost keeps the z-index");

  await closeDialog(dialog);
  assert.strictEqual(dom.style.zIndex, "", "the last modal closing hands the z-index back to the stylesheet");
  assert.strictEqual(zIndexOf(dom), 1, "stylesheet value applies again");
});

QUnit.test("a keyboard already open when the dialog opens is raised at once, without a claim", async (assert) => {
  const input = new Input();
  // No auto-show and the dialog's first focus on its button: nothing claims the
  // input, so only the block-layer event can lift the keyboard.
  const { kb, dom } = await makeDockedKeyboard({ controls: [input.getId()] });
  kb.show();
  assert.ok(kb.isOpen(), "keyboard open on the page");
  assert.strictEqual(dom.style.zIndex, "", "no modal, no raise");

  const dialog = await openDialog(input, { focusButton: true });
  assert.ok(kb.isOpen(), "keyboard still open");
  assert.ok(zIndexOf(dom) > zIndexOf(dialog.getDomRef()), "keyboard raised above the dialog before any claim");

  await closeDialog(dialog);
});

QUnit.test("a claim from a second dialog stacked over the first raises the keyboard again", async (assert) => {
  const firstInput = new Input();
  const secondInput = new Input();
  const { kb, dom } = await makeDockedKeyboard({ autoShow: true, controls: [firstInput.getId(), secondInput.getId()] });

  const first = await openDialog(firstInput);
  (firstInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.ok(kb.isOpen(), "keyboard open in the first dialog");

  const second = await openDialog(secondInput, { focusButton: true });
  assert.ok(zIndexOf(second.getDomRef()) > zIndexOf(dom), "the second dialog opens above the raised keyboard");

  (secondInput.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  assert.ok(kb.isOpen(), "keyboard open in the second dialog");
  assert.ok(
    zIndexOf(dom) > zIndexOf(second.getDomRef()),
    "claiming the second dialog's input raises the keyboard above it",
  );

  await closeDialog(second);
  assert.notStrictEqual(dom.style.zIndex, "", "one modal still open keeps the keyboard raised");
  await closeDialog(first);
  assert.strictEqual(dom.style.zIndex, "", "the last modal closing hands the z-index back");
});

QUnit.test("a re-render keeps the keyboard raised", async (assert) => {
  const input = new Input();
  const { kb, dom } = await makeDockedKeyboard({ autoShow: true, controls: [input.getId()] });
  const dialog = await openDialog(input);
  (input.getFocusDomRef() as HTMLElement).focus();
  await nextUIUpdate();
  const raised = dom.style.zIndex;
  assert.notStrictEqual(raised, "", "keyboard raised");

  kb.invalidate();
  await nextUIUpdate();
  assert.strictEqual(getKeyboardDom(kb).style.zIndex, raised, "the inline z-index survived the re-render");

  await closeDialog(dialog);
});

QUnit.test("the modal focus trap leaves a focused keycap alone", async (assert) => {
  const input = new Input();
  const { kb } = await makeDockedKeyboard({ controls: [input.getId()] });
  const dialog = await openDialog(input);
  (input.getFocusDomRef() as HTMLElement).focus();
  kb.show();

  const key = getRequiredKeyElement(kb, "q");
  key.focus();
  await afterModalRefocus();

  assert.strictEqual(document.activeElement, key, "focus stayed on the keycap");

  await closeDialog(dialog);
});

QUnit.test("the modal focus trap leaves the accent-variant popover alone", async (assert) => {
  const input = new Input();
  const { kb } = await makeDockedKeyboard({ controls: [input.getId()], accentVariants: true });
  const dialog = await openDialog(input);
  (input.getFocusDomRef() as HTMLElement).focus();
  kb.show();

  press(kb, getRequiredKeyElement(kb, "a"));
  await new Promise((resolve) => setTimeout(resolve, VARIANT_HOLD_MS + 40));
  await afterModalRefocus();

  const popup = document.querySelector<HTMLElement>(DOM.selectors.variantPopup);
  assert.ok(popup, "variant popover opened");
  assert.ok(popup?.contains(document.activeElement), "focus stayed inside the popover");

  await closeDialog(dialog);
});

QUnit.test("Escape closes the keyboard first and still reaches the dialog", async (assert) => {
  const input = new Input();
  const { kb } = await makeDockedKeyboard({ controls: [input.getId()] });
  const dialog = await openDialog(input);
  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  kb.show();

  // Bounded: a keystroke the dialog never receives must fail the test, not hang it.
  const closed = new Promise<boolean>((resolve) => {
    dialog.attachEventOnce("afterClose", () => resolve(true));
    setTimeout(() => resolve(false), 2000);
  });
  inputDom.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }));
  assert.notOk(kb.isOpen(), "keyboard closed on Escape");
  assert.ok(await closed, "dialog closed on the same Escape");
  dialog.destroy();
});
