import type RenderManager from "sap/ui/core/RenderManager";
import IconPool from "sap/ui/core/IconPool";
import type KioskKeyboard from "./KioskKeyboard";
import type { KeyDefinition, LayoutDefinition } from "./types";
import { getText } from "./internal/i18n-registry";
import { classifyRow, keyElementId, type KeyPosition } from "./internal/dom";
import { parseKeyAction } from "./internal/key-token";
import { SPECIAL_KEY_ICONS, getKeyIcon, validateKeyIcon } from "./internal/key-icons";
import { KeyboardType } from "./library";
import { glyphScriptOf, isSingleGlyph } from "./internal/grapheme";

import { KIOSK_KEYBOARD_DOM } from "./internal/dom-contract";

/** The accessibility state written on the root `<div>`: a labelled keyboard group. */
interface RootAccessibilityState {
  role: string;
  roledescription: string;
  label?: string;
}

/**
 * Renderer for the KioskKeyboard control.
 *
 * Uses apiVersion 4 (semantic rendering) - the control's output depends only on
 * its own properties and state, so the framework can skip re-rendering when only
 * the parent changes. Renders a flat DOM structure: rows of key divs with
 * role="button". No child UI5 controls - all keys are plain DOM via event delegation.
 *
 * Split into small per-concern methods (following the InputBaseRenderer style)
 * so each aspect - root classes and attributes, row markup, key markup, key
 * content - reads as a named unit instead of one long render().
 */
const KioskKeyboardRenderer = {
  apiVersion: 4,

  render(rm: RenderManager, oControl: KioskKeyboard): void {
    rm.openStart("div", oControl);
    this.addRootClasses(rm, oControl);
    this.writeRootAttributes(rm, oControl);
    rm.openEnd();

    this.renderContent(rm, oControl);

    rm.close("div");
  },

  // ── Root-level hooks ──

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
    // aria-labelledby (auto-emitted from the association) wins over aria-label per
    // WAI-ARIA: keep an explicit ariaLabel, but drop the default when labelledBy names the group.
    const mAccessibility: RootAccessibilityState = {
      role: "group",
      roledescription: getText("KIOSK_KEYBOARD_ROLEDESCRIPTION", "keyboard"),
    };
    const sExplicitLabel = oControl.getAriaLabel();
    if (sExplicitLabel) {
      mAccessibility.label = sExplicitLabel;
    } else if (oControl.getAriaLabelledBy().length === 0) {
      mAccessibility.label = getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard");
    }
    rm.accessibilityState(oControl, mAccessibility);
    // Single source of truth with the imperative path in `_setActiveTarget`,
    // which also writes `aria-controls` from `_getActiveTargetId()`. Using the
    // raw association id keeps the rendered and post-render values in sync even
    // when the target is a plain DOM element rather than a resolvable Control.
    const targetId = oControl._getActiveTargetId();
    if (targetId) {
      rm.attr("aria-controls", targetId);
    }
    rm.attr("data-sap-ui-fastnavgroup", "true");
  },

  /** The row loop: renders each layout row in order. */
  renderContent(rm: RenderManager, oControl: KioskKeyboard): void {
    const { _getResolvedLayout } = oControl._getRendererApi();
    const layout = _getResolvedLayout();
    const focusTarget = this.resolveFocusTarget(oControl, layout);
    layout.forEach((row, ri) => {
      this.renderRow(rm, oControl, row, ri, focusTarget);
    });
  },

  resolveFocusTarget(oControl: KioskKeyboard, layout: LayoutDefinition): KeyPosition | null {
    // No keys to render -> no roving tabindex target.
    if (!layout[0]?.[0]) return null;

    const last = oControl.getFocusInfo().lastFocusedKey;
    if (last && layout[last.row]?.[last.col]) return last;

    return { row: 0, col: 0 };
  },

  // ── Row-level hooks ──

  /** Single row wrapper + key iteration. */
  renderRow(
    rm: RenderManager,
    oControl: KioskKeyboard,
    row: LayoutDefinition[number],
    ri: number,
    focusTarget: KeyPosition | null,
  ): void {
    rm.openStart("div", `${oControl.getId()}-row-${ri}`);
    rm.class(KIOSK_KEYBOARD_DOM.classes.row);
    const rowKind = classifyRow(row);
    if (rowKind) {
      rm.attr(KIOSK_KEYBOARD_DOM.attributes.rowKind, rowKind);
    }
    rm.openEnd();

    row.forEach((key, ci) => {
      this.renderKey(rm, oControl, key, ri, ci, focusTarget);
    });

    rm.close("div");
  },

  // ── Key-level hooks ──

  /** Renders a single key `<div>` with classes, attributes, and content. */
  renderKey(
    rm: RenderManager,
    oControl: KioskKeyboard,
    key: KeyDefinition,
    ri: number,
    ci: number,
    focusTarget: KeyPosition | null,
  ): void {
    // Resolve icon and label once per key, pass to all sub-hooks
    const { _getKeyLabel, _getPressedKey, _getHighlightedKey } = oControl._getRendererApi();
    const icon = this.resolveKeyIcon(oControl, key);
    const label = _getKeyLabel(key);

    rm.openStart("div", keyElementId(oControl.getId(), ri, ci));
    this.addKeyClasses(rm, oControl, key, icon, label);
    // Re-emit the pressed class for the keycap currently held down, by pointer or
    // by keyboard activation: a press whose own key invalidates the control keeps
    // its feedback across the patch that repaints the keycap.
    const pressed = _getPressedKey();
    if (pressed?.row === ri && pressed.col === ci) {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keyPressed);
    }
    // Re-emit the physical-keyboard mirror for the keycap whose hardware key is
    // down: holding a modifier invalidates the control, and the mirror has to
    // outlive the patch that invalidation triggers.
    const highlighted = _getHighlightedKey();
    if (highlighted?.row === ri && highlighted.col === ci) {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keyHighlight);
    }
    this.writeKeyAttributes(rm, oControl, key, ri, ci, focusTarget, label);
    rm.openEnd();

    this.renderKeyContent(rm, oControl, key, icon, label);

    rm.close("div");
  },

  /** CSS classes on a key `<div>`. */
  addKeyClasses(rm: RenderManager, oControl: KioskKeyboard, key: KeyDefinition, icon: string, label: string): void {
    const { _isShiftActive, _isCapsLock } = oControl._getRendererApi();
    rm.class(KIOSK_KEYBOARD_DOM.classes.key);

    // Key category (modifier subdued, action prominent). A namespaced class, not
    // a data attribute, so interactive-state rules layered on top keep their
    // cascade weight in the light DOM; see internal/dom-contract.ts.
    if (key.type === "modifier") {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keyModifier);
    } else if (key.type === "action") {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keyAction);
    }

    if (key.value === "{shift}" && _isShiftActive()) {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keyShiftActive);
      if (_isCapsLock()) {
        rm.class(KIOSK_KEYBOARD_DOM.classes.keyCapsLock);
      }
    }

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
    focusTarget: KeyPosition | null,
    label: string,
  ): void {
    const { _isShiftActive, _isCapsLock, _getKeyAriaLabel } = oControl._getRendererApi();
    const bIsShiftKey = key.value === "{shift}";

    rm.attr("role", "button");

    if (bIsShiftKey) {
      rm.attr("aria-pressed", _isShiftActive() ? "true" : "false");
    }

    // Roving tabindex: exactly one key gets tabindex="0".
    // Prefer the last focused key (survives re-render); fall back to (0,0).
    // `focusTarget` is null only when the layout has no keys.
    const bIsFocusTarget = !!focusTarget && ri === focusTarget.row && ci === focusTarget.col;
    const bEnabled = oControl.getEnabled();
    rm.attr("tabindex", bEnabled && bIsFocusTarget ? "0" : "-1");

    if (!bEnabled) {
      rm.attr("aria-disabled", "true");
    }

    rm.attr(KIOSK_KEYBOARD_DOM.attributes.key, key.value);

    // Logical grid coordinate, the same one arrow-key navigation moves on.
    rm.attr(KIOSK_KEYBOARD_DOM.attributes.rowIndex, String(ri));
    rm.attr(KIOSK_KEYBOARD_DOM.attributes.keyIndex, String(ci));

    // Function-key flag (`{fkey:*}`), orthogonal to the key category.
    if (parseKeyAction(key.value).kind === "fkey") {
      rm.attr(KIOSK_KEYBOARD_DOM.attributes.fkey, "");
    }

    // Proportional width token, carried verbatim (styled by [data-key-span]).
    if (key.width) {
      rm.attr(KIOSK_KEYBOARD_DOM.attributes.keySpan, key.width);
    }

    // Store shift value for efficient lookup in tap handler
    if (key.shiftValue) {
      rm.attr(KIOSK_KEYBOARD_DOM.attributes.shiftValue, key.shiftValue);
    }

    // Marker for the long-press / right-click accent-variant gate: a cheap
    // hasAttribute() presence check lets the pointer handlers skip keys with no
    // variants. The same keys advertise the dialog popup to assistive tech through
    // aria-haspopup. No aria-expanded: the key's own activation types the glyph
    // rather than toggling the popup, and a dialog trigger is not an
    // expand/collapse control (WAI-ARIA APG dialog pattern; MDN cautions against
    // aria-expanded on elements that do not control the expanded state).
    if (key.variants && key.variants.length > 0) {
      rm.attr(KIOSK_KEYBOARD_DOM.attributes.hasVariants, "");
      rm.attr("aria-haspopup", "dialog");
    }

    // Native tooltip for labels that may be truncated by text-overflow: ellipsis.
    // Single-glyph labels use text-overflow: clip and cannot truncate.
    if (label && !isSingleGlyph(label)) {
      rm.attr("title", label);
    }

    // Only set aria-label when there is no visible text label (WCAG 2.5.3).
    // When capsLockLabel provides visible text, that text IS the accessible
    // name, so adding aria-label would mismatch it.
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

    // CapsLock state is evaluated first; capsLockIcon is independent of icon: ""
    if (key.value === "{shift}" && _isCapsLock()) {
      const clIcon = key.capsLockIcon;
      if (clIcon !== undefined) {
        if (!clIcon) return ""; // capsLockIcon: "" suppresses icon
        // Validate SAP icon URIs; skip invalid ones (warns once)
        return validateKeyIcon(clIcon, "capsLockIcon");
      }
      return SPECIAL_KEY_ICONS["{shift:capsLock}"] ?? "";
    }

    if (key.icon === "") return ""; // suppress default-state icon

    const icon = key.icon || getKeyIcon(key.value) || "";
    // Validate SAP icon URIs exist in the registry; skip invalid ones (warns once)
    return validateKeyIcon(icon, "icon");
  },

  /** Render the icon element inside a key. */
  renderKeyIcon(rm: RenderManager, _oControl: KioskKeyboard, icon: string): void {
    if (IconPool.isIconURI(icon)) {
      // rm.icon already adds the `sapUiIcon` class for icon URIs.
      rm.icon(icon, [KIOSK_KEYBOARD_DOM.classes.keyIcon], { "aria-hidden": "true" });
    } else {
      // Unicode / emoji - render as text span with icon class
      rm.openStart("span").class(KIOSK_KEYBOARD_DOM.classes.keyIcon).attr("aria-hidden", "true").openEnd();
      rm.text(icon);
      rm.close("span");
    }
  },

  /** Render the label element inside a key. */
  renderKeyLabel(rm: RenderManager, oControl: KioskKeyboard, key: KeyDefinition, label: string): void {
    const { _getLayoutLang } = oControl._getRendererApi();
    rm.openStart("span").class(KIOSK_KEYBOARD_DOM.classes.keyLabel);

    // Language of the keycap, when the layout writes its keys in a script other
    // than the UI language (WCAG 2.2 SC 3.1.2 Language of Parts). Only a key that
    // types a character carries it: space and the action tokens take their label
    // from i18n, and a layout-switch key is a control affordance rather than keycap
    // content. Scoped to the label span, since the keyboard's own label and its
    // live region are UI-language text.
    const lang = _getLayoutLang();
    if (lang && parseKeyAction(key.value).kind === "char" && key.value !== " ") {
      rm.attr("lang", lang);
    }

    if (isSingleGlyph(label)) {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keyLabelGlyph);
      const glyphScript = glyphScriptOf(label);
      if (glyphScript) {
        rm.attr(KIOSK_KEYBOARD_DOM.attributes.glyphScript, glyphScript);
      }
    } else {
      rm.class(KIOSK_KEYBOARD_DOM.classes.keyLabelMulti);
    }
    rm.openEnd();
    rm.text(label);
    rm.close("span");
  },

  /** Icon and/or text inside the key. */
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
