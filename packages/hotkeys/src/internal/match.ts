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

  // Letter from event.code, only if no letter was typed.
  if (event.code?.startsWith("Key") && !/^[A-Za-z]$/.test(primary)) {
    const codeLetter = event.code.slice(3);
    if (/^[A-Za-z]$/.test(codeLetter)) {
      keys.push(codeLetter.toUpperCase());
    }
  }

  // Digit from event.code, only while Shift/Alt rewrites the character (see JSDoc).
  if ((event.shiftKey || event.altKey) && event.code?.startsWith("Digit")) {
    const codeDigit = event.code.slice(5);
    if (/^[0-9]$/.test(codeDigit) && codeDigit !== primary) {
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
  if (event.ctrlKey !== parsed.ctrl) return false;
  if (event.shiftKey !== parsed.shift) return false;
  if (event.altKey !== parsed.alt) return false;
  if (event.metaKey !== parsed.meta) return false;

  const hotkeyKey = parsed.key;
  const candidates = getCandidateKeys(event);

  if (hotkeyKey.length === 1) {
    return candidates.some((k) => k.length === 1 && k.toUpperCase() === hotkeyKey.toUpperCase());
  }

  return candidates[0] === hotkeyKey;
}
