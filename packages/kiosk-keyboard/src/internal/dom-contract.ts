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
    rootCqShort: "ui5KioskKeyboard--cqShort",
    rootCqTiny: "ui5KioskKeyboard--cqTiny",
    row: "ui5KioskRow",
    key: "ui5KioskKey",
    keySpace: "ui5KioskKey--wspace",
    keyModifier: "ui5KioskKey--modifier",
    keyAction: "ui5KioskKey--action",
    keyShiftActive: "ui5KioskKey--shiftActive",
    keyCapsLock: "ui5KioskKey--capsLock",
    keyPressed: "ui5KioskKey--pressed",
    keyHighlight: "ui5KioskKey--highlight",
    keyVariantAnchor: "ui5KioskKey--variantAnchor",
    keyLabel: "ui5KioskKey__label",
    keyLabelGlyph: "ui5KioskKey__label--glyph",
    keyLabelGlyphCjk: "ui5KioskKey__label--glyphCjk",
    keyLabelGlyphHangul: "ui5KioskKey__label--glyphHangul",
    keyLabelGlyphIndic: "ui5KioskKey__label--glyphIndic",
    keyLabelGlyphArabic: "ui5KioskKey__label--glyphArabic",
    keyLabelMulti: "ui5KioskKey__label--multi",
    keyIcon: "ui5KioskKey__icon",
    keyDual: "ui5KioskKey--dual",
    keyFkey: "ui5KioskKey--fkey",
    variantPopover: "ui5KioskVariantPopover",
    variantPopup: "ui5KioskVariantPopup",
    variantOption: "ui5KioskVariantPopup__option",
  }),
  attributes: Object.freeze({
    key: "data-key",
    shiftValue: "data-shift-value",
    rowKind: "data-row-kind",
    /** Marks a key whose effective `variants` list is non-empty (the long-press gate). */
    hasVariants: "data-has-variants",
  }),
  selectors: Object.freeze({
    root: ".ui5KioskKeyboard",
    row: ".ui5KioskRow",
    key: ".ui5KioskKey",
    focusableKey: '.ui5KioskKey[tabindex="0"]',
    keyByValue: (value: string) => `[data-key="${CSS.escape(value)}"]`,
    keyByShiftValue: (value: string) => `[data-shift-value="${CSS.escape(value)}"]`,
    variantPopover: ".ui5KioskVariantPopover",
    variantPopup: ".ui5KioskVariantPopup",
    variantOption: ".ui5KioskVariantPopup__option",
  }),
  keyboardTypeClass(type: string): string {
    return `ui5KioskKeyboard--${type.toLowerCase()}`;
  },
  keyWidthClass(width: string): string {
    return width === "space" ? "ui5KioskKey--wspace" : `ui5KioskKey--w${width.replace(".", "")}`;
  },
} as const);

export type KioskKeyboardDomContract = typeof KIOSK_KEYBOARD_DOM;
