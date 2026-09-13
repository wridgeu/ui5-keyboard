import { normalizeKeyName } from "./constants";
import type { ParsedHotkey } from "../types";

/**
 * Derive all candidate key names from a keyboard event.
 *
 * Returns the primary key (from `event.key`, normalized) plus any
 * fallback keys extracted from `event.code`. The fallback covers:
 * - macOS Option+letter: `event.key` may produce a dead/special char
 *   while `event.code` still reports the physical letter key.
 * - Shift+digit and macOS Option+digit: `event.key` reports the symbol
 *   (e.g., "$") while `event.code` still reports the digit (e.g., "Digit4").
 *
 * Both are gated: a non-US layout maps a physical key to a different character
 * (QWERTZ types "y" from `KeyZ`), so admitting the physical key alongside the
 * typed one would fire two hotkeys for one press.
 */
export function getCandidateKeys(event: KeyboardEvent): string[] {
  const keys: string[] = [];

  const primary = normalizeKeyName(event.key);
  keys.push(primary);

  // Fallback: letter from event.code (macOS Option+letter), only when the
  // event did not already type a letter of its own.
  if (event.code?.startsWith("Key") && !/^[A-Za-z]$/.test(primary)) {
    const codeLetter = event.code.slice(3);
    if (codeLetter.length === 1 && /^[A-Za-z]$/.test(codeLetter)) {
      keys.push(codeLetter.toUpperCase());
    }
  }

  // Fallback: digit from event.code, only while a modifier that rewrites the
  // typed character is down. Shift turns "4" into "$" and Option turns "3" into
  // "£"; with neither held it is the layout that put the character there
  // (AZERTY types "&" from `Digit1`), so the digit is not what was pressed.
  if ((event.shiftKey || event.altKey) && event.code?.startsWith("Digit")) {
    const codeDigit = event.code.slice(5);
    if (codeDigit.length === 1 && /^[0-9]$/.test(codeDigit) && codeDigit !== primary) {
      keys.push(codeDigit);
    }
  }

  return keys;
}

/**
 * Check whether a KeyboardEvent matches a parsed hotkey.
 *
 * Matching rules:
 * 1. **Exact modifier match** - The event must have exactly the same modifier
 *    state. Ctrl+Shift+S does NOT match a hotkey registered for Ctrl+S.
 * 2. **Primary key via `event.key`** - Case-insensitive comparison for single
 *    characters, exact match for special keys (Escape, F5, etc.).
 * 3. **Fallback to `event.code`** - For letter keys (KeyA-KeyZ) only when `event.key`
 *    returned something other than a letter (e.g., macOS Option+D produces "∂"),
 *    and for digit keys (Digit0-Digit9) only while Shift or Alt is held (e.g.,
 *    Shift+4 produces "$", macOS Option+3 produces "£").
 *
 * @since 0.1.0
 */
export function matchesKeyboardEvent(event: KeyboardEvent, parsed: ParsedHotkey): boolean {
  // Exact modifier match - no extra modifiers allowed
  if (event.ctrlKey !== parsed.ctrl) return false;
  if (event.shiftKey !== parsed.shift) return false;
  if (event.altKey !== parsed.alt) return false;
  if (event.metaKey !== parsed.meta) return false;

  // Key matching
  const hotkeyKey = parsed.key;
  const candidates = getCandidateKeys(event);

  // Single-character key comparison
  if (hotkeyKey.length === 1) {
    return candidates.some((k) => k.length === 1 && k.toUpperCase() === hotkeyKey.toUpperCase());
  }

  // Special keys: exact match after normalization
  return candidates[0] === hotkeyKey;
}
