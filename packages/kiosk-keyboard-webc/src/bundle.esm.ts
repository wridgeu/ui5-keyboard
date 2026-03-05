// ESM entry point — imports Assets + component to register everything.
// Re-exports the component class and public types for consumer convenience.
import "./Assets.js";

export { default as KioskKeyboard } from "./KioskKeyboard.js";
export type {
  FKeyMode,
  KeyPressEventDetail,
  LayoutChangeEventDetail,
  KeyboardTypeChangeEventDetail,
  KeyDefinition,
  KeyRow,
  LayoutDefinition,
  KeyWidth,
  KeyType,
  SpecialKeyValue,
} from "./types.js";
