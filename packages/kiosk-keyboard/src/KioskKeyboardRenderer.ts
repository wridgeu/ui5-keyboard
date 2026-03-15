import type RenderManager from "sap/ui/core/RenderManager";
import type KioskKeyboard from "./KioskKeyboard";
import type { KeyDefinition, LayoutDefinition } from "./types";
import { getText } from "./internal/i18n-registry";
import { KEY_ID_SUFFIX_RE, keyElementId } from "./internal/dom";
import { KeyboardType } from "./library";

const glyphSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export const KIOSK_KEYBOARD_DOM = Object.freeze({
  classes: Object.freeze({
    root: "ui5KioskKeyboard",
    rootDocked: "ui5KioskKeyboard--docked",
    rootClosed: "ui5KioskKeyboard--closed",
    rootDisabled: "ui5KioskKeyboard--disabled",
    rootCqSm: "ui5KioskKeyboard--cq-sm",
    rootCqXs: "ui5KioskKeyboard--cq-xs",
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
    keyLabelMulti: "ui5KioskKey__label--multi",
    keyIcon: "ui5KioskKey__icon",
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

/**
 * Renderer for the KioskKeyboard control.
 *
 * Uses apiVersion 4 (semantic rendering) - the control's output depends only on
 * its own properties and state, so the framework can skip re-rendering when only
 * the parent changes. Renders a flat DOM structure: rows of key divs with
 * role="button". No child UI5 controls - all keys are plain DOM via event delegation.
 *
 * Split into small hook methods following the InputBaseRenderer pattern so that
 * extending renderers can selectively override individual aspects (classes,
 * attributes, key content, etc.) without rewriting the entire renderer.
 */
const KioskKeyboardRenderer = {
  apiVersion: 4,

  // ──────────────────────────────────────────────
  // Main entry point
  // ──────────────────────────────────────────────

  render(rm: RenderManager, oControl: KioskKeyboard): void {
    rm.openStart("div", oControl);
    this.addRootClasses(rm, oControl);
    this.writeRootAttributes(rm, oControl);
    rm.openEnd();

    this.renderContent(rm, oControl);
    this.renderLiveRegion(rm, oControl);

    rm.close("div");
  },

  // ──────────────────────────────────────────────
  // Root-level hooks
  // ──────────────────────────────────────────────

  /** CSS classes on the root `<div>`. */
  addRootClasses(rm: RenderManager, oControl: KioskKeyboard): void {
    rm.class(KIOSK_KEYBOARD_DOM.classes.root);

    const sType = oControl.getKeyboardType();
    if (sType !== KeyboardType.Full) {
      rm.class(KIOSK_KEYBOARD_DOM.keyboardTypeClass(sType));
    }

    if (oControl.getDocked()) {
      rm.class(KIOSK_KEYBOARD_DOM.classes.rootDocked);
      // Start closed; onAfterRendering syncs with _open state
      rm.class(KIOSK_KEYBOARD_DOM.classes.rootClosed);
    }

    if (!oControl.getEnabled()) {
      rm.class(KIOSK_KEYBOARD_DOM.classes.rootDisabled);
    }
  },

  /** ARIA/data attributes on the root `<div>`. */
  writeRootAttributes(rm: RenderManager, oControl: KioskKeyboard): void {
    rm.accessibilityState(oControl, {
      role: "group",
      label: oControl.getAriaLabel() || getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"),
      roledescription: getText("KIOSK_KEYBOARD_ROLEDESCRIPTION", "keyboard"),
    });
    const targetId = oControl.getTargetInput();
    if (targetId) {
      rm.attr("aria-controls", targetId);
    }
    rm.attr("data-sap-ui-fastnavgroup", "true");
  },

  /** The row loop - override to add toolbar, extra sections, etc. */
  renderContent(rm: RenderManager, oControl: KioskKeyboard): void {
    const { _getResolvedLayout } = oControl._getRendererApi();
    const layout = _getResolvedLayout();
    const focusTarget = this.resolveFocusTarget(oControl, layout);
    layout.forEach((row, ri) => {
      this.renderRow(rm, oControl, row, ri, focusTarget);
    });
  },

  resolveFocusTarget(oControl: KioskKeyboard, layout: LayoutDefinition): { row: number; col: number } {
    const sLastFocusedId = oControl.getFocusInfo().lastFocusedKeyId;
    if (!sLastFocusedId) {
      return { row: 0, col: 0 };
    }

    const match = sLastFocusedId.match(KEY_ID_SUFFIX_RE);
    if (!match) {
      return { row: 0, col: 0 };
    }

    const row = Number.parseInt(match[1], 10);
    const col = Number.parseInt(match[2], 10);

    if (layout[row]?.[col]) {
      return { row, col };
    }

    return { row: 0, col: 0 };
  },

  /** ARIA live region - announces shift/caps state changes to screen readers. */
  renderLiveRegion(rm: RenderManager, oControl: KioskKeyboard): void {
    const { _isCapsLock, _isShiftActive } = oControl._getRendererApi();
    rm.openStart("span", `${oControl.getId()}-liveState`);
    rm.class("sapUiInvisibleText");
    rm.attr("role", "status");
    rm.attr("aria-live", "polite");
    rm.openEnd();

    if (_isCapsLock()) {
      rm.text(getText("ARIA_CAPS_LOCK_ON", "Caps Lock on"));
    } else if (_isShiftActive()) {
      rm.text(getText("ARIA_SHIFT_ON", "Shift on"));
    }

    rm.close("span");
  },

  // ──────────────────────────────────────────────
  // Row-level hooks
  // ──────────────────────────────────────────────

  /** Single row wrapper + key iteration. */
  renderRow(
    rm: RenderManager,
    oControl: KioskKeyboard,
    row: LayoutDefinition[number],
    ri: number,
    focusTarget: { row: number; col: number },
  ): void {
    rm.openStart("div", `${oControl.getId()}-row-${ri}`);
    rm.class(KIOSK_KEYBOARD_DOM.classes.row);
    rm.openEnd();

    row.forEach((key, ci) => {
      this.renderKey(rm, oControl, key, ri, ci, focusTarget);
    });

    rm.close("div");
  },

  // ──────────────────────────────────────────────
  // Key-level hooks
  // ──────────────────────────────────────────────

  /** Renders a single key `<div>` with classes, attributes, and content. */
  renderKey(
    rm: RenderManager,
    oControl: KioskKeyboard,
    key: KeyDefinition,
    ri: number,
    ci: number,
    focusTarget: { row: number; col: number },
  ): void {
    rm.openStart("div", keyElementId(oControl.getId(), ri, ci));
    this.addKeyClasses(rm, oControl, key);
    this.writeKeyAttributes(rm, oControl, key, ri, ci, focusTarget);
    rm.openEnd();

    this.renderKeyContent(rm, oControl, key);

    rm.close("div");
  },

  /** CSS classes on a key `<div>`. */
  addKeyClasses(rm: RenderManager, oControl: KioskKeyboard, key: KeyDefinition): void {
    const { _isShiftActive, _isCapsLock } = oControl._getRendererApi();
    rm.class(KIOSK_KEYBOARD_DOM.classes.key);

    // Width class
    if (key.width === "space") {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keySpace);
    } else if (key.width) {
      rm.class(KIOSK_KEYBOARD_DOM.keyWidthClass(key.width));
    }

    // Key type styling - separate modifier (subdued) from action (prominent)
    if (key.type === "modifier") {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keyModifier);
    } else if (key.type === "action") {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keyAction);
    }

    // Active shift / caps lock indicator
    if (key.value === "{shift}" && _isShiftActive()) {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keyActive);
      if (_isCapsLock()) {
        rm.class(KIOSK_KEYBOARD_DOM.classes.keyCapsLock);
      }
    }
  },

  /** Attributes (`role`, `tabindex`, `data-key`, `aria-*`) on a key `<div>`. */
  writeKeyAttributes(
    rm: RenderManager,
    oControl: KioskKeyboard,
    key: KeyDefinition,
    ri: number,
    ci: number,
    focusTarget: { row: number; col: number },
  ): void {
    const { _isShiftActive, _isCapsLock, _getKeyAriaLabel } = oControl._getRendererApi();
    const bIsShiftKey = key.value === "{shift}";

    rm.attr("role", "button");

    // Toggle state for shift key (aria-pressed for screen readers)
    if (bIsShiftKey) {
      rm.attr("aria-pressed", _isShiftActive() ? "true" : "false");
    }

    // Roving tabindex: exactly one key gets tabindex="0".
    // Prefer the last focused key (survives re-render); fall back to (0,0).
    const bIsFocusTarget = ri === focusTarget.row && ci === focusTarget.col;
    const bEnabled = oControl.getEnabled();
    rm.attr("tabindex", bEnabled && bIsFocusTarget ? "0" : "-1");

    if (!oControl.getEnabled()) {
      rm.attr("aria-disabled", "true");
    }

    rm.attr(KIOSK_KEYBOARD_DOM.attributes.key, key.value);

    // Store shift value for efficient lookup in tap handler
    if (key.shiftValue) {
      rm.attr(KIOSK_KEYBOARD_DOM.attributes.shiftValue, key.shiftValue);
    }

    const ariaLabel = bIsShiftKey && _isCapsLock() ? getText("ARIA_CAPS_LOCK", "Caps Lock") : _getKeyAriaLabel(key);
    rm.attr("aria-label", ariaLabel);
  },

  /** Icon or text inside the key. */
  renderKeyContent(rm: RenderManager, oControl: KioskKeyboard, key: KeyDefinition): void {
    const { _isCapsLock, _getKeyLabel } = oControl._getRendererApi();
    const bIsShiftKey = key.value === "{shift}";

    if (bIsShiftKey && _isCapsLock()) {
      rm.icon("sap-icon://locked", ["sapUiIcon", KIOSK_KEYBOARD_DOM.classes.keyIcon], { "aria-hidden": "true" });
    } else {
      const Ctor = oControl.constructor as typeof KioskKeyboard;
      const icon = key.icon || Ctor.getKeyIcon(key.value);
      if (icon) {
        rm.icon(icon, ["sapUiIcon", KIOSK_KEYBOARD_DOM.classes.keyIcon], { "aria-hidden": "true" });
      } else {
        const label = _getKeyLabel(key);
        rm.openStart("span").class(KIOSK_KEYBOARD_DOM.classes.keyLabel);
        if (this.isSingleGlyphLabel(label)) {
          rm.class(KIOSK_KEYBOARD_DOM.classes.keyLabelGlyph);
        } else if (key.type !== "modifier" && key.type !== "action") {
          rm.class(KIOSK_KEYBOARD_DOM.classes.keyLabelMulti);
        }
        rm.openEnd();
        rm.text(label);
        rm.close("span");
      }
    }
  },

  isSingleGlyphLabel(label: string): boolean {
    let count = 0;
    for (const _segment of glyphSegmenter.segment(label)) {
      count += 1;
      if (count > 1) return false;
    }
    return count === 1;
  },
};

export default KioskKeyboardRenderer;
