import { parseHotkey, formatParsed, parseSequenceSteps } from "./parse";
import type { Platform } from "../library";

/**
 * Result of validating a hotkey string.
 *
 * Discriminated union: when `valid` is `true`, `normalizedHotkey` is guaranteed
 * to be a string. When `valid` is `false`, `normalizedHotkey` is `undefined`.
 *
 * @since 0.1.0
 */
export type HotkeyValidationResult =
  | { valid: true; warnings: string[]; errors: string[]; normalizedHotkey: string }
  | { valid: false; warnings: string[]; errors: string[]; normalizedHotkey?: undefined };

/**
 * Browser shortcuts that cannot be reliably overridden.
 * Source: UI5 ShortcutHelper + common browser behavior.
 * Key = normalized hotkey, Value = description of the browser action.
 *
 * @since 0.1.0
 */
export const BROWSER_SHORTCUTS: ReadonlyMap<string, string> = new Map([
  ["Control+L", "Focus address bar"],
  ["Control+N", "New window"],
  ["Control+Shift+N", "New incognito window"],
  ["Control+T", "New tab"],
  ["Control+Shift+T", "Reopen closed tab"],
  ["Control+W", "Close tab"],
  ["Control+Shift+W", "Close window"],
  ["Control+Tab", "Next tab"],
  ["Control+Shift+Tab", "Previous tab"],
  ["Control+0", "Reset zoom"],
  ["F5", "Reload page"],
  ["Control+F5", "Hard reload"],
  ["F6", "Focus next pane (browser)"],
  ["F11", "Toggle fullscreen"],
  ["F12", "Developer tools"],
  ["Tab", "Focus next element"],
  ["Shift+Tab", "Focus previous element"],
  ["Meta+L", "Focus address bar (Mac)"],
  ["Meta+N", "New window (Mac)"],
  ["Meta+T", "New tab (Mac)"],
  ["Meta+W", "Close tab (Mac)"],
  // Additional browser-reserved from ShortcutHelper.js
  ["Control+Q", "Quit browser (Mac/Linux)"],
  ["Control+PageUp", "Previous tab"],
  ["Control+PageDown", "Next tab"],
]);

/**
 * SAP Fiori / FLP shortcuts that may conflict with application hotkeys.
 * Key = normalized hotkey, Value = description of the SAP action.
 *
 * @since 0.1.0
 */
export const SAP_SHORTCUTS: ReadonlyMap<string, string> = new Map([
  ["Control+S", "Save (Fiori)"],
  ["Control+E", "Edit (Fiori)"],
  ["Control+D", "Delete (Fiori)"],
  ["Control+Enter", "Create (Fiori)"],
  ["Control+Shift+S", "Share (Fiori)"],
  ["Control+Shift+E", "Export (Fiori)"],
  ["Control+Shift+M", "Messages (Fiori)"],
  ["F6", "Navigate between sections (SAP)"],
  ["Shift+F6", "Navigate backwards between sections (SAP)"],
  ["Meta+S", "Save (Fiori, Mac)"],
  ["Meta+E", "Edit (Fiori, Mac)"],
  ["Meta+D", "Delete (Fiori, Mac)"],
  // UI5 technical tool shortcuts (ShortcutHelper.js mDisallowedShortcuts)
  ["Control+Alt+Shift+P", "UI5 Technical Information"],
  ["Control+Alt+Shift+S", "UI5 Support Tool"],
  ["Control+Alt+Shift+T", "UI5 Test Recorder"],
]);

/**
 * Set of known key names that are valid targets for hotkeys.
 *
 * @since 0.1.0
 */
export const KNOWN_KEYS: ReadonlySet<string> = new Set([
  // Letters
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  // Digits
  ..."0123456789".split(""),
  // Function keys
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
  // Special keys
  "Escape",
  "Enter",
  "Space",
  "Tab",
  "Backspace",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "Pause",
  "PrintScreen",
  "ContextMenu",
  // Punctuation / symbols
  "+",
  "-",
  "=",
  "[",
  "]",
  "\\",
  ";",
  "'",
  ",",
  ".",
  "/",
  "`",
  "*",
]);

/**
 * Validate a hotkey string for structural correctness and potential conflicts.
 *
 * Multi-step sequences ("Ctrl+K Ctrl+S") are split the way
 * `HotkeyManager.register` splits them and validated step by step, so a string
 * that validates here is a string that registers.
 *
 * @param hotkey - The hotkey string to validate (e.g., "Ctrl+S", "F5", "Ctrl+K Ctrl+S").
 * @param platform - Override platform for Mod resolution.
 * @returns Validation result with errors, warnings, and normalized form.
 * @since 0.1.0
 */
export function validateHotkey(hotkey: string, platform?: Platform): HotkeyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!hotkey?.trim()) {
    return { valid: false, errors: ["Hotkey string must not be empty"], warnings };
  }

  const steps = parseSequenceSteps(hotkey) ?? [hotkey];
  const normalizedSteps: string[] = [];

  for (const step of steps) {
    let parsed;
    try {
      parsed = parseHotkey(step, platform);
    } catch (e) {
      return { valid: false, errors: [e instanceof Error ? e.message : String(e)], warnings };
    }

    const normalized = formatParsed(parsed);
    normalizedSteps.push(normalized);

    if (!KNOWN_KEYS.has(parsed.key)) {
      warnings.push(`Unknown key "${parsed.key}" - may not match keyboard events correctly`);
    }

    const browserConflict = BROWSER_SHORTCUTS.get(normalized);
    if (browserConflict) {
      warnings.push(`Conflicts with browser shortcut: ${browserConflict} (${normalized})`);
    }

    const sapConflict = SAP_SHORTCUTS.get(normalized);
    if (sapConflict) {
      warnings.push(`Conflicts with SAP shortcut: ${sapConflict} (${normalized})`);
    }
  }

  return { valid: true, warnings, errors, normalizedHotkey: normalizedSteps.join(" ") };
}

/**
 * Validate a hotkey string and throw if invalid.
 *
 * @param hotkey - The hotkey string to validate.
 * @param platform - Override platform for Mod resolution.
 * @returns The normalized hotkey string.
 * @throws Error if the hotkey is structurally invalid.
 * @since 0.1.0
 */
export function assertValidHotkey(hotkey: string, platform?: Platform): string {
  const result = validateHotkey(hotkey, platform);
  if (!result.valid) {
    throw new Error(`Invalid hotkey "${hotkey}": ${result.errors.join("; ")}`);
  }
  return result.normalizedHotkey;
}

/**
 * Quick boolean check for hotkey validity.
 *
 * @param hotkey - The hotkey string to check.
 * @param platform - Override platform for Mod resolution.
 * @returns `true` if the hotkey is structurally valid.
 * @since 0.1.0
 */
export function checkHotkey(hotkey: string, platform?: Platform): boolean {
  return validateHotkey(hotkey, platform).valid;
}
