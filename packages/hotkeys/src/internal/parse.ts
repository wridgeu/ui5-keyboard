import { MODIFIER_ALIASES, MODIFIER_KEYS, MODIFIER_ORDER, normalizeKeyName } from "./constants";
import { Platform } from "../library";
import { detectPlatform, resolveModifier } from "./platform";
import type { CanonicalModifier, ParsedHotkey } from "../types";

/**
 * Parse a hotkey string into its constituent parts.
 *
 * Supports formats like:
 * - `"Mod+S"` — platform-aware modifier
 * - `"Ctrl+Shift+K"` — explicit modifiers
 * - `"Escape"` — standalone key
 * - `"Mod++"` — literal "+" key (last segment after split)
 *
 * @param hotkey - The hotkey string to parse.
 * @param platform - Override platform for Mod resolution. Defaults to detected platform.
 * @returns The parsed hotkey representation.
 * @throws Error if the hotkey string is empty or contains no non-modifier key.
 */
export function parseHotkey(hotkey: string, platform?: Platform): ParsedHotkey {
  if (!hotkey) {
    throw new Error("Hotkey string must not be empty");
  }

  const p = platform ?? detectPlatform();

  // Split on "+" then detect literal "+" from the resulting empty strings.
  //
  // Examples:
  //   "Ctrl+Shift+S"  → ["Ctrl", "Shift", "S"]         → key = "S"
  //   "+"             → ["", ""]                        → trailing empty  → key = "+"
  //   "Ctrl++"        → ["Ctrl", "", ""]                → two trailing empties → key = "+"
  //   "Ctrl+Shift++"  → ["Ctrl", "Shift", "", ""]       → two trailing empties → key = "+"
  //
  // The trailing-empty check is intentionally position-dependent: only the
  // last one or two empty segments are interpreted as a literal "+".  Leading
  // or interior empty segments (which would indicate consecutive delimiters
  // with no modifier between them, e.g. "++S") are skipped/ignored.
  const parts = hotkey.split("+");

  const modifiers = new Set<CanonicalModifier>();
  let key: string | null = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();

    // Trailing empty → literal "+" key (e.g. "+" → ["", ""])
    if (part === "" && i === parts.length - 1) {
      key = "+";
      continue;
    }
    // Two trailing empties → literal "+" with modifier (e.g. "Ctrl++" → ["Ctrl", "", ""])
    if (part === "" && i > 0 && i === parts.length - 2 && parts[i + 1] === "") {
      key = "+";
      break;
    }
    // Interior empty (e.g. leading "+" or typo) — skip
    if (part === "") {
      continue;
    }

    const modAlias = MODIFIER_ALIASES[part];
    if (modAlias) {
      const resolved = resolveModifier(modAlias, p);
      modifiers.add(resolved);
    } else if (key === null) {
      key = normalizeKeyName(part);
    } else {
      throw new Error(`Invalid hotkey "${hotkey}": unexpected segment "${part}" after key "${key}"`);
    }
  }

  if (key === null) {
    throw new Error(`Invalid hotkey "${hotkey}": no non-modifier key found`);
  }

  // Build ordered modifier list
  const orderedModifiers = MODIFIER_ORDER.filter((m) => modifiers.has(m));

  return {
    key,
    ctrl: modifiers.has("Control"),
    shift: modifiers.has("Shift"),
    alt: modifiers.has("Alt"),
    meta: modifiers.has("Meta"),
    modifiers: orderedModifiers,
  };
}

/**
 * Normalize a hotkey string to its canonical form.
 *
 * Resolves aliases, applies canonical modifier order, and normalizes the key name.
 *
 * @example
 * normalizeHotkey("cmd+shift+s") // => "Shift+Meta+S" (on Mac)
 * normalizeHotkey("Mod+S")       // => "Control+S" (on Windows/Linux)
 */
export function normalizeHotkey(hotkey: string, platform?: Platform): string {
  const parsed = parseHotkey(hotkey, platform);
  const parts = [...parsed.modifiers, parsed.key];
  return parts.join("+");
}

/**
 * Convert a KeyboardEvent to a hotkey string.
 *
 * Returns the hotkey in canonical form (e.g., "Control+Shift+S").
 * Returns `null` for modifier-only presses (no action key).
 *
 * @param event - The keyboard event to convert.
 * @returns The hotkey string, or `null` for modifier-only events.
 */
export function keyboardEventToHotkey(event: KeyboardEvent): string | null {
  const key = event.key;

  // Modifier-only presses don't form a hotkey
  if (MODIFIER_KEYS.has(key)) {
    return null;
  }

  // Follow canonical MODIFIER_ORDER
  const modifierFlags: Record<CanonicalModifier, boolean> = {
    Control: event.ctrlKey,
    Alt: event.altKey,
    Shift: event.shiftKey,
    Meta: event.metaKey,
  };
  const modifiers = MODIFIER_ORDER.filter((m) => modifierFlags[m]);

  const normalizedKey = normalizeKeyName(key);
  return [...modifiers, normalizedKey].join("+");
}

/**
 * Convert a platform-specific hotkey to use the cross-platform "Mod" modifier.
 *
 * - On Mac: "Meta+S" → "Mod+S"
 * - On Windows/Linux: "Control+S" → "Mod+S"
 *
 * Only converts when the sole platform modifier is present (not mixed Control+Meta).
 * Returns the original string if no conversion applies.
 *
 * @param hotkey - The hotkey string to convert (e.g., "Control+Shift+S").
 * @param platform - Override platform detection.
 * @returns The hotkey with Mod substitution where applicable.
 */
export function convertToModFormat(hotkey: string, platform?: Platform): string {
  const p = platform ?? detectPlatform();
  const parsed = parseHotkey(hotkey, p);

  const platformMod: CanonicalModifier = p === Platform.Mac ? "Meta" : "Control";
  const otherMod: CanonicalModifier = p === Platform.Mac ? "Control" : "Meta";

  // Only convert if the platform modifier is present and the other is not
  if (!parsed.modifiers.includes(platformMod) || parsed.modifiers.includes(otherMod)) {
    return hotkey;
  }

  // Replace the platform modifier with "Mod"
  const modParts = parsed.modifiers.filter((m) => m !== platformMod).map((m) => (m === "Control" ? "Ctrl" : m));

  return ["Mod", ...modParts, parsed.key].join("+");
}
