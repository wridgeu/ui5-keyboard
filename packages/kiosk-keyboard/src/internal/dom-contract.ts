/**
 * Centralized DOM contract for the kiosk-keyboard package.
 *
 * This module has ZERO dependencies so it can be imported from any tsconfig
 * context (source, QUnit tests, e2e tests) without pulling in UI5 types or
 * generated files.
 *
 * All CSS class names, data attributes, and selector helpers live here.
 * The renderer, source code, and tests all import from this single source
 * of truth.
 */

export const KIOSK_KEYBOARD_DOM = Object.freeze({
  classes: Object.freeze({
    root: "ui5KioskKeyboard",
    rootDocked: "ui5KioskKeyboard--docked",
    rootClosed: "ui5KioskKeyboard--closed",
    rootDisabled: "ui5KioskKeyboard--disabled",
    rootCqShort: "ui5KioskKeyboard--cq-short",
    rootCqTiny: "ui5KioskKeyboard--cq-tiny",
    row: "ui5KioskRow",
    key: "ui5KioskKey",
    keySpace: "ui5KioskKey--space",
    keyModifier: "ui5KioskKey--modifier",
    keyAction: "ui5KioskKey--action",
    keyActive: "ui5KioskKey--active",
    keyCapsLock: "ui5KioskKey--capsLock",
    keyPressed: "ui5KioskKey--pressed",
    keyHighlight: "ui5KioskKey--highlight",
    keyLabel: "ui5KioskKey__label",
    keyLabelGlyph: "ui5KioskKey__label--glyph",
    keyLabelGlyphCjk: "ui5KioskKey__label--glyph-cjk",
    keyLabelGlyphHangul: "ui5KioskKey__label--glyph-hangul",
    keyLabelGlyphIndic: "ui5KioskKey__label--glyph-indic",
    keyLabelGlyphArabic: "ui5KioskKey__label--glyph-arabic",
    keyLabelMulti: "ui5KioskKey__label--multi",
    keyIcon: "ui5KioskKey__icon",
    keyDual: "ui5KioskKey--dual",
    keyFkey: "ui5KioskKey--fkey",
  }),
  attributes: Object.freeze({
    key: "data-key",
    shiftValue: "data-shift-value",
  }),
  selectors: Object.freeze({
    root: ".ui5KioskKeyboard",
    row: ".ui5KioskRow",
    key: ".ui5KioskKey",
    focusableKey: '.ui5KioskKey[tabindex="0"]',
    keyByValue: (value: string) => `[data-key="${CSS.escape(value)}"]`,
    keyByShiftValue: (value: string) => `[data-shift-value="${CSS.escape(value)}"]`,
  }),
  keyboardTypeClass(type: string): string {
    return `ui5KioskKeyboard--${type.toLowerCase()}`;
  },
  keyWidthClass(width: string): string {
    return width === "space" ? "ui5KioskKey--space" : `ui5KioskKey--w${width.replace(".", "-")}`;
  },
} as const);

export type KioskKeyboardDomContract = typeof KIOSK_KEYBOARD_DOM;
