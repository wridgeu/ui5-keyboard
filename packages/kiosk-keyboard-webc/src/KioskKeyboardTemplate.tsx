import type KioskKeyboard from "./KioskKeyboardCore.js";
import { classifyRow, keyElementId } from "./core/dom-utils.js";
import { isArabicGlyph, isCJKGlyph, isHangulGlyph, isIndicGlyph, isSingleGlyph } from "./core/grapheme.js";
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
        <div
          class={KIOSK_KEYBOARD_DOM.classes.row}
          part="row"
          key={`row-${rowIndex}`}
          data-row-kind={classifyRow(row)}
        >
          {row.map((key, colIndex) => {
            const id = keyElementId(this._componentId, rowIndex, colIndex);
            const isFocusTarget = rowIndex === focusPos.row && colIndex === focusPos.col;
            const isShift = key.value === "{shift}";
            const resolved = this._resolveKeyIcon(key);
            const label = this._getKeyLabel(key);
            const hasIcon = resolved !== null;
            const hasLabel = label !== "";
            const isDual = hasIcon && hasLabel;
            const isSingleGlyphLabel = isSingleGlyph(label);
            // Hangul is a subset of the CJK regex, so it needs an explicit exclusion guard.
            // Indic and Arabic are disjoint from all other script families by Unicode
            // definition (no character belongs to multiple Script_Extensions groups below),
            // so no priority guards are needed for them.
            const isHangul = isSingleGlyphLabel && isHangulGlyph(label);
            const isCJK = isSingleGlyphLabel && !isHangul && isCJKGlyph(label);
            const isIndic = isSingleGlyphLabel && isIndicGlyph(label);
            const isArabic = isSingleGlyphLabel && isArabicGlyph(label);

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
                  [KIOSK_KEYBOARD_DOM.classes.keyDual]: isDual,
                }}
                part={`key${key.type === "modifier" ? " modifier" : key.type === "action" ? " action" : ""}${key.value.startsWith("{fkey:") ? " fkey" : ""}`}
                role="button"
                tabindex={isFocusTarget ? 0 : -1}
                data-key={key.value}
                data-shift-value={key.shiftValue || undefined}
                aria-pressed={isShift ? this._shifted : undefined}
                aria-disabled={this.disabled ? "true" : undefined}
                title={hasLabel && !isSingleGlyphLabel ? label : undefined}
                aria-label={hasLabel ? undefined : this._getKeyAriaLabel(key)}
              >
                {hasIcon && resolved.sap ? (
                  <ui5-icon
                    class={KIOSK_KEYBOARD_DOM.classes.keyIcon}
                    part="key-icon"
                    name={resolved.value}
                    mode="Decorative"
                  />
                ) : hasIcon ? (
                  <span class={KIOSK_KEYBOARD_DOM.classes.keyIcon} part="key-icon" aria-hidden="true">
                    {resolved.value}
                  </span>
                ) : null}
                {hasLabel ? (
                  <span
                    class={{
                      [KIOSK_KEYBOARD_DOM.classes.keyLabel]: true,
                      [KIOSK_KEYBOARD_DOM.classes.keyLabelGlyph]: isSingleGlyphLabel,
                      [KIOSK_KEYBOARD_DOM.classes.keyLabelGlyphCjk]: isCJK,
                      [KIOSK_KEYBOARD_DOM.classes.keyLabelGlyphHangul]: isHangul,
                      [KIOSK_KEYBOARD_DOM.classes.keyLabelGlyphIndic]: isIndic,
                      [KIOSK_KEYBOARD_DOM.classes.keyLabelGlyphArabic]: isArabic,
                      [KIOSK_KEYBOARD_DOM.classes.keyLabelMulti]:
                        !isSingleGlyphLabel && key.type !== "modifier" && key.type !== "action",
                    }}
                    part="key-label"
                  >
                    {label}
                  </span>
                ) : null}
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
