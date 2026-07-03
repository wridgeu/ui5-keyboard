import Log from "sap/base/Log";
import { parseKeyAction } from "./key-token";

/**
 * Regex to extract row and column indices from a key element ID.
 *
 * Key elements use the pattern `{controlId}-key-{row}-{col}`.
 * This regex is shared between the renderer (which constructs IDs)
 * and the control (which parses them for focus navigation).
 */
export const KEY_ID_SUFFIX_RE = /-key-(\d+)-(\d+)$/;

/**
 * Constructs the DOM element ID for a key at a given grid position.
 *
 * @param controlId - The owning control's ID (`oControl.getId()`)
 * @param row - Zero-based row index
 * @param col - Zero-based column index
 */
export function keyElementId(controlId: string, row: number, col: number): string {
  return `${controlId}-key-${row}-${col}`;
}

const FKEY_FNUM_RE = /^F\d+$/;
const NAV_KEY_NAMES: ReadonlySet<string> = new Set([
  "Home",
  "End",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
]);

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

/** Type guard: returns true if the value is an HTMLInputElement or HTMLTextAreaElement. */
export function isInputOrTextarea(el: unknown): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/** Minimal control surface needed to decide DOM-level participation. */
export interface ParticipationHost {
  getVisible(): boolean;
  getEnabled(): boolean;
  getDomRef(): Element | null;
}

/**
 * Whether a keyboard instance is an eligible participant in DOM-level
 * arbitration: visible, enabled, rendered, attached to the document, and laid
 * out (has client rects). Shared by the control's multi-instance arbitration
 * and the auto-show behavior so the two cannot drift apart.
 */
export function isParticipating(host: ParticipationHost): boolean {
  if (!host.getVisible() || !host.getEnabled()) return false;
  const dom = host.getDomRef();
  if (!(dom instanceof HTMLElement)) return false;
  if (!document.contains(dom)) return false;
  return dom.getClientRects().length > 0;
}

/** Callback type for custom target resolution. */
export type TargetResolverFn = (el: HTMLElement) => HTMLInputElement | HTMLTextAreaElement | null;

/**
 * Resolve an editable input/textarea element from a control's focus DOM ref.
 *
 * Supports:
 * - direct native input/textarea
 * - host elements that expose an inner input/textarea in light DOM
 * - host elements that expose an inner input/textarea in shadow DOM
 * - nested web components (e.g. ui5-step-input → ui5-input → native input)
 *   up to `maxDepth` levels of shadow DOM nesting
 */
export function resolveInputOrTextarea(el: unknown, maxDepth = 3): HTMLInputElement | HTMLTextAreaElement | null {
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

    for (const child of shadow.querySelectorAll("*")) {
      if (child instanceof HTMLElement && child.shadowRoot) {
        const nested = resolveInputOrTextarea(child, maxDepth - 1);
        if (nested) return nested;
      }
    }
  }

  return null;
}

/**
 * Resolve using a custom resolver first, falling back to the built-in resolver.
 *
 * Consumer-supplied resolvers are wrapped in try/catch so that a throwing
 * resolver cannot crash interaction paths (typing, focus, escape, etc.).
 */
export function resolveWithCustomResolver(
  el: unknown,
  customResolver: TargetResolverFn | null,
): HTMLInputElement | HTMLTextAreaElement | null {
  if (customResolver && el instanceof HTMLElement) {
    try {
      const custom = customResolver(el);
      if (isInputOrTextarea(custom)) return custom;
    } catch (err) {
      Log.warning("Custom target resolver threw", err instanceof Error ? err : String(err), "ui5.kiosk.KioskKeyboard");
      return resolveInputOrTextarea(el);
    }
  }
  return resolveInputOrTextarea(el);
}
