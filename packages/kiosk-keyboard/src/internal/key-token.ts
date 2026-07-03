/** The kind of on-screen key a `data-key` value represents. */
export type KeyTokenKind = "shift" | "backspace" | "enter" | "layout" | "fkey" | "unknown" | "char";

/**
 * Classifies a key's `data-key` value into its token kind. Centralizes the
 * brace-token grammar (`{shift}`, `{backspace}`, `{enter}`, `{layout:*}`,
 * `{fkey:*}`) so the click/tap dispatch is a single switch instead of a ladder
 * of `startsWith` checks.
 *
 * `layout`/`fkey` match on the opening prefix only; use `parseLayoutToken` to
 * read a `{layout:*}` name. Any other fully brace-wrapped value is `unknown`
 * (fires keyPress but inserts nothing); everything else is a literal `char`.
 */
export function classifyKeyToken(value: string): KeyTokenKind {
  if (value === "{shift}") return "shift";
  if (value === "{backspace}") return "backspace";
  if (value === "{enter}") return "enter";
  if (value.startsWith("{layout:")) return "layout";
  if (value.startsWith("{fkey:")) return "fkey";
  if (value.startsWith("{") && value.endsWith("}")) return "unknown";
  return "char";
}

/** The `{layout:base}` target name: switches back to the tracked base layout. */
export const LAYOUT_BASE = "base";

/**
 * Target name of a `{layout:NAME}` value, trimmed and lowercased to match the
 * case-insensitive layout registry (or `null` if not a layout token). Sole
 * owner of the `{layout:*}` name grammar.
 */
export function parseLayoutToken(value: string): string | null {
  return value.startsWith("{layout:") ? value.slice("{layout:".length, -1).trim().toLowerCase() : null;
}
