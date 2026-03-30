/**
 * Centralized DOM contract for the kiosk-keyboard-webc package.
 *
 * This module has ZERO dependencies so it can be imported from any tsconfig
 * context (source, component tests, e2e tests) without pulling in JSX or
 * UI5 Web Components types.
 *
 * All CSS class names, data attributes, selector helpers, and part names
 * live here. The template, source code, and tests all import from this
 * single source of truth.
 */

const _parts = Object.freeze(["keyboard", "row", "key", "modifier", "action", "key-label", "key-icon"]);

export const KIOSK_KEYBOARD_DOM = Object.freeze({
  classes: Object.freeze({
    root: "kiosk-keyboard",
    rootDocked: "kiosk-keyboard--docked",
    rootDisabled: "kiosk-keyboard--disabled",
    rootHidden: "kiosk-keyboard--hidden",
    rootNumpad: "kiosk-keyboard--numpad",
    rootNumeric: "kiosk-keyboard--numeric",
    /** Height-responsive classes live on the host element (not the inner root)
     *  so that consumer overrides of public CSS custom properties on the host
     *  always win via the CSS cascade (outer context beats shadow at same specificity). */
    hostCqShort: "cq-short",
    hostCqTiny: "cq-tiny",
    row: "kiosk-row",
    key: "kiosk-key",
    keyModifier: "kiosk-key--modifier",
    keyAction: "kiosk-key--action",
    keyShiftActive: "kiosk-key--shift-active",
    keyCapsLock: "kiosk-key--caps-lock",
    keyHighlight: "kiosk-key--highlight",
    keyLabel: "kiosk-key__label",
    keyLabelGlyph: "kiosk-key__label--glyph",
    keyLabelGlyphCjk: "kiosk-key__label--glyph-cjk",
    keyLabelGlyphHangul: "kiosk-key__label--glyph-hangul",
    keyLabelGlyphIndic: "kiosk-key__label--glyph-indic",
    keyLabelGlyphArabic: "kiosk-key__label--glyph-arabic",
    keyLabelMulti: "kiosk-key__label--multi",
    keyIcon: "kiosk-key__icon",
    keyDual: "kiosk-key--dual",
    liveRegion: "kiosk-keyboard__live-region",
  }),
  attributes: Object.freeze({
    key: "data-key",
    shiftValue: "data-shift-value",
    rowKind: "data-row-kind",
  }),
  selectors: Object.freeze({
    root: ".kiosk-keyboard",
    row: ".kiosk-row",
    key: ".kiosk-key",
    keyHook: "[data-key]",
    focusableKey: '.kiosk-key[tabindex="0"]',
    keyByValue: (value: string) => `[data-key="${CSS.escape(value)}"]`,
    keyByShiftValue: (value: string) => `[data-shift-value="${CSS.escape(value)}"]`,
    liveRegion: ".kiosk-keyboard__live-region",
  }),
  /** All CSS part names exposed by the component. */
  parts: _parts,

  /**
   * Ready-to-use `exportparts` attribute value for wrapper components.
   *
   * When `<kiosk-keyboard>` is placed inside another shadow DOM host,
   * CSS `::part()` selectors cannot cross multiple shadow boundaries.
   * Set `exportparts` on the inner `<kiosk-keyboard>` to forward all
   * parts to the outer host:
   *
   * ```html
   * <!-- Inside my-wrapper's shadow DOM template -->
   * <kiosk-keyboard exportparts="keyboard, row, key, modifier, action, key-label, key-icon">
   * </kiosk-keyboard>
   * ```
   *
   * Or programmatically:
   * ```js
   * import KioskKeyboard from "kiosk-keyboard-webc/dist/KioskKeyboard.js";
   * this.shadowRoot.querySelector('kiosk-keyboard')
   *   .setAttribute('exportparts', KioskKeyboard.DOM.exportParts);
   * ```
   */
  exportParts: _parts.join(", "),

  keyWidthClass(width: string): string {
    return `kiosk-key--w${width.replace(".", "-")}`;
  },
});

export type KioskKeyboardDomContract = typeof KIOSK_KEYBOARD_DOM;
