import { parseKeyAction, type KeyAction } from "./key-token.js";
import { NAV_KEY_NAMES } from "./key-action-meta.js";
import { KIOSK_KEYBOARD_DOM } from "./dom-contract.js";
import type { KeyType } from "../types.js";

/** A key's place in the resolved layout: zero-based row and column. */
export interface KeyPosition {
  readonly row: number;
  readonly col: number;
}

/**
 * The grid position a rendered key occupies, from the coordinate the template
 * publishes on it, or `null` for an element that carries no usable coordinate.
 */
export function keyPositionOf(el: Element): KeyPosition | null {
  const rowAttr = el.getAttribute(KIOSK_KEYBOARD_DOM.attributes.rowIndex);
  const colAttr = el.getAttribute(KIOSK_KEYBOARD_DOM.attributes.keyIndex);
  if (rowAttr === null || colAttr === null || rowAttr === "" || colAttr === "") return null;
  const row = Number(rowAttr);
  const col = Number(colAttr);
  return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : null;
}

/**
 * Constructs the DOM element ID for a key at a given grid position.
 */
export function keyElementId(controlId: string, row: number, col: number): string {
  return `${controlId}-key-${row}-${col}`;
}

/** Type guard: returns true if the value is an HTMLInputElement or HTMLTextAreaElement. */
function isInputOrTextarea(el: EventTarget | null | undefined): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/**
 * Resolve an editable input/textarea element from a DOM element.
 *
 * Supports:
 * - direct native input/textarea
 * - host elements that expose an inner input/textarea in light DOM
 * - host elements that expose an inner input/textarea in shadow DOM
 * - nested web components (e.g. ui5-step-input → ui5-input → native input)
 *   up to `maxDepth` levels of shadow DOM nesting
 */
export function resolveInputOrTextarea(
  el: EventTarget | null | undefined,
  maxDepth = 3,
): HTMLInputElement | HTMLTextAreaElement | null {
  if (isInputOrTextarea(el)) {
    return el;
  }

  if (!(el instanceof HTMLElement) || maxDepth <= 0) {
    return null;
  }

  // Check light DOM children
  const lightDom = el.querySelector("input,textarea");
  if (isInputOrTextarea(lightDom)) {
    return lightDom;
  }

  // Check shadow DOM - direct native input/textarea first, then recurse into nested web components
  const shadow = el.shadowRoot;
  if (shadow) {
    const shadowInput = shadow.querySelector("input,textarea");
    if (isInputOrTextarea(shadowInput)) {
      return shadowInput;
    }

    // Recurse into nested custom elements (e.g. ui5-step-input wraps ui5-input)
    for (const child of shadow.querySelectorAll("*")) {
      if (child instanceof HTMLElement && child.shadowRoot) {
        const nested = resolveInputOrTextarea(child, maxDepth - 1);
        if (nested) return nested;
      }
    }
  }

  return null;
}

const FKEY_FNUM_RE = /^F\d+$/;

/**
 * Classifies a layout row by its content for CSS targeting via `data-row-kind`.
 *
 * Content-driven so custom layouts get correct kinds automatically.
 *
 * - `"fkey"`: all keys are function keys (`{fkey:F1}`, `{fkey:F2}`, ...)
 * - `"nav"`: all keys are known navigation keys (arrows, Home/End, PgUp/PgDn)
 * - `undefined`: everything else (character rows, mixed rows, custom fkey rows)
 */
export function classifyRow(row: ReadonlyArray<{ value: string }>): "fkey" | "nav" | undefined {
  if (row.length === 0) return undefined;
  const actions = row.map((k) => parseKeyAction(k.value));
  if (actions.every((a) => a.kind === "fkey" && FKEY_FNUM_RE.test(a.name))) return "fkey";
  if (actions.every((a) => a.kind === "fkey" && NAV_KEY_NAMES.has(a.name))) return "nav";
  return undefined;
}

const DECLARED_PARTS: ReadonlySet<string> = new Set(KIOSK_KEYBOARD_DOM.parts);

/**
 * The `part` attribute for one rendered key: its category, then the per-key
 * names the DOM contract declares.
 *
 * A key is named individually only where the contract already lists the name,
 * so a character key stays anonymous and a switch to a slotted custom layout
 * gets `key-layout` without a `key-layout-<target>` twin. See the `_keyParts`
 * block in `dom-contract.ts` for why the set is closed.
 */
export function keyPart(action: KeyAction, type: KeyType | undefined): string {
  const names = ["key"];
  if (type === "modifier") names.push("modifier");
  else if (type === "action") names.push("action");

  switch (action.kind) {
    case "fkey":
      names.push("fkey");
      break;
    case "shift":
    case "backspace":
    case "enter":
      names.push(`key-${action.kind}`);
      break;
    case "layout": {
      names.push("key-layout");
      const target = `key-layout-${action.target}`;
      if (DECLARED_PARTS.has(target)) names.push(target);
      break;
    }
    case "char":
      if (action.text === " ") names.push("key-space");
      break;
  }

  return names.join(" ");
}

/** Callback type for custom target resolution. */
type TargetResolverFn = (el: HTMLElement) => HTMLInputElement | HTMLTextAreaElement | null;

/**
 * Resolve using a custom resolver first, falling back to the built-in resolver.
 *
 * Consumer-supplied resolvers are wrapped in try/catch so that a throwing
 * resolver cannot crash interaction paths (typing, focus, escape, etc.).
 */
export function resolveWithCustomResolver(
  el: HTMLElement,
  customResolver: TargetResolverFn | null,
): HTMLInputElement | HTMLTextAreaElement | null {
  if (customResolver) {
    try {
      const custom = customResolver(el);
      if (isInputOrTextarea(custom)) return custom;
    } catch (err) {
      console.warn("[kiosk-keyboard] Custom target resolver threw:", err);
      return resolveInputOrTextarea(el);
    }
  }
  return resolveInputOrTextarea(el);
}
