/**
 * The layout name a `keyboardType` constrains the surface to, or `null` when the
 * type imposes no constraint. The argument is the `KeyboardType` enum's string
 * value (`"Full"` | `"Numpad"` | `"Numeric"`).
 */
export function constrainedLayoutName(keyboardType: string): string | null {
  if (keyboardType === "Numpad") return "numpad";
  if (keyboardType === "Numeric") return "numeric";
  return null;
}
