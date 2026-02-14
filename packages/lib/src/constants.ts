import type { CanonicalModifier } from "./types";

/**
 * The global scope identifier used as the bottom of the scope stack.
 * Use this constant instead of hardcoding `"__global__"`.
 */
export const GLOBAL_SCOPE = "__global__";

/**
 * Canonical modifier order for normalization: Control, Alt, Shift, Meta.
 */
export const MODIFIER_ORDER: readonly CanonicalModifier[] = ["Control", "Alt", "Shift", "Meta"] as const;

/**
 * Maps common modifier aliases to their canonical form.
 * "Mod" is a pseudo-modifier resolved at runtime based on platform.
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
  CommandOrControl: "Mod",
  CmdOrCtrl: "Mod",
};

/**
 * Maps common key name aliases to their canonical `event.key` values.
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
 */
export const MAC_MODIFIER_SYMBOLS: Readonly<Record<CanonicalModifier, string>> = {
  Control: "\u2303",
  Alt: "\u2325",
  Shift: "\u21E7",
  Meta: "\u2318",
};

/**
 * Windows/Linux modifier display labels (joined with "+").
 */
export const STANDARD_MODIFIER_LABELS: Readonly<Record<CanonicalModifier, string>> = {
  Control: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Meta: "Win",
};

/**
 * Display symbols for special keys.
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
 */
export function normalizeKeyName(key: string): string {
  // Check aliases first
  const alias = KEY_ALIASES[key];
  if (alias) {
    return alias;
  }

  // Single character: uppercase letters
  if (key.length === 1) {
    return key.toUpperCase();
  }

  // Function keys: normalize casing (f5 -> F5)
  const fnMatch = /^[fF](\d{1,2})$/.exec(key);
  if (fnMatch) {
    return `F${fnMatch[1]}`;
  }

  return key;
}
