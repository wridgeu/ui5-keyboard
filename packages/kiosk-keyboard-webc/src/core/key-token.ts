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
 * Whether a key spends a latched one-shot Shift.
 *
 * The spending set is a pure function of the key (#240): every key that acts on
 * the target spends the latch - a character, `{backspace}`, `{enter}`, an
 * `{fkey:*}`, an unrecognized `{...}` token, a committed accent variant, or a
 * key the composition middleware consumed - and a veto does not change that
 * (#241), because the latch is consumed to produce the payload. The two
 * exceptions are the modifier itself and `{layout:*}`, which resets the whole
 * typing context rather than spending anything.
 *
 * Written as an exhaustive switch on purpose: a new {@link KeyAction} variant
 * fails to compile here until someone decides whether it spends, rather than
 * inheriting an answer from whichever branch happens to call `autoRelease()`.
 *
 * The `layout` arm records intent rather than observable behavior: a layout
 * switch resets the whole shift state, Caps Lock included, so a spend on top of
 * that reset cannot be seen from outside. Flipping this arm alone breaks no
 * test, and that is expected - do not "fix" it with one.
 */
export function spendsOneShotShift(kind: KeyActionKind): boolean {
  switch (kind) {
    case "shift":
    case "layout":
      return false;
    case "char":
    case "backspace":
    case "enter":
    case "fkey":
    case "unknown":
      return true;
  }
}

/**
 * Exhaustiveness guard for a {@link KeyAction} switch: once every `kind` is
 * handled the `default` arm narrows to `never` and compiles; adding a variant
 * without its case becomes a build error here rather than a silent no-op.
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled KeyAction: ${JSON.stringify(x)}`);
}
