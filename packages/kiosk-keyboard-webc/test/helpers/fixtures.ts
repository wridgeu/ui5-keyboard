import { fixture } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type CustomLayout from "../../src/CustomLayout.js";
import type { CompositionMiddleware, LayoutDefinition, LayoutRole } from "../../src/types.js";
import type { VariantTable } from "../../src/core/latin-variants.js";

const DOM = KioskKeyboard.DOM;

/** What one `<kiosk-keyboard-custom-layout>` declares. Omitted facets are left at their default. */
export interface CustomLayoutOptions {
  name?: string;
  rows?: LayoutDefinition;
  keycapLang?: string;
  /** Name of the layout this one yields to under `autoCompact`. */
  compact?: string;
  /** Comma- or space-separated BCP-47 prefixes. */
  locales?: string;
  layoutRole?: `${LayoutRole}`;
  /** Comma- or space-separated facet names. */
  suppress?: string;
  variants?: VariantTable;
  middleware?: () => CompositionMiddleware;
}

/**
 * Builds a `<kiosk-keyboard-custom-layout>` carrying `options`, slotted into
 * `customLayouts`. Returned detached, so a caller that needs the declaration honoured
 * on first paint can append it to the host before the host enters the DOM.
 */
export function customLayout(options: CustomLayoutOptions): CustomLayout {
  const el = document.createElement("kiosk-keyboard-custom-layout") as CustomLayout;
  el.slot = "customLayouts";
  el.name = options.name ?? "";
  if (options.rows !== undefined) el.rows = options.rows;
  if (options.keycapLang !== undefined) el.keycapLang = options.keycapLang;
  if (options.compact !== undefined) el.compact = options.compact;
  if (options.locales !== undefined) el.locales = options.locales;
  if (options.layoutRole !== undefined) el.layoutRole = options.layoutRole;
  if (options.suppress !== undefined) el.suppress = options.suppress;
  if (options.variants !== undefined) el.variants = options.variants;
  if (options.middleware !== undefined) el.middleware = options.middleware;
  return el;
}

/** The `data-key` value of every rendered key, grouped by row. */
export function readDataKeys(el: KioskKeyboard): string[][] {
  const rows = el.shadowRoot!.querySelectorAll(DOM.selectors.row);
  return Array.from(rows).map((row) =>
    Array.from(row.querySelectorAll<HTMLElement>(DOM.selectors.key)).map((k) => k.dataset.key!),
  );
}

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
 * Renders a keyboard whose "spike" layout is declared by a slotted custom layout, and
 * a sibling input wired as the target via setTargetElement. The subtree is assembled
 * before it is mounted, so "spike" resolves on the keyboard's first paint. `facets`
 * adds further declarations to the same custom layout, which is returned so a test can
 * edit it afterwards.
 */
export async function setupWithLayout(
  layout: LayoutDefinition,
  facets: Omit<CustomLayoutOptions, "name" | "rows"> = {},
): Promise<{ kb: KioskKeyboard; input: HTMLInputElement; custom: CustomLayout }> {
  const container = document.createElement("div");
  const input = document.createElement("input");
  input.id = "helper-target";
  input.type = "text";
  const kb = document.createElement("kiosk-keyboard") as KioskKeyboard;
  kb.setAttribute("layout", "spike");
  const custom = customLayout({ name: "spike", rows: layout, ...facets });
  kb.appendChild(custom);
  container.append(input, kb);

  await fixture(container);
  kb.setTargetElement(input);
  await renderFinished();
  return { kb, input, custom };
}
