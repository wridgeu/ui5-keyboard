import type { CanonicalModifier } from "../types";

/**
 * The global scope identifier used as the bottom of the scope stack.
 * Use this constant instead of hardcoding `"__global__"`.
 *
 * @since 0.1.0
 */
export const GLOBAL_SCOPE = "__global__";

/**
 * Set of the four modifier key names as reported by `KeyboardEvent.key`.
 * Used to filter out modifier-only presses in event guards.
 *
 * @since 0.1.0
 */
export const MODIFIER_KEYS: ReadonlySet<string> = new Set(["Control", "Shift", "Alt", "Meta"]);

/**
 * Canonical modifier order for normalization: Control, Alt, Shift, Meta.
 *
 * @since 0.1.0
 */
export const MODIFIER_ORDER: readonly CanonicalModifier[] = ["Control", "Alt", "Shift", "Meta"];

/**
 * Maps common modifier aliases to their canonical form.
 * "Mod" is a pseudo-modifier resolved at runtime based on platform.
 *
 * @since 0.1.0
 */
export const MODIFIER_ALIASES: Readonly<Record<string, CanonicalModifier | "Mod">> = {
  Control: "Control",
  Ctrl: "Control",
  ctrl: "Control",
  Shift: "Shift",
  shift: "Shift",
  Alt: "Alt",
  alt: "Alt",
  Option: "Alt",
  option: "Alt",
  Meta: "Meta",
  meta: "Meta",
  Command: "Meta",
  Cmd: "Meta",
  cmd: "Meta",
  Mod: "Mod",
  mod: "Mod",
};

/**
 * Maps common key name aliases to their canonical `event.key` values.
 *
 * @since 0.1.0
 */
export const KEY_ALIASES: Readonly<Record<string, string>> = {
  Esc: "Escape",
  esc: "Escape",
  escape: "Escape",
  Return: "Enter",
  return: "Enter",
  enter: "Enter",
  " ": "Space",
  space: "Space",
  Space: "Space",
  Spacebar: "Space",
  Del: "Delete",
  del: "Delete",
  delete: "Delete",
  Ins: "Insert",
  ins: "Insert",
  Up: "ArrowUp",
  up: "ArrowUp",
  Down: "ArrowDown",
  down: "ArrowDown",
  Left: "ArrowLeft",
  left: "ArrowLeft",
  Right: "ArrowRight",
  right: "ArrowRight",
  PgUp: "PageUp",
  PgDn: "PageDown",
  BS: "Backspace",
  bs: "Backspace",
  Plus: "+",
  Minus: "-",
  Tab: "Tab",
  tab: "Tab",
};

/**
 * macOS modifier display symbols (concatenated without separator).
 *
 * @since 0.1.0
 */
export const MAC_MODIFIER_SYMBOLS = {
  Control: "\u2303",
  Alt: "\u2325",
  Shift: "\u21E7",
  Meta: "\u2318",
} as const satisfies Record<CanonicalModifier, string>;

/**
 * Windows/Linux modifier display labels (joined with "+").
 *
 * @since 0.1.0
 */
export const STANDARD_MODIFIER_LABELS = {
  Control: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Meta: "Win",
} as const satisfies Record<CanonicalModifier, string>;

/**
 * Display symbols for special keys.
 *
 * @since 0.1.0
 */
export const KEY_DISPLAY_SYMBOLS: Readonly<Record<string, string>> = {
  ArrowUp: "\u2191",
  ArrowDown: "\u2193",
  ArrowLeft: "\u2190",
  ArrowRight: "\u2192",
  Enter: "\u21B5",
  Escape: "Esc",
  Backspace: "\u232B",
  Delete: "\u2326",
  Tab: "\u21E5",
  Space: "\u2423",
};

/**
 * Normalize a key name by applying aliases and casing conventions.
 *
 * - Single letters are uppercased (a -> A).
 * - Known aliases are resolved (Esc -> Escape).
 * - Function keys are normalized (f5 -> F5).
 *
 * @since 0.1.0
 */
export function normalizeKeyName(key: string): string {
  // Check aliases first
  const alias = KEY_ALIASES[key];
  if (alias) {
    return alias;
  }

  // Case-insensitive fallback for keys spelled in another case (e.g., "ESCAPE",
  // "Del", "PGUP"). Only names KEY_ALIASES carries are reachable this way.
  const lowerAlias = KEY_ALIASES[key.toLowerCase()];
  if (lowerAlias) {
    return lowerAlias;
  }

  // Single character: uppercase letters
  if (key.length === 1) {
    return key.toUpperCase();
  }

  // Function keys: normalize casing (f5 -> F5)
  const fnMatch = /^[fF]([1-9]|1\d|2[0-4])$/.exec(key);
  if (fnMatch) {
    return `F${fnMatch[1]}`;
  }

  return key;
}
