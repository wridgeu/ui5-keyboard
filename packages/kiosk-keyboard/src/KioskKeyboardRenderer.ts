import type RenderManager from "sap/ui/core/RenderManager";
import Lib from "sap/ui/core/Lib";
import type KioskKeyboard from "./KioskKeyboard";
import type { KeyDefinition } from "./types";

/** Default icons for special keys — used when the key has no explicit icon */
const SPECIAL_KEY_ICONS: Record<string, string> = {
  "{shift}": "sap-icon://arrow-top",
  "{enter}": "sap-icon://accept",
};

function getText(sKey: string, sDefault: string): string {
  const bundle = Lib.getResourceBundleFor("ui5.kiosk");
  if (!bundle) return sDefault;
  return bundle.getText(sKey, undefined, true) ?? sDefault;
}

/**
 * Renderer for the KioskKeyboard control.
 *
 * Uses apiVersion 4 (semantic rendering) — the control's output depends only on
 * its own properties and state, so the framework can skip re-rendering when only
 * the parent changes. Renders a flat DOM structure: rows of key divs with
 * role="button". No child UI5 controls — all keys are plain DOM via event delegation.
 */
const KioskKeyboardRenderer = {
  apiVersion: 4,

  render(rm: RenderManager, oControl: KioskKeyboard): void {
    const layout = oControl.getResolvedLayout();
    const sId = oControl.getId();
    const bShift = oControl.isShiftActive();
    const bCapsLock = oControl.isCapsLock();
    const bEnabled = oControl.getEnabled();
    const bDocked = oControl.getDocked();

    // Root
    rm.openStart("div", oControl);
    rm.class("ui5KioskKeyboard");
    // Keyboard type class for type-specific styling (numpad, numeric)
    const sType = oControl.getKeyboardType().toLowerCase();
    if (sType !== "full") {
      rm.class(`ui5KioskKeyboard--${sType}`);
    }
    if (bDocked) {
      rm.class("ui5KioskKeyboard--docked");
      // Start closed; onAfterRendering syncs with _open state
      rm.class("ui5KioskKeyboard--closed");
    }
    if (!bEnabled) {
      rm.class("ui5KioskKeyboard--disabled");
      rm.attr("aria-disabled", "true");
    }
    rm.attr("role", "group");
    rm.attr("aria-label", oControl.getAriaLabel() || getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"));
    rm.attr("data-sap-ui-fastnavgroup", "true");
    rm.openEnd();

    layout.forEach((row, ri) => {
      rm.openStart("div", `${sId}-row-${ri}`);
      rm.class("ui5KioskRow");
      rm.openEnd();

      row.forEach((key, ci) => {
        this.renderKey(rm, oControl, key, ri, ci, sId, bShift, bCapsLock);
      });

      rm.close("div");
    });

    // ARIA live region — announces shift/caps state changes to screen readers
    rm.openStart("span", `${sId}-liveState`);
    rm.class("sapUiInvisibleText");
    rm.attr("role", "status");
    rm.attr("aria-live", "polite");
    rm.openEnd();
    if (bCapsLock) {
      rm.text(getText("ARIA_CAPS_LOCK_ON", "Caps Lock on"));
    } else if (bShift) {
      rm.text(getText("ARIA_SHIFT_ON", "Shift on"));
    }
    rm.close("span");

    rm.close("div");
  },

  renderKey(
    rm: RenderManager,
    oControl: KioskKeyboard,
    key: KeyDefinition,
    ri: number,
    ci: number,
    sId: string,
    bShift: boolean,
    bCapsLock: boolean,
  ): void {
    const label = oControl.getKeyLabel(key);
    const ariaLabel = oControl.getKeyAriaLabel(key);
    const bIsShiftKey = key.value === "{shift}";

    rm.openStart("div", `${sId}-key-${ri}-${ci}`);
    rm.class("ui5KioskKey");

    // Width class
    if (key.width === "space") {
      rm.class("ui5KioskKey--space");
    } else if (key.width) {
      rm.class(`ui5KioskKey--w${key.width.replace(".", "-")}`);
    }

    // Key type styling — separate modifier (subdued) from action (prominent)
    if (key.type === "modifier") {
      rm.class("ui5KioskKey--modifier");
    } else if (key.type === "action") {
      rm.class("ui5KioskKey--action");
    }

    // Active shift / caps lock indicator
    if (bIsShiftKey && bShift) {
      rm.class("ui5KioskKey--active");
      if (bCapsLock) {
        rm.class("ui5KioskKey--capsLock");
      }
    }

    rm.attr("role", "button");

    // Toggle state for shift key (aria-pressed for screen readers)
    if (bIsShiftKey) {
      rm.attr("aria-pressed", bShift ? "true" : "false");
    }
    rm.attr("tabindex", ri === 0 && ci === 0 ? "0" : "-1");
    if (!oControl.getEnabled()) {
      rm.attr("aria-disabled", "true");
    }
    rm.attr("data-key", key.value);

    // Store shift value for efficient lookup in tap handler
    if (key.shiftValue) {
      rm.attr("data-shift-value", key.shiftValue);
    }

    rm.attr("aria-label", bIsShiftKey && bCapsLock ? getText("ARIA_CAPS_LOCK", "Caps Lock") : ariaLabel);
    rm.openEnd();

    // Key content: icon, caps lock icon, or text
    const icon = key.icon || SPECIAL_KEY_ICONS[key.value];

    if (bIsShiftKey && bCapsLock) {
      rm.icon("sap-icon://locked", ["sapUiIcon"], { "aria-hidden": "true" });
    } else if (icon) {
      rm.icon(icon, ["sapUiIcon"], { "aria-hidden": "true" });
    } else {
      rm.text(label);
    }

    rm.close("div");
  },
};

export default KioskKeyboardRenderer;
