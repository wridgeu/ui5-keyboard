import { fixture, html } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutDefinition } from "../../src/types.js";

const DOM = KioskKeyboard.DOM;

/** Find a key element by its data-key value, or null when absent. */
export function queryKey(el: KioskKeyboard, value: string): HTMLElement | null {
  return el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.keyByValue(value));
}

/** Find a key element by its data-key value; throws when absent. */
export function requireKey(el: KioskKeyboard, value: string): HTMLElement {
  const key = queryKey(el, value);
  if (!key) throw new Error(`Key "${value}" not found`);
  return key;
}

/**
 * Renders a keyboard with a per-instance layout (registered as "spike") and
 * a sibling input wired as the target via setTargetElement.
 */
export async function setupWithLayout(
  layout: LayoutDefinition,
): Promise<{ kb: KioskKeyboard; input: HTMLInputElement }> {
  const container = await fixture(html`
    <div>
      <input id="helper-target" type="text" />
      <kiosk-keyboard layout="spike"></kiosk-keyboard>
    </div>
  `);
  const input = container.querySelector<HTMLInputElement>("#helper-target")!;
  const kb = container.querySelector<KioskKeyboard>("kiosk-keyboard")!;
  kb.instanceLayouts = { spike: layout };
  kb.setTargetElement(input);
  await renderFinished();
  return { kb, input };
}
