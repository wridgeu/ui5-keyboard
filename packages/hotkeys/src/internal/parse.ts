import { MODIFIER_ALIASES, MODIFIER_KEYS, MODIFIER_ORDER, normalizeKeyName } from "./constants";
import { Platform } from "../library";
import { detectPlatform, resolveModifier } from "./platform";
import type { CanonicalModifier, ParsedHotkey } from "../types";

/**
 * Parse a hotkey string into its constituent parts.
 *
 * Supports formats like:
 * - `"Mod+S"` - platform-aware modifier
 * - `"Ctrl+Shift+K"` - explicit modifiers
 * - `"Escape"` - standalone key
 * - `"Mod++"` - literal "+" key (last segment after split)
 *
 * @param hotkey - The hotkey string to parse.
 * @param platform - Override platform for Mod resolution. Defaults to detected platform.
 * @returns The parsed hotkey representation.
 * @throws Error if the hotkey string is empty or contains no non-modifier key.
 * @since 0.1.0
 */
export function parseHotkey(hotkey: string, platform?: Platform): ParsedHotkey {
  if (!hotkey?.trim()) {
    throw new Error("Hotkey string must not be empty");
  }

  const p = platform ?? detectPlatform();

  const rawParts = hotkey.split("+").map((part) => part.trim());
  let parts: string[] = rawParts;
  let trailingPlusKey = false;

  // Standalone plus key: "+"
  if (rawParts.length === 2 && rawParts[0] === "" && rawParts[1] === "") {
    parts = [];
    trailingPlusKey = true;
  } else if (rawParts.length >= 3 && rawParts.at(-1) === "" && rawParts.at(-2) === "") {
    // Plus key with modifiers: "Ctrl++", "Ctrl+Shift++"
    parts = rawParts.slice(0, -2);
    trailingPlusKey = true;
    if (parts.some((part) => part === "")) {
      throw new Error(`Invalid hotkey "${hotkey}": malformed "+" separators`);
    }
  } else if (rawParts.some((part) => part === "")) {
    throw new Error(`Invalid hotkey "${hotkey}": malformed "+" separators`);
  }

  const modifiers = new Set<CanonicalModifier>();
  let key: string | null = null;

  for (const part of parts) {
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

  if (trailingPlusKey) {
    if (key !== null) {
      throw new Error(`Invalid hotkey "${hotkey}": multiple non-modifier keys`);
    }
    key = "+";
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
 *
 * @param hotkey - The hotkey string to normalize.
 * @param platform - Platform used to resolve the `Mod` pseudo-modifier. Defaults to the detected platform.
 * @returns The canonical hotkey string.
 * @since 0.1.0
 */
export function normalizeHotkey(hotkey: string, platform?: Platform): string {
  return formatParsed(parseHotkey(hotkey, platform));
}

/**
 * Join a parsed hotkey's canonical modifiers and key into the normalized
 * `"Mod1+Mod2+Key"` string used for matching and conflict detection.
 *
 * @param parsed - A parsed hotkey.
 * @returns The canonical normalized hotkey string.
 * @since 0.1.0
 */
export function formatParsed(parsed: ParsedHotkey): string {
  return [...parsed.modifiers, parsed.key].join("+");
}

/**
 * Convert a KeyboardEvent to a hotkey string.
 *
 * Returns the hotkey in canonical form (e.g., "Control+Shift+S").
 * Returns `null` for modifier-only presses (no action key).
 *
 * @param event - The keyboard event to convert.
 * @returns The hotkey string, or `null` for modifier-only events.
 * @since 0.1.0
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
 * @since 0.1.0
 */
export function convertToModFormat(hotkey: string, platform?: Platform): string {
  const p = platform ?? detectPlatform();
  const parsed = parseHotkey(hotkey, p);

  const platformMod = resolveModifier("Mod", p);
  const otherMod: CanonicalModifier = p === Platform.Mac ? "Control" : "Meta";

  // Only convert if the platform modifier is present and the other is not
  if (!parsed.modifiers.includes(platformMod) || parsed.modifiers.includes(otherMod)) {
    return hotkey;
  }

  // Replace the platform modifier with "Mod"
  const modParts = parsed.modifiers.filter((m) => m !== platformMod).map((m) => (m === "Control" ? "Ctrl" : m));

  return ["Mod", ...modParts, parsed.key].join("+");
}
