// Canonical metadata for the built-in special keys, single-sourced across both
// twins. Each twin adapts these to its own render path: the kiosk control builds
// full `sap-icon://` URIs and resolves them through IconPool, while the web
// component uses the bare icon names with its `@ui5/webcomponents-icons` imports.
//
// The caps-lock *label* i18n key is deliberately NOT here: it still diverges
// between the twins (kiosk `ARIA_CAPS_LOCK`, webc `KEY_CAPS_LOCK`) and unifying
// it is a semi-public change deferred to a follow-up. Only the caps-lock *icon*
// name is shared.

/** Bare SAP icon names for the built-in special keys (no `sap-icon://` prefix). */
export const SPECIAL_KEY_ICON_NAMES = {
  backspace: "arrow-left",
  shift: "arrow-top",
  enter: "accept",
  capsLock: "locked",
  layoutReturn: "nav-back",
} as const;

/** i18n message keys for the built-in special-key labels. */
export const SPECIAL_KEY_I18N_KEYS = {
  backspace: "KEY_BACKSPACE",
  enter: "KEY_ENTER",
  shift: "KEY_SHIFT",
  space: "KEY_SPACE",
} as const;
