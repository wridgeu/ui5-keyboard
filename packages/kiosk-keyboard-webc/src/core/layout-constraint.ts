/**
 * The layout name a `keyboardType` constrains the surface to, or `null` when the
 * type imposes no constraint. The argument is the `KeyboardType` enum's string
 * value (`"Full"` | `"Numpad"` | `"Numeric"`); both twins pass their enum
 * member, whose runtime value is that string.
 *
 * Single source for the keyboardType -> forced-layout mapping that layout
 * resolution consults in two places per twin; a new constrained type is a
 * one-line change here instead of four ternaries kept in lockstep.
 */
export function constrainedLayoutName(keyboardType: string): string | null {
  if (keyboardType === "Numpad") return "numpad";
  if (keyboardType === "Numeric") return "numeric";
  return null;
}
