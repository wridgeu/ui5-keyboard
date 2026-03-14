import type KioskKeyboard from "./KioskKeyboard.js";
import { keyElementId } from "./core/dom-utils.js";
import { isSingleGlyph } from "./core/grapheme.js";

export const KIOSK_KEYBOARD_DOM = {
  classes: {
    root: "kiosk-keyboard",
    rootDocked: "kiosk-keyboard--docked",
    rootDisabled: "kiosk-keyboard--disabled",
    rootHidden: "kiosk-keyboard--hidden",
    rootNumpad: "kiosk-keyboard--numpad",
    rootNumeric: "kiosk-keyboard--numeric",
    rootCqSm: "kiosk-keyboard--cq-sm",
    rootCqXs: "kiosk-keyboard--cq-xs",
    rootCqShort: "kiosk-keyboard--cq-short",
    rootCqTiny: "kiosk-keyboard--cq-tiny",
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
  },
  attributes: {
    key: "data-key",
    shiftValue: "data-shift-value",
  },
  selectors: {
    root: ".kiosk-keyboard",
    row: ".kiosk-row",
    key: ".kiosk-key",
    keyHook: "[data-key]",
    focusableKey: '.kiosk-key[tabindex="0"]',
    keyByValue: (value: string) => `[data-key="${CSS.escape(value)}"]`,
    keyByShiftValue: (value: string) => `[data-shift-value="${CSS.escape(value)}"]`,
    liveRegion: ".kiosk-keyboard__live-region",
  },
  keyWidthClass(width: string): string {
    return `kiosk-key--w${width.replace(".", "-")}`;
  },
} as const;

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
        [KIOSK_KEYBOARD_DOM.classes.rootNumpad]: kbType === "Numpad",
        [KIOSK_KEYBOARD_DOM.classes.rootNumeric]: kbType === "Numeric",
      }}
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
        <div class={KIOSK_KEYBOARD_DOM.classes.row} key={`row-${rowIndex}`}>
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
                role="button"
                tabindex={isFocusTarget ? 0 : -1}
                data-key={key.value}
                data-shift-value={key.shiftValue || undefined}
                aria-pressed={isShift ? this._shifted : undefined}
                aria-disabled={this.disabled ? "true" : undefined}
                aria-label={this._getKeyAriaLabel(key)}
              >
                {isBuiltInIcon ? (
                  <ui5-icon class={KIOSK_KEYBOARD_DOM.classes.keyIcon} name={iconName!} mode="Decorative" />
                ) : (
                  <span
                    class={{
                      [KIOSK_KEYBOARD_DOM.classes.keyLabel]: true,
                      [KIOSK_KEYBOARD_DOM.classes.keyLabelGlyph]: isSingleGlyphLabel,
                      [KIOSK_KEYBOARD_DOM.classes.keyLabelMulti]:
                        !isSingleGlyphLabel && key.type !== "modifier" && key.type !== "action",
                    }}
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
