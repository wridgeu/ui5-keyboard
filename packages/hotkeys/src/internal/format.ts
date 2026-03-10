import { KEY_DISPLAY_SYMBOLS, MAC_MODIFIER_SYMBOLS, STANDARD_MODIFIER_LABELS } from "./constants";
import { Platform } from "../library";
import { parseHotkey } from "./parse";
import { detectPlatform } from "./platform";

/**
 * Format a hotkey string for display, using platform-appropriate symbols.
 *
 * - **macOS**: Uses symbols without separators - `⇧⌘S`
 * - **Windows/Linux**: Uses text labels with `+` separators - `Ctrl+Shift+S`
 *
 * Special keys (arrows, Enter, Escape, etc.) are replaced with display symbols
 * or short labels.
 *
 * @param hotkey - The hotkey string to format (e.g., "Mod+Shift+S").
 * @param platform - Override platform detection.
 * @returns The formatted display string.
 */
export function formatForDisplay(hotkey: string, platform?: Platform): string {
  const p = platform ?? detectPlatform();
  const parsed = parseHotkey(hotkey, p);

  const keyDisplay = KEY_DISPLAY_SYMBOLS[parsed.key] ?? parsed.key;

  if (p === Platform.Mac) {
    const modSymbols = parsed.modifiers.map((m) => MAC_MODIFIER_SYMBOLS[m]);
    return modSymbols.join("") + keyDisplay;
  }

  const modLabels = parsed.modifiers.map((m) => STANDARD_MODIFIER_LABELS[m]);
  return [...modLabels, keyDisplay].join("+");
}
