// Canonical special-key metadata shared by both twins. The kiosk control builds
// `sap-icon://` URIs (IconPool) from these names; the web component uses the bare
// names. The caps-lock label i18n key is omitted: it still diverges (kiosk
// `ARIA_CAPS_LOCK`, webc `KEY_CAPS_LOCK`); only its icon name is shared.

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
