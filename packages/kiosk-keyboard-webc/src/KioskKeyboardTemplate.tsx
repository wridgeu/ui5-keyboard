import type KioskKeyboard from "./KioskKeyboard.js";
import { keyElementId } from "./core/dom-utils.js";
import { isSingleGlyph } from "./core/grapheme.js";
import { KeyboardType } from "./types.js";

export const KIOSK_KEYBOARD_DOM = Object.freeze({
  classes: Object.freeze({
    root: "kiosk-keyboard",
    rootDocked: "kiosk-keyboard--docked",
    rootDisabled: "kiosk-keyboard--disabled",
    rootHidden: "kiosk-keyboard--hidden",
    rootNumpad: "kiosk-keyboard--numpad",
    rootNumeric: "kiosk-keyboard--numeric",
    rootCqWidthCustom: "kiosk-keyboard--cq-width-custom",
    rootCqSm: "kiosk-keyboard--cq-sm",
    rootCqXs: "kiosk-keyboard--cq-xs",
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
    keyLabelMulti: "kiosk-key__label--multi",
    keyIcon: "kiosk-key__icon",
    liveRegion: "kiosk-keyboard__live-region",
  }),
  attributes: Object.freeze({
    key: "data-key",
    shiftValue: "data-shift-value",
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
  parts: Object.freeze(["keyboard", "row", "key", "modifier", "action", "key-label", "key-icon"]),

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
  exportParts: "keyboard, row, key, modifier, action, key-label, key-icon",

  keyWidthClass(width: string): string {
    return `kiosk-key--w${width.replace(".", "-")}`;
  },
} as const);

export type KioskKeyboardDomContract = typeof KIOSK_KEYBOARD_DOM;

/**
 * JSX template for `<kiosk-keyboard>`.
 *
 * Bound to the component instance via `this` context (UI5 convention).
 */
export default function KioskKeyboardTemplate(this: KioskKeyboard) {
  const layout = this._getResolvedLayout();
  const isDockedHidden = this.docked && !this.open;
  const focusPos = this._getFocusPosition(layout);
  const kbType = this.keyboardType;

  return (
    <div
      class={{
        [KIOSK_KEYBOARD_DOM.classes.root]: true,
        [KIOSK_KEYBOARD_DOM.classes.rootDocked]: this.docked,
        [KIOSK_KEYBOARD_DOM.classes.rootDisabled]: this.disabled,
        [KIOSK_KEYBOARD_DOM.classes.rootHidden]: isDockedHidden,
        [KIOSK_KEYBOARD_DOM.classes.rootNumpad]: kbType === KeyboardType.Numpad,
        [KIOSK_KEYBOARD_DOM.classes.rootNumeric]: kbType === KeyboardType.Numeric,
      }}
      part="keyboard"
      role="group"
      aria-label={this._ariaLabel}
      aria-roledescription={this._roleDescription}
      aria-hidden={isDockedHidden ? "true" : undefined}
      aria-disabled={this.disabled ? "true" : undefined}
      onClick={this._boundOnKeyClick}
      onMouseDown={this._boundOnKeyMouseDown}
      onKeyDown={this._boundOnKeyDown}
    >
      {layout.map((row, rowIndex) => (
        <div class={KIOSK_KEYBOARD_DOM.classes.row} part="row" key={`row-${rowIndex}`}>
          {row.map((key, colIndex) => {
            const id = keyElementId(this._componentId, rowIndex, colIndex);
            const isFocusTarget = rowIndex === focusPos.row && colIndex === focusPos.col;
            const iconName = this._getKeyIcon(key);
            const isBuiltInIcon = !key.icon && iconName !== null;
            const isShift = key.value === "{shift}";
            const label = iconName ?? this._getKeyLabel(key);
            const isSingleGlyphLabel = !isBuiltInIcon && isSingleGlyph(label);

            return (
              <div
                key={id}
                id={id}
                class={{
                  [KIOSK_KEYBOARD_DOM.classes.key]: true,
                  [KIOSK_KEYBOARD_DOM.classes.keyModifier]: key.type === "modifier",
                  [KIOSK_KEYBOARD_DOM.classes.keyAction]: key.type === "action",
                  [KIOSK_KEYBOARD_DOM.keyWidthClass(key.width ?? "")]: !!key.width,
                  [KIOSK_KEYBOARD_DOM.classes.keyShiftActive]: isShift && this._shifted,
                  [KIOSK_KEYBOARD_DOM.classes.keyCapsLock]: isShift && this._capsLock,
                  [KIOSK_KEYBOARD_DOM.classes.keyHighlight]: this._highlightedKey === key.value.toLowerCase(),
                }}
                part={`key${key.type === "modifier" ? " modifier" : key.type === "action" ? " action" : ""}`}
                role="button"
                tabindex={isFocusTarget ? 0 : -1}
                data-key={key.value}
                data-shift-value={key.shiftValue || undefined}
                aria-pressed={isShift ? this._shifted : undefined}
                aria-disabled={this.disabled ? "true" : undefined}
                aria-label={this._getKeyAriaLabel(key)}
              >
                {isBuiltInIcon ? (
                  <ui5-icon
                    class={KIOSK_KEYBOARD_DOM.classes.keyIcon}
                    part="key-icon"
                    name={iconName!}
                    mode="Decorative"
                  />
                ) : (
                  <span
                    class={{
                      [KIOSK_KEYBOARD_DOM.classes.keyLabel]: true,
                      [KIOSK_KEYBOARD_DOM.classes.keyLabelGlyph]: isSingleGlyphLabel,
                      [KIOSK_KEYBOARD_DOM.classes.keyLabelMulti]:
                        !isSingleGlyphLabel && key.type !== "modifier" && key.type !== "action",
                    }}
                    part="key-label"
                  >
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <span class={KIOSK_KEYBOARD_DOM.classes.liveRegion} role="status" aria-live="polite">
        {this._liveRegionText}
      </span>
    </div>
  );
}
