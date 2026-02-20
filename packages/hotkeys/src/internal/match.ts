import { normalizeKeyName } from "./constants";
import type { ParsedHotkey } from "../types";

/**
 * Check whether a KeyboardEvent matches a parsed hotkey.
 *
 * Matching rules:
 * 1. **Exact modifier match** — The event must have exactly the same modifier
 *    state. Ctrl+Shift+S does NOT match a hotkey registered for Ctrl+S.
 * 2. **Primary key via `event.key`** — Case-insensitive comparison for single
 *    characters, exact match for special keys (Escape, F5, etc.).
 * 3. **Fallback to `event.code`** — For letter keys (KeyA-KeyZ) when `event.key`
 *    returns a special character (e.g., macOS Option+D produces "∂"), and for
 *    digit keys (Digit0-Digit9) when Shift changes the key (e.g., Shift+4
 *    produces "$").
 */
export function matchesKeyboardEvent(event: KeyboardEvent, parsed: ParsedHotkey): boolean {
  // Exact modifier match — no extra modifiers allowed
  if (event.ctrlKey !== parsed.ctrl) return false;
  if (event.shiftKey !== parsed.shift) return false;
  if (event.altKey !== parsed.alt) return false;
  if (event.metaKey !== parsed.meta) return false;

  // Key matching
  const eventKey = normalizeKeyName(event.key);
  const hotkeyKey = parsed.key;

  // Single-character key comparison
  if (eventKey.length === 1 && hotkeyKey.length === 1) {
    // Primary: compare via event.key (layout-aware)
    if (eventKey.toUpperCase() === hotkeyKey.toUpperCase()) {
      return true;
    }

    // Fallback: event.code for letter keys (macOS Option+letter edge case)
    if (event.code?.startsWith("Key")) {
      const codeLetter = event.code.slice(3);
      if (codeLetter.length === 1 && /^[A-Za-z]$/.test(codeLetter)) {
        return codeLetter.toUpperCase() === hotkeyKey.toUpperCase();
      }
    }

    // Fallback: event.code for digit keys (Shift+digit edge case)
    if (event.code?.startsWith("Digit")) {
      const codeDigit = event.code.slice(5);
      if (codeDigit.length === 1 && /^[0-9]$/.test(codeDigit)) {
        return codeDigit === hotkeyKey;
      }
    }

    return false;
  }

  // Special keys: exact match after normalization
  return eventKey === hotkeyKey;
}
