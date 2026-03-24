import type KioskKeyboard from "./KioskKeyboard.js";
import { keyElementId } from "./core/dom-utils.js";
import { isSingleGlyph } from "./core/grapheme.js";
import { KeyboardType } from "./types.js";

import { KIOSK_KEYBOARD_DOM } from "./core/dom-contract.js";

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
