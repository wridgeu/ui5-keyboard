import type { LayoutDefinition } from "../types.js";
import { parseKeyAction, LAYOUT_BASE } from "./key-token.js";

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

/**
 * Reshapes `{layout:base}` keys shown under the Numpad/Numeric constraint. The
 * key is dropped when useless (`layoutName` is the constrained layout, or a
 * sibling key already routes back to it); otherwise it is the only way back and
 * is relabeled to `returnKey` (the "ABC" label misleads: it returns to numbers,
 * not letters). A key's own `ariaLabel` wins. Non-mutating.
 */
export function reconcileBaseSwitch(
  layout: LayoutDefinition,
  layoutName: string,
  constrainedName: string,
  returnKey: { icon: string; ariaLabel: string },
): LayoutDefinition {
  const useless =
    layoutName === constrainedName ||
    layout.some((row) =>
      row.some((key) => {
        const action = parseKeyAction(key.value);
        return action.kind === "layout" && action.target === constrainedName;
      }),
    );
  let changed = false;
  const next = layout.map((row) =>
    row.flatMap((key) => {
      const action = parseKeyAction(key.value);
      if (!(action.kind === "layout" && action.target === LAYOUT_BASE)) return [key];
      changed = true;
      if (useless) return [];
      return [{ ...key, label: "", icon: returnKey.icon, ariaLabel: key.ariaLabel ?? returnKey.ariaLabel }];
    }),
  );
  return changed ? next.filter((row) => row.length > 0) : layout;
}
