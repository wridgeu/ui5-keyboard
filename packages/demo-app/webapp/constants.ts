/**
 * Scope names used for hotkey registration.
 * Values match the route names in manifest.json.
 */
export const Scope = {
  Main: "main",
  Integration: "integration",
  HotkeysHub: "hotkeysHub",
  HotkeysSequences: "hotkeysSequences",
  HotkeysTargetBubble: "hotkeysTargetBubble",
  HotkeysConflict: "hotkeysConflict",
  Detail: "detail",
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
  KioskI18nExtensibility: "kioskI18nExtensibility",
  KioskWebComponent: "kioskWebComponent",
} as const;
