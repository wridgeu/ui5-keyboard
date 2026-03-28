import type RenderManager from "sap/ui/core/RenderManager";
import IconPool from "sap/ui/core/IconPool";
import Log from "sap/base/Log";
import type KioskKeyboard from "./KioskKeyboard";
import type { KeyDefinition, LayoutDefinition } from "./types";
import { getText } from "./internal/i18n-registry";
import { KEY_ID_SUFFIX_RE, keyElementId } from "./internal/dom";
import { KeyboardType } from "./library";
import { hasOnlyEastAsianGlyphs, isSingleGlyph } from "./internal/grapheme";

import { KIOSK_KEYBOARD_DOM } from "./internal/dom-contract";

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
    // Resolve icon and label once per key, pass to all sub-hooks
    const { _getKeyLabel } = oControl._getRendererApi();
    const icon = this.resolveKeyIcon(oControl, key);
    const label = _getKeyLabel(key);

    rm.openStart("div", keyElementId(oControl.getId(), ri, ci));
    this.addKeyClasses(rm, oControl, key, icon, label);
    this.writeKeyAttributes(rm, oControl, key, ri, ci, focusTarget, label);
    rm.openEnd();

    this.renderKeyContent(rm, oControl, key, icon, label);

    rm.close("div");
  },

  /** CSS classes on a key `<div>`. */
  addKeyClasses(rm: RenderManager, oControl: KioskKeyboard, key: KeyDefinition, icon: string, label: string): void {
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

    // Dual icon + label class
    if (icon && label) {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keyDual);
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
    label: string,
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

    if (!bEnabled) {
      rm.attr("aria-disabled", "true");
    }

    rm.attr(KIOSK_KEYBOARD_DOM.attributes.key, key.value);

    // Store shift value for efficient lookup in tap handler
    if (key.shiftValue) {
      rm.attr(KIOSK_KEYBOARD_DOM.attributes.shiftValue, key.shiftValue);
    }

    // Only set aria-label when there is no visible text label (WCAG 2.5.3).
    // When capsLockLabel provides visible text, that text IS the accessible
    // name -- adding aria-label would mismatch it.
    if (!label) {
      if (bIsShiftKey && _isCapsLock()) {
        rm.attr("aria-label", getText("ARIA_CAPS_LOCK", "Caps Lock"));
      } else {
        rm.attr("aria-label", _getKeyAriaLabel(key));
      }
    }
  },

  /** Resolve the effective icon for a key. Returns the icon string or empty string if none. */
  resolveKeyIcon(oControl: KioskKeyboard, key: KeyDefinition): string {
    const { _isCapsLock } = oControl._getRendererApi();

    // CapsLock state is evaluated first -- capsLockIcon is independent of icon: ""
    if (key.value === "{shift}" && _isCapsLock()) {
      const Ctor = oControl.constructor as typeof KioskKeyboard;
      const clIcon = key.capsLockIcon;
      if (clIcon !== undefined) {
        if (!clIcon) return ""; // capsLockIcon: "" suppresses icon
        // Validate SAP icon URIs
        if (IconPool.isIconURI(clIcon) && !IconPool.getIconInfo(clIcon)) {
          Log.warning(`KioskKeyboard: capsLockIcon "${clIcon}" not found, skipping`, undefined, "KioskKeyboard");
          return "";
        }
        return clIcon;
      }
      return Ctor.SPECIAL_KEY_ICONS["{shift:capsLock}"] ?? "";
    }

    if (key.icon === "") return ""; // suppress default-state icon

    const Ctor = oControl.constructor as typeof KioskKeyboard;
    const icon = key.icon || Ctor.getKeyIcon(key.value) || "";
    // Validate SAP icon URIs exist in the registry; skip invalid ones
    if (icon && IconPool.isIconURI(icon) && !IconPool.getIconInfo(icon)) {
      Log.warning(`KioskKeyboard: icon "${icon}" not found, skipping`, undefined, "KioskKeyboard");
      return "";
    }
    return icon;
  },

  /** Render the icon element inside a key. Overridable by subclasses. */
  renderKeyIcon(rm: RenderManager, _oControl: KioskKeyboard, icon: string): void {
    if (IconPool.isIconURI(icon)) {
      rm.icon(icon, ["sapUiIcon", KIOSK_KEYBOARD_DOM.classes.keyIcon], { "aria-hidden": "true" });
    } else {
      // Unicode / emoji - render as text span with icon class
      rm.openStart("span").class(KIOSK_KEYBOARD_DOM.classes.keyIcon).attr("aria-hidden", "true").openEnd();
      rm.text(icon);
      rm.close("span");
    }
  },

  /** Render the label element inside a key. Overridable by subclasses. */
  renderKeyLabel(rm: RenderManager, _oControl: KioskKeyboard, key: KeyDefinition, label: string): void {
    const isSingleGlyphLabel = isSingleGlyph(label);
    rm.openStart("span").class(KIOSK_KEYBOARD_DOM.classes.keyLabel);
    if (isSingleGlyphLabel) {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keyLabelGlyph);
      if (hasOnlyEastAsianGlyphs(label)) {
        rm.class(KIOSK_KEYBOARD_DOM.classes.keyLabelEastAsian);
      }
    } else if (key.type !== "modifier" && key.type !== "action") {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keyLabelMulti);
    }
    rm.openEnd();
    rm.text(label);
    rm.close("span");
  },

  /** Icon and/or text inside the key. Overridable by subclasses. */
  renderKeyContent(rm: RenderManager, oControl: KioskKeyboard, key: KeyDefinition, icon: string, label: string): void {
    if (icon) {
      this.renderKeyIcon(rm, oControl, icon);
    }

    if (label) {
      this.renderKeyLabel(rm, oControl, key, label);
    }
  },
};

export default KioskKeyboardRenderer;
