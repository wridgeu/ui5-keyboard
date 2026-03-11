import type RenderManager from "sap/ui/core/RenderManager";
import type KioskKeyboard from "./KioskKeyboard";
import type { KeyDefinition, LayoutDefinition } from "./types";
import { getText } from "./internal/i18n-registry";
import { KEY_ID_SUFFIX_RE, keyElementId } from "./internal/dom";
import { KeyboardType } from "./library";

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
    rm.class("ui5KioskKeyboard");

    const sType = oControl.getKeyboardType();
    if (sType !== KeyboardType.Full) {
      rm.class(`ui5KioskKeyboard--${sType.toLowerCase()}`);
    }

    if (oControl.getDocked()) {
      rm.class("ui5KioskKeyboard--docked");
      // Start closed; onAfterRendering syncs with _open state
      rm.class("ui5KioskKeyboard--closed");
    }

    if (!oControl.getEnabled()) {
      rm.class("ui5KioskKeyboard--disabled");
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
    rm.class("ui5KioskRow");
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
    rm.class("ui5KioskKey");

    // Width class
    if (key.width === "space") {
      rm.class("ui5KioskKey--space");
    } else if (key.width) {
      rm.class(`ui5KioskKey--w${key.width.replace(".", "-")}`);
    }

    // Key type styling - separate modifier (subdued) from action (prominent)
    if (key.type === "modifier") {
      rm.class("ui5KioskKey--modifier");
    } else if (key.type === "action") {
      rm.class("ui5KioskKey--action");
    }

    // Active shift / caps lock indicator
    if (key.value === "{shift}" && _isShiftActive()) {
      rm.class("ui5KioskKey--active");
      if (_isCapsLock()) {
        rm.class("ui5KioskKey--capsLock");
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

    rm.attr("data-key", key.value);

    // Store shift value for efficient lookup in tap handler
    if (key.shiftValue) {
      rm.attr("data-shift-value", key.shiftValue);
    }

    const ariaLabel = bIsShiftKey && _isCapsLock() ? getText("ARIA_CAPS_LOCK", "Caps Lock") : _getKeyAriaLabel(key);
    rm.attr("aria-label", ariaLabel);
  },

  /** Icon or text inside the key. */
  renderKeyContent(rm: RenderManager, oControl: KioskKeyboard, key: KeyDefinition): void {
    const { _isCapsLock, _getKeyLabel } = oControl._getRendererApi();
    const bIsShiftKey = key.value === "{shift}";

    if (bIsShiftKey && _isCapsLock()) {
      rm.icon("sap-icon://locked", ["sapUiIcon"], { "aria-hidden": "true" });
    } else {
      const Ctor = oControl.constructor as typeof KioskKeyboard;
      const icon = key.icon || Ctor.getKeyIcon(key.value);
      if (icon) {
        rm.icon(icon, ["sapUiIcon"], { "aria-hidden": "true" });
      } else {
        const label = _getKeyLabel(key);
        rm.openStart("span").class("ui5KioskKey__label");
        if (this.isSingleGlyphLabel(label)) {
          rm.class("ui5KioskKey__label--glyph");
        } else if (key.type !== "modifier" && key.type !== "action") {
          rm.class("ui5KioskKey__label--multi");
        }
        rm.openEnd();
        rm.text(label);
        rm.close("span");
      }
    }
  },

  isSingleGlyphLabel(label: string): boolean {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let count = 0;
    for (const _segment of segmenter.segment(label)) {
      count += 1;
      if (count > 1) return false;
    }
    return count === 1;
  },
};

export default KioskKeyboardRenderer;
