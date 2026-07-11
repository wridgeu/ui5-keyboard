/** The `{layout:base}` target name: switches back to the tracked base layout. */
export const LAYOUT_BASE = "base";

/** What an on-screen key does, parsed from its authored `value` string. */
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
 *   tracked base layout). An empty target (`{layout:}`) is `unknown`.
 * - `{fkey:NAME}`: `name` is trimmed but case-preserved (F-key names and the
 *   `KeyName` enum are case-significant). An empty name (`{fkey:}`) is `unknown`.
 * - Any other fully brace-wrapped value is `unknown` (fires keyPress, inserts
 *   nothing); a lone `{`/`}`, or a token missing its closing brace, is a literal
 *   `char`.
 */
export function parseKeyAction(value: string): KeyAction {
  if (value.startsWith("{") && value.endsWith("}")) {
    const body = value.slice(1, -1);
    if (body === "shift") return { kind: "shift" };
    if (body === "backspace") return { kind: "backspace" };
    if (body === "enter") return { kind: "enter" };

    const separator = body.indexOf(":");
    if (separator !== -1) {
      const prefix = body.slice(0, separator);
      const arg = body.slice(separator + 1).trim();
      if (prefix === "layout" && arg) return { kind: "layout", target: arg.toLowerCase() };
      if (prefix === "fkey" && arg) return { kind: "fkey", name: arg };
    }
    return { kind: "unknown", raw: value };
  }
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
