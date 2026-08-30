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

/**
 * The framework's page-level polite live region, the node every announcement lands in.
 *
 * `@ui5/webcomponents-base` keeps one pair of spans in `<ui5-announcement-area>` at the
 * top of the light DOM, so it is reached from `document`, not from a shadow root.
 */
export function politeAnnouncementRegion(): HTMLElement | null {
  return document.querySelector<HTMLElement>("ui5-announcement-area .ui5-invisiblemessage-polite");
}

/**
 * The most recent announcement, or `""` when none was raised since the last reset.
 *
 * The standing node wins over the recording: it is written synchronously, while the
 * recorder runs a microtask later and would lag a read taken in the announcement's own
 * task. The recording covers the case the node cannot - `InvisibleMessage` empties its
 * span three seconds after a write, and that span is shared by the whole page, so a
 * timer armed by an earlier test can wipe an identical text this one just wrote.
 */
export function announcedText(): string {
  armRecorder();
  const standing = politeAnnouncementRegion()?.textContent ?? "";
  return standing || (announcements.at(-1) ?? "");
}

/**
 * Empty the shared live region, drop anything the queue is still holding, and forget
 * what was recorded.
 *
 * Both are page-global: the span is one pair for the whole document and the queue is a
 * static on the class, so without this an earlier test's text stands in for the one
 * under assertion, and its unspent gap delays the next write.
 */
export function resetAnnouncements(): void {
  KioskKeyboard["_announcements"].teardown();
  announcements.length = 0;
  const region = politeAnnouncementRegion();
  if (region) region.textContent = "";
  armRecorder();
}

const announcements: string[] = [];
let recorder: MutationObserver | null = null;

/** Start recording live-region writes, once the framework has put the span in the page. */
function armRecorder(): void {
  if (recorder) return;
  const node = politeAnnouncementRegion();
  if (!node) return;
  recorder = new MutationObserver(() => {
    const text = node.textContent ?? "";
    if (text) announcements.push(text);
  });
  recorder.observe(node, { childList: true, characterData: true, subtree: true });
}
