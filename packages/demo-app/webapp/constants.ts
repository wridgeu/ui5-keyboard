/**
 * Scope names used for hotkey registration.
 * Values match the route names in manifest.json (plus "dialog" for non-route scopes).
 */
export const Scope = {
  Main: "main",
  Integration: "integration",
  HotkeysHub: "hotkeysHub",
  HotkeysSequences: "hotkeysSequences",
  HotkeysTargetBubble: "hotkeysTargetBubble",
  HotkeysConflict: "hotkeysConflict",
  Detail: "detail",
  Dialog: "dialog",
  KioskHub: "kioskHub",
  KioskDocked: "kioskDocked",
  KioskPopover: "kioskPopover",
  KioskInputIds: "kioskInputIds",
  KioskProgrammatic: "kioskProgrammatic",
  KioskComponent: "kioskComponent",
  KioskFormWorkflow: "kioskFormWorkflow",
  KioskMultiKeyboard: "kioskMultiKeyboard",
  KioskDialog: "kioskDialog",
  KioskCustomLayouts: "kioskCustomLayouts",
  KioskFocusScenarios: "kioskFocusScenarios",
} as const;
