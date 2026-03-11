import type KioskKeyboard from "./KioskKeyboard.js";
import { keyElementId } from "./core/dom-utils.js";

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
        "kiosk-keyboard": true,
        "kiosk-keyboard--docked": this.docked,
        "kiosk-keyboard--disabled": this.disabled,
        "kiosk-keyboard--hidden": isDockedHidden,
        "kiosk-keyboard--numpad": kbType === "Numpad",
        "kiosk-keyboard--numeric": kbType === "Numeric",
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
        <div class="kiosk-row" key={`row-${rowIndex}`}>
          {row.map((key, colIndex) => {
            const id = keyElementId(this._componentId, rowIndex, colIndex);
            const isFocusTarget = rowIndex === focusPos.row && colIndex === focusPos.col;
            const iconName = this._getKeyIcon(key);
            const isBuiltInIcon = !key.icon && iconName !== null;
            const isShift = key.value === "{shift}";
            const label = iconName ?? this._getKeyLabel(key);
            const isSingleGlyphLabel = !isBuiltInIcon && this._isSingleGlyphLabel(label);

            return (
              <div
                key={id}
                id={id}
                class={{
                  "kiosk-key": true,
                  "kiosk-key--modifier": key.type === "modifier",
                  "kiosk-key--action": key.type === "action",
                  [`kiosk-key--w${(key.width ?? "").replace(".", "-")}`]: !!key.width,
                  "kiosk-key--shift-active": isShift && this._shifted,
                  "kiosk-key--caps-lock": isShift && this._capsLock,
                  "kiosk-key--highlight": this._highlightedKey === key.value.toLowerCase(),
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
                  <ui5-icon class="kiosk-key__icon" name={iconName!} mode="Decorative" />
                ) : (
                  <span
                    class={{
                      "kiosk-key__label": true,
                      "kiosk-key__label--glyph": isSingleGlyphLabel,
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
      <span class="kiosk-keyboard__live-region" role="status" aria-live="polite">
        {this._liveRegionText}
      </span>
    </div>
  );
}
