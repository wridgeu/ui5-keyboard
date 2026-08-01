// ESM bundle entry: imports Assets and the full entry (which includes all
// built-in layouts). Re-exports the component class and public types.
import "./Assets.js";

export { default as KioskKeyboard } from "./KioskKeyboard.js";
export { FKeyMode, KeyboardType, MobileKeyboard } from "./types.js";
export type {
  KeyPressEventDetail,
  LayoutChangeEventDetail,
  KeyboardTypeChangeEventDetail,
  ActiveControlChangeEventDetail,
  OpenStateChangeEventDetail,
  KeyDefinition,
  KeyRow,
  LayoutDefinition,
  LayoutSpec,
  LayoutInput,
  KeyWidth,
  KeyType,
  SpecialKeyValue,
  CompositionMiddleware,
} from "./types.js";
export type { KioskKeyboardDomContract } from "./KioskKeyboard.js";
