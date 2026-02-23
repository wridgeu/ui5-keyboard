import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KeyDefinition, LayoutDefinition } from "ui5/kiosk/types";
import { asRendererInternalControl } from "ui5/kiosk/internal/renderer-internal-api";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";

/** Place a control into qunit-fixture and wait for initial render. */
export async function placeAndWait(control: KioskKeyboard): Promise<void> {
  control.placeAt("qunit-fixture");
  await nextUIUpdate();
}

/** Wait for a re-render cycle after a state change. */
export async function waitForRender(): Promise<void> {
  await nextUIUpdate();
}

/** Find a rendered key by its data-key value and tap it via touch simulation. */
export function tapKey(keyboard: KioskKeyboard, keyValue: string): void {
  const dom = keyboard.getDomRef();
  if (!dom) throw new Error("Keyboard not rendered");
  const keyEl = dom.querySelector(`[data-key="${keyValue}"]`) as HTMLElement | null;
  if (!keyEl) throw new Error(`Key "${keyValue}" not found`);
  simulateTap(keyboard, keyEl);
}

/** Simulate a touchstart→touchend sequence on a control, targeting a specific element. */
export function simulateTap(kb: KioskKeyboard, el: HTMLElement): void {
  const start = new Event("touchstart", { bubbles: true });
  Object.defineProperty(start, "target", { value: el, writable: false });
  kb.ontouchstart(start);

  const end = new Event("touchend", { bubbles: true });
  Object.defineProperty(end, "target", { value: el, writable: false });
  kb.ontouchend(end);
}

/** Simulate a shift tap on an unrendered keyboard (creates a fake shift element). */
export function tapShiftInternally(kb: KioskKeyboard): void {
  const fakeShiftEl = document.createElement("div");
  fakeShiftEl.classList.add("ui5KioskKey");
  fakeShiftEl.dataset.key = "{shift}";
  fakeShiftEl.id = "fake-shift";
  simulateTap(kb, fakeShiftEl);
}

/** Get all rendered key elements from a keyboard. */
export function getKeyElements(keyboard: KioskKeyboard): NodeListOf<HTMLElement> {
  const dom = keyboard.getDomRef();
  if (!dom) throw new Error("Keyboard not rendered");
  return dom.querySelectorAll<HTMLElement>(".ui5KioskKey");
}

export function isShiftActive(keyboard: KioskKeyboard): boolean {
  return asRendererInternalControl(keyboard)._isShiftActive();
}

export function isCapsLock(keyboard: KioskKeyboard): boolean {
  return asRendererInternalControl(keyboard)._isCapsLock();
}

export function getResolvedLayout(keyboard: KioskKeyboard): LayoutDefinition {
  return asRendererInternalControl(keyboard)._getResolvedLayout();
}

export function getKeyLabel(keyboard: KioskKeyboard, key: KeyDefinition): string {
  return asRendererInternalControl(keyboard)._getKeyLabel(key);
}

export function getKeyAriaLabel(keyboard: KioskKeyboard, key: KeyDefinition): string {
  return asRendererInternalControl(keyboard)._getKeyAriaLabel(key);
}
