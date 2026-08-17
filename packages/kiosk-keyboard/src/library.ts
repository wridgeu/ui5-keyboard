import DataType from "sap/ui/base/DataType";
import type { LayoutDefinition } from "./types";
import type { VariantTable } from "./internal/latin-variants";
import Lib from "sap/ui/core/Lib";
import "sap/m/library"; // resolve dependency before Lib.init()

/**
 * Built-in keyboard layout identifiers.
 *
 * Values match the layout registry keys (lowercase with hyphens).
 *
 * @enum {string}
 * @public
 * @since 0.1.0
 */
export enum KeyboardLayout {
  /** Standard QWERTY layout. */
  Qwerty = "qwerty",
  /** German QWERTZ layout with Umlaute. */
  QwertzDe = "qwertz-de",
  /** Numeric layout with number pad and basic operators. */
  Numeric = "numeric",
  /** Special characters layout. */
  Special = "special",
  /** Compact numeric keypad layout. */
  Numpad = "numpad",
  /** Function keys F1-F12 standalone layout. */
  Fkeys = "fkeys",
  /** Navigation keys (arrows, Home/End, Page keys) standalone layout. */
  Nav = "nav",
  /** Japanese Romaji layout (QWERTY base with JIS punctuation). */
  JaRomaji = "ja-romaji",
  /** Japanese Kana direct-input layout (JIS X 6002). */
  JaKana = "ja-kana",
  /** Japanese Kana direct-input layout for narrow keyboards, every row at twelve key widths. */
  JaKanaCompact = "ja-kana-compact",
  /** Arabic keyboard layout (standard Arabic 101). */
  Arabic = "arabic",
  /** Korean Hangul Dubeolsik layout (KS X 5002). */
  KoHangul = "ko-hangul",
  /** Spanish QWERTY layout with accented vowels and inverted punctuation. */
  QwertyEs = "qwerty-es",
}

/**
 * Keyboard display type.
 *
 * @enum {string}
 * @public
 * @since 0.1.0
 */
export enum KeyboardType {
  /** Full alphabetic keyboard with all keys. */
  Full = "Full",
  /** Numeric layout with number pad and basic operators. */
  Numeric = "Numeric",
  /** Compact numeric keypad only. */
  Numpad = "Numpad",
}

/**
 * Controls native keyboard behavior on mobile/touch devices.
 *
 * @enum {string}
 * @public
 * @since 0.1.0
 */
export enum MobileKeyboard {
  /** Always use KioskKeyboard, suppress native keyboard via `inputmode="none"`. Best for dedicated kiosk terminals without a physical keyboard. */
  Custom = "Custom",
  /** Always defer to the native keyboard - KioskKeyboard will not open on focus. */
  Native = "Native",
  /** Desktop browsers use KioskKeyboard, phones/tablets defer to native. On a regular laptop/desktop with a physical keyboard the virtual keyboard will still appear; use `Native` if that is not desired. */
  Auto = "Auto",
}

/**
 * Controls how virtual F-key taps are dispatched.
 *
 * @enum {string}
 * @public
 * @since 0.1.0
 */
export enum FKeyMode {
  /** Virtual mode: fire `keyPress` only (application handles behavior). */
  Virtual = "Virtual",
  /** Native mode: dispatch synthetic `keydown` and run built-in native actions for selected keys. */
  Native = "Native",
  /** None: fire `keyPress` only, skip native dispatch and built-in navigation actions. */
  None = "None",
}

/**
 * Key names used in the `keyPress` event's `key` parameter.
 *
 * Regular character keys fire their literal value (e.g. `"a"`, `"A"`, `"1"`,
 * `"!"`). This enum covers all **non-character** key names that the keyboard
 * can fire - action keys, function keys, and navigation keys.
 *
 * Values align with the standard {@link https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key | KeyboardEvent.key}
 * names where applicable.
 *
 * @example <caption>TypeScript - intercept Enter in a keyPress handler</caption>
 * import { KeyName } from "ui5/kiosk/library";
 *
 * keyboard.attachKeyPress((event) => {
 *   if (event.getParameter("key") === KeyName.Enter) {
 *     event.preventDefault();
 *     advanceToNextField();
 *   }
 * });
 *
 * @public
 * @since 0.1.0
 */
export const KeyName = Object.freeze({
  // Action keys
  /** Enter / Return key. */
  Enter: "Enter",
  /** Backspace (delete backward). */
  Backspace: "Backspace",

  // Function keys
  /** Function key F1. */ F1: "F1",
  /** Function key F2. */ F2: "F2",
  /** Function key F3. */ F3: "F3",
  /** Function key F4. */ F4: "F4",
  /** Function key F5. */ F5: "F5",
  /** Function key F6. */ F6: "F6",
  /** Function key F7. */ F7: "F7",
  /** Function key F8. */ F8: "F8",
  /** Function key F9. */ F9: "F9",
  /** Function key F10. */ F10: "F10",
  /** Function key F11. */ F11: "F11",
  /** Function key F12. */ F12: "F12",

  // Navigation keys
  /** Left arrow - moves caret one character left. */
  ArrowLeft: "ArrowLeft",
  /** Right arrow - moves caret one character right. */
  ArrowRight: "ArrowRight",
  /** Up arrow - moves caret up one line (textarea only). */
  ArrowUp: "ArrowUp",
  /** Down arrow - moves caret down one line (textarea only). */
  ArrowDown: "ArrowDown",
  /** Home - moves caret to start of text. */
  Home: "Home",
  /** End - moves caret to end of text. */
  End: "End",
  /** Page Up - moves caret to start of text. */
  PageUp: "PageUp",
  /** Page Down - moves caret to end of text. */
  PageDown: "PageDown",
} as const);

/**
 * Keys that are allowed for synthetic native `keydown` dispatch in
 * `fKeyMode="Native"`.
 *
 * Custom `{fkey:...}` names still fire `keyPress`, but are intentionally
 * excluded from native dispatch and native action execution.
 *
 * @public
 * @since 0.1.0
 */
export const NativeDispatchableKeyNames = Object.freeze([
  KeyName.F1,
  KeyName.F2,
  KeyName.F3,
  KeyName.F4,
  KeyName.F5,
  KeyName.F6,
  KeyName.F7,
  KeyName.F8,
  KeyName.F9,
  KeyName.F10,
  KeyName.F11,
  KeyName.F12,
  KeyName.ArrowLeft,
  KeyName.ArrowRight,
  KeyName.ArrowUp,
  KeyName.ArrowDown,
  KeyName.Home,
  KeyName.End,
  KeyName.PageUp,
  KeyName.PageDown,
] as const);

DataType.registerEnum("ui5.kiosk.KeyboardLayout", KeyboardLayout);
DataType.registerEnum("ui5.kiosk.KeyboardType", KeyboardType);
DataType.registerEnum("ui5.kiosk.MobileKeyboard", MobileKeyboard);
DataType.registerEnum("ui5.kiosk.FKeyMode", FKeyMode);

/**
 * Whether a layout is an auxiliary surface or a base alphabetic layout. A secondary
 * layout is never tracked as the base, so `{layout:base}` returns to the alphabetic
 * layout it was reached from.
 *
 * @enum {string}
 * @public
 * @since 0.1.0
 */
export enum LayoutRole {
  /**
   * Takes the built-in layout of the same name's role, and the base alphabetic role
   * when there is no built-in of that name.
   */
  Inherit = "Inherit",
  /** A base alphabetic layout, even when the built-in of the same name is secondary. */
  Base = "Base",
  /** An auxiliary surface: numbers, symbols, F-keys, navigation. */
  Secondary = "Secondary",
}

/**
 * A per-layout facet whose inherited value a custom layout discards. A listed facet
 * resolves to nothing at that custom layout's position: the built-in tier and every
 * earlier custom layout's contribution are dropped, and only a value the same custom
 * layout declares survives.
 *
 * Rows are not listed: the built-in registry is sealed, so a custom layout shadows rows
 * and never removes them.
 *
 * @enum {string}
 * @public
 * @since 0.1.0
 */
export enum LayoutFacet {
  /** Long-press accent variants. Suppressed, the layout's keys carry no long-press affordance. */
  Variants = "Variants",
  /** Composition (IME / dead-key) middleware. Suppressed, the layout's keys type directly. */
  Middleware = "Middleware",
}

/**
 * A layout's rows, or `null` for a custom layout that overlays an existing layout.
 *
 * Validation here is deliberately coarse: `ManagedObject` throws when a type rejects a
 * value, which would turn one malformed layout into a broken control. The shape check
 * that reports and skips lives in the fold.
 */
function isLayoutRows(value: unknown): boolean {
  return value === null || Array.isArray(value);
}

/** A long-press variant table, or `null` for none. Per-entry validation is the fold's. */
function isVariantTable(value: unknown): boolean {
  // The `object` base type this one derives from accepts a function as well, and UI5 runs the base
  // check first, so the `typeof` here is what rejects one.
  return value === null || (typeof value === "object" && !Array.isArray(value));
}

/**
 * One entry of a comma-separated attribute list. UI5's array parser splits on commas
 * without trimming, so whitespace an author writes around a comma reaches the entry
 * beside it. That whitespace separates entries and is never part of one.
 */
function trimToken(value: string): string {
  return value.trim();
}

/**
 * The whole list, for values that arrive already split: a settings object, a model
 * binding, a `set*` call. An empty token names nothing, so it carries no entry.
 */
function normalizeTokens(values: string[]): string[] {
  return values.map(trimToken).filter((token) => token !== "");
}

const LAYOUT_FACET_NAMES: string[] = Object.values(LayoutFacet);

/** Whether a token names a `LayoutFacet` member. The `string` base has checked it first. */
function isLayoutFacetName(value: string): boolean {
  return LAYOUT_FACET_NAMES.includes(value);
}

DataType.registerEnum("ui5.kiosk.LayoutRole", LayoutRole);
DataType.createType("ui5.kiosk.LayoutRows", { defaultValue: null, isValid: isLayoutRows }, "object");
DataType.createType("ui5.kiosk.VariantOverrideTable", { defaultValue: null, isValid: isVariantTable }, "object");

/**
 * One entry of `controls`. It carries no check of its own: any string is a well-formed
 * id, and the fault worth catching - an id that names nothing - is the delegation
 * controller's to report.
 */
DataType.createType("ui5.kiosk.ControlID", { parseValue: trimToken }, "string");
// Only a value parsed from an XML attribute passes through `parseValue`; a list assigned
// programmatically or delivered by a model arrives whole, so the list normalizes on write too.
DataType.getType("ui5.kiosk.ControlID[]")!.setNormalizer(normalizeTokens);

/**
 * One entry of `suppress`: a validated string rather than a registered enum, whose parser
 * would read the space in `suppress="Variants, Middleware"` as a misspelling. `defaultValue`
 * is required here - without it the type inherits the `string` base's `""`, which its own
 * `isValid` rejects. See `docs/specs/2026-08-05-token-list-attributes-design.md` §4.1.
 */
DataType.createType(
  "ui5.kiosk.LayoutFacet",
  { defaultValue: LayoutFacet.Variants, isValid: isLayoutFacetName, parseValue: trimToken },
  "string",
);

const library = Lib.init({
  apiVersion: 2,
  name: "ui5.kiosk",
  version: "${version}",
  dependencies: ["sap.ui.core", "sap.m"],
  types: [
    "ui5.kiosk.KeyboardLayout",
    "ui5.kiosk.KeyboardType",
    "ui5.kiosk.MobileKeyboard",
    "ui5.kiosk.FKeyMode",
    "ui5.kiosk.LayoutRole",
    "ui5.kiosk.LayoutFacet",
    "ui5.kiosk.LayoutRows",
    "ui5.kiosk.VariantOverrideTable",
    "ui5.kiosk.ControlID",
  ],
  interfaces: [],
  controls: ["ui5.kiosk.KioskKeyboard"],
  // What lets XMLTemplateProcessor resolve `<kiosk:CustomLayout>` out of the namespace.
  elements: ["ui5.kiosk.CustomLayout"],
  noLibraryCSS: false,
});

export default library;

/**
 * The built-in Latin-diacritic accent-variant table and its type, re-exported so
 * consumers can spread it to extend the defaults when supplying a variant table.
 *
 * @public
 * @since 0.1.0
 */
export { LATIN_DIACRITIC_VARIANTS } from "./internal/latin-variants";
// Separate `export type`: the transpile pipeline does not honour an inline
// `type` modifier on a re-export, and would assign the type name onto the
// library object at runtime, publishing an undefined ui5.kiosk member.
export type { VariantTable } from "./internal/latin-variants";

/**
 * The shapes the row and variant-table properties accept, each `null` for "not
 * supplied". The interface generator emits no `| null` union of its own for a custom
 * type, so the null lives in the alias, and a registered `DataType` name with no
 * exported alias of the same name makes the generator emit an import of a module that
 * does not exist.
 *
 * `VariantOverrideTable` is deliberately not spelled `VariantTable`: that name is
 * already exported above as the non-nullable table type consumers spread.
 *
 * @public
 * @since 0.1.0
 */
export type LayoutRows = LayoutDefinition | null;
export type VariantOverrideTable = VariantTable | null;

/**
 * One entry of the `controls` list: the id of a control the keyboard targets.
 *
 * @public
 * @since 0.1.0
 */
export type ControlID = string;
