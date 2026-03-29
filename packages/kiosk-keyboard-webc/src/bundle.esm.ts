// ESM entry point - imports Assets + component to register everything.
// Re-exports the component class and public types for consumer convenience.
import "./Assets.js";

export { default as KioskKeyboard } from "./KioskKeyboard.js";
export { FKeyMode, KeyboardType, MobileKeyboard } from "./types.js";
export type {
  KeyPressEventDetail,
  LayoutChangeEventDetail,
  KeyboardTypeChangeEventDetail,
  TargetInputChangeEventDetail,
  KeyDefinition,
  KeyRow,
  LayoutDefinition,
  KeyWidth,
  KeyType,
  SpecialKeyValue,
  CompositionMiddleware,
} from "./types.js";
export type { KioskKeyboardDomContract } from "./KioskKeyboard.js";
