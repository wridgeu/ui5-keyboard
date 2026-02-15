/**
 * Scope names used for hotkey registration.
 * Values match the route names in manifest.json (plus "dialog" for non-route scopes).
 */
export const Scope = {
  Main: "main",
  Detail: "detail",
  Dialog: "dialog",
  Kiosk: "kiosk",
} as const;
