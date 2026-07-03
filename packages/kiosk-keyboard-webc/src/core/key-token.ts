/** The `{layout:base}` target name: switches back to the tracked base layout. */
export const LAYOUT_BASE = "base";

/**
 * What an on-screen key does, parsed once from its authored `value` string.
 * Every consumer (click/tap dispatch, composition, styling, physical-key
 * highlight) reads this typed result instead of re-parsing the brace-token
 * string, so the grammar lives in exactly one place.
 */
export type KeyAction =
  | { kind: "char"; text: string }
  | { kind: "shift" }
  | { kind: "backspace" }
  | { kind: "enter" }
  | { kind: "layout"; target: string }
  | { kind: "fkey"; name: string }
  | { kind: "unknown"; raw: string };

/** Discriminant of {@link KeyAction}. */
export type KeyActionKind = KeyAction["kind"];

/**
 * Sole parser of the brace-token grammar (`{shift}`, `{backspace}`, `{enter}`,
 * `{layout:*}`, `{fkey:*}`). Returns a fully typed {@link KeyAction}:
 *
 * - `{layout:NAME}`: `target` is trimmed and lowercased to match the
 *   case-insensitive layout registry (`base` is the sentinel that returns to the
 *   tracked base layout).
 * - `{fkey:NAME}`: `name` is trimmed but case-preserved (F-key names and the
 *   `KeyName` enum are case-significant).
 * - Any other fully brace-wrapped value is `unknown` (fires keyPress, inserts
 *   nothing); a lone `{` or `}` is a literal `char`.
 */
export function parseKeyAction(value: string): KeyAction {
  if (value === "{shift}") return { kind: "shift" };
  if (value === "{backspace}") return { kind: "backspace" };
  if (value === "{enter}") return { kind: "enter" };
  if (value.startsWith("{layout:"))
    return { kind: "layout", target: value.slice("{layout:".length, -1).trim().toLowerCase() };
  if (value.startsWith("{fkey:")) return { kind: "fkey", name: value.slice("{fkey:".length, -1).trim() };
  if (value.startsWith("{") && value.endsWith("}")) return { kind: "unknown", raw: value };
  return { kind: "char", text: value };
}

/**
 * Exhaustiveness guard for a {@link KeyAction} switch: once every `kind` is
 * handled the `default` arm narrows to `never` and compiles; adding a variant
 * without its case becomes a build error here rather than a silent no-op.
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled KeyAction: ${JSON.stringify(x)}`);
}
