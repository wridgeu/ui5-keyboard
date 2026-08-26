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
 *
 * Convention: camelCase-BEM matching UI5 core (the webc twin uses kebab-BEM).
 * KEY names are shared across twins; string casing diverges by framework.
 * Guarded by `tools/check-dom-contract-drift.mjs`; shared `attributes` are identical.
 *
 * The mutually-exclusive key category is a class (`keyModifier`/`keyAction`), not
 * a data attribute: styles layer interactive state (`:active`, `keyCapsLock`,
 * `keyShiftActive`) on top of the category, and in the light DOM only a
 * namespaced class is simultaneously scoped and specificity `(0,1,0)`. A scoped
 * attribute selector would be `(0,2,0)` and would bury the state-indicator rules
 * (the caps-lock ring). Width (`keySpan`), the fkey flag and the glyph script
 * carry no layered state, so they stay attributes. The webc twin keeps the same
 * class/attribute split.
 */

export const KIOSK_KEYBOARD_DOM = Object.freeze({
  classes: Object.freeze({
    root: "ui5KioskKeyboard",
    rootDocked: "ui5KioskKeyboard--docked",
    rootClosed: "ui5KioskKeyboard--closed",
    rootDisabled: "ui5KioskKeyboard--disabled",
    rootCqShort: "ui5KioskKeyboard--cqShort",
    rootCqTiny: "ui5KioskKeyboard--cqTiny",
    liveRegion: "ui5KioskKeyboard__liveRegion",
    row: "ui5KioskRow",
    key: "ui5KioskKey",
    keyModifier: "ui5KioskKey--modifier",
    keyAction: "ui5KioskKey--action",
    keyShiftActive: "ui5KioskKey--shiftActive",
    keyCapsLock: "ui5KioskKey--capsLock",
    keyPressed: "ui5KioskKey--pressed",
    keyHighlight: "ui5KioskKey--highlight",
    keyVariantAnchor: "ui5KioskKey--variantAnchor",
    keyLabel: "ui5KioskKey__label",
    keyLabelGlyph: "ui5KioskKey__label--glyph",
    keyLabelMulti: "ui5KioskKey__label--multi",
    keyIcon: "ui5KioskKey__icon",
    keyDual: "ui5KioskKey--dual",
    variantPopover: "ui5KioskVariantPopover",
    variantPopup: "ui5KioskVariantPopup",
    variantOption: "ui5KioskVariantPopup__option",
  }),
  attributes: Object.freeze({
    key: "data-key",
    shiftValue: "data-shift-value",
    rowKind: "data-row-kind",
    /** Presence attribute on function keys (`{fkey:*}`); orthogonal to the modifier/action category. */
    fkey: "data-fkey",
    /** Script family of a single-glyph label (`cjk` | `hangul` | `indic` | `arabic`). */
    glyphScript: "data-glyph-script",
    /** Proportional key-width token, carried verbatim (`1.5`, `2`, `space`, ...). */
    keySpan: "data-key-span",
    /** Marks a key whose effective `variants` list is non-empty (the long-press gate). */
    hasVariants: "data-has-variants",
    /**
     * Zero-based index of the key's row in the resolved layout; with
     * {@link keyIndex}, the grid coordinate arrow-key navigation moves on.
     */
    rowIndex: "data-row-index",
    /** Zero-based index of the key within its row. See {@link rowIndex}. */
    keyIndex: "data-key-index",
  }),
  selectors: Object.freeze({
    root: ".ui5KioskKeyboard",
    row: ".ui5KioskRow",
    key: ".ui5KioskKey",
    focusableKey: '.ui5KioskKey[tabindex="0"]',
    keyByValue: (value: string) => `[data-key="${CSS.escape(value)}"]`,
    keyByShiftValue: (value: string) => `[data-shift-value="${CSS.escape(value)}"]`,
    keyByPosition: (row: number, col: number) => `[data-row-index="${row}"][data-key-index="${col}"]`,
    variantPopover: ".ui5KioskVariantPopover",
    variantPopup: ".ui5KioskVariantPopup",
    variantOption: ".ui5KioskVariantPopup__option",
  }),
  keyboardTypeClass(type: string): string {
    return `ui5KioskKeyboard--${type.toLowerCase()}`;
  },
} as const);

export type KioskKeyboardDomContract = typeof KIOSK_KEYBOARD_DOM;
