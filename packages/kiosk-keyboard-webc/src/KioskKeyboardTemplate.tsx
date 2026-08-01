import type KioskKeyboard from "./KioskKeyboard.js";
import { classifyRow, keyElementId } from "./core/dom-utils.js";
import { parseKeyAction } from "./core/key-token.js";
import { isArabicGlyph, isCJKGlyph, isHangulGlyph, isIndicGlyph, isSingleGlyph } from "./core/grapheme.js";

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
  const variantPopup = this._variantPopup;
  // Language of the keycaps, when the layout writes its keys in a script other
  // than the UI language (WCAG 2.2 SC 3.1.2 Language of Parts). Resolved once per
  // render and applied per label span below, never to the root or the live region.
  const layoutLang = this._getLayoutLang();

  return (
    <>
      {/* Live region sits outside the aria-hidden root so docked-but-hidden
          announcements (e.g. caps-lock on while closing) are not dropped by
          assistive tech. CSS visually hides it via the sr-only pattern. */}
      <span class={KIOSK_KEYBOARD_DOM.classes.liveRegion} role="status" aria-live="polite" aria-atomic="true">
        {this._liveRegionText}
      </span>
      <div
        class={{
          [KIOSK_KEYBOARD_DOM.classes.root]: true,
          [KIOSK_KEYBOARD_DOM.classes.rootDocked]: this.docked,
          [KIOSK_KEYBOARD_DOM.classes.rootDisabled]: this.disabled,
          [KIOSK_KEYBOARD_DOM.classes.rootHidden]: isDockedHidden,
          [KIOSK_KEYBOARD_DOM.classes.rootNumpad]: kbType === "Numpad",
          [KIOSK_KEYBOARD_DOM.classes.rootNumeric]: kbType === "Numeric",
        }}
        part="keyboard"
        role="group"
        aria-label={this._ariaLabel}
        aria-roledescription={this._roleDescription}
        aria-hidden={isDockedHidden ? "true" : undefined}
        inert={isDockedHidden}
        aria-disabled={this.disabled ? "true" : undefined}
        onClick={this._boundOnKeyClick}
        onMouseDown={this._boundOnKeyMouseDown}
        onKeyDown={this._boundOnKeyDown}
        onKeyUp={this._boundOnKeyUp}
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
              const keyKind = parseKeyAction(key.value).kind;
              const isFkey = keyKind === "fkey";
              // Only a key that types a character carries the layout's script:
              // space and the action tokens take their label from i18n, and a
              // layout-switch key is a control affordance rather than keycap content.
              const isKeycapContent = keyKind === "char" && key.value !== " ";
              const labelLang = isKeycapContent ? layoutLang : undefined;
              const resolved = this._resolveKeyIcon(key);
              const label = this._getKeyLabel(key);
              const hasIcon = resolved !== null;
              const hasLabel = label !== "";
              const isDual = hasIcon && hasLabel;
              const isSingleGlyphLabel = isSingleGlyph(label);
              // The Hangul regex uses strict \p{Script=Hangul} (not Script_Extensions)
              // so shared CJK punctuation (、。・) falls through to isCJKGlyph().
              // The !isHangul guard on isCJK prevents double-classification of
              // actual Hangul characters. Indic and Arabic are disjoint from all
              // other script families by Unicode definition, so no guards are needed.
              const isHangul = isSingleGlyphLabel && isHangulGlyph(label);
              const isCJK = isSingleGlyphLabel && !isHangul && isCJKGlyph(label);
              const isIndic = isSingleGlyphLabel && isIndicGlyph(label);
              const isArabic = isSingleGlyphLabel && isArabicGlyph(label);
              const glyphScript = isHangul
                ? "hangul"
                : isCJK
                  ? "cjk"
                  : isIndic
                    ? "indic"
                    : isArabic
                      ? "arabic"
                      : undefined;

              const hasVariants = !!(key.variants && key.variants.length > 0);

              return (
                <div
                  key={id}
                  id={id}
                  class={{
                    [KIOSK_KEYBOARD_DOM.classes.key]: true,
                    [KIOSK_KEYBOARD_DOM.classes.keyModifier]: key.type === "modifier",
                    [KIOSK_KEYBOARD_DOM.classes.keyAction]: key.type === "action",
                    [KIOSK_KEYBOARD_DOM.classes.keyShiftActive]: isShift && this._shifted,
                    [KIOSK_KEYBOARD_DOM.classes.keyCapsLock]: isShift && this._capsLock,
                    [KIOSK_KEYBOARD_DOM.classes.keyHighlight]: this._highlightedKey === key.value.toLowerCase(),
                    [KIOSK_KEYBOARD_DOM.classes.keyDual]: isDual,
                  }}
                  part={`key${key.type === "modifier" ? " modifier" : key.type === "action" ? " action" : ""}${isFkey ? " fkey" : ""}`}
                  role="button"
                  tabindex={!this.disabled && isFocusTarget ? 0 : -1}
                  data-key={key.value}
                  data-fkey={isFkey ? "" : undefined}
                  data-key-span={key.width || undefined}
                  data-shift-value={key.shiftValue || undefined}
                  data-has-variants={hasVariants ? "" : undefined}
                  aria-haspopup={hasVariants ? "dialog" : undefined}
                  aria-pressed={isShift ? this._shifted : undefined}
                  aria-disabled={this.disabled ? "true" : undefined}
                  // Native tooltip for labels that text-overflow: ellipsis can
                  // truncate; single-glyph labels clip instead, and an empty title
                  // states that the key carries no advisory information. Written on
                  // every render rather than omitted: key ids are stable across
                  // layouts, so a key is patched rather than remounted, and the
                  // renderer assigns through the `title` IDL property, where a
                  // nullish value writes "" instead of removing the attribute. The
                  // kiosk twin omits the attribute entirely, which its patcher can
                  // express and this renderer cannot; both state the same thing.
                  title={hasLabel && !isSingleGlyphLabel ? label : ""}
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
                        [KIOSK_KEYBOARD_DOM.classes.keyLabelMulti]: !isSingleGlyphLabel,
                      }}
                      // Keyed on the language so a switch to a layout that declares
                      // none remounts the span. Key ids are stable across layouts,
                      // so the span is otherwise reused, and the renderer assigns
                      // through the `lang` IDL property: an undefined value writes
                      // `lang=""`, which means "unknown language" and stops
                      // inheritance rather than clearing the declaration.
                      key={`label-${labelLang ?? ""}`}
                      data-glyph-script={glyphScript}
                      lang={labelLang}
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
      </div>
      {/* Accent-variant popup. Hosted in a `ui5-popover` (top-layer, unclipped)
          for placement, collision handling, outside-click / Escape dismissal,
          and focus restore; onAfterRendering sets the opener and open state
          imperatively. The option toolbar below is our slotted content. */}
      {variantPopup ? (
        <ui5-popover
          class={KIOSK_KEYBOARD_DOM.classes.variantPopupHost}
          placement="Top"
          preventInitialFocus
          preventFocusRestore
          accessibleName={variantPopup.label}
        >
          <div
            class={KIOSK_KEYBOARD_DOM.classes.variantPopup}
            part="variant-popup"
            role="toolbar"
            // Keyed for the same reason as the key label: a re-anchor that keeps
            // the popup open across two differently-languaged keys would otherwise
            // reuse this node, and an undefined `lang` blanks rather than removes.
            key={`variant-popup-${variantPopup.lang ?? ""}`}
            lang={variantPopup.lang}
            style={`--kiosk-keyboard-variant-option-width: ${variantPopup.anchorKeyWidth}px`}
            onClick={this._boundOnVariantClick}
            onKeyDown={this._boundOnVariantKeyDown}
          >
            {variantPopup.glyphs.map((glyph, index) => (
              <ui5-button
                key={`variant-${index}`}
                part="variant-option"
                data-index={index}
                design={index === variantPopup.activeIndex ? "Emphasized" : "Default"}
                tabindex={index === variantPopup.activeIndex ? 0 : -1}
              >
                {glyph}
              </ui5-button>
            ))}
          </div>
        </ui5-popover>
      ) : null}
    </>
  );
}
