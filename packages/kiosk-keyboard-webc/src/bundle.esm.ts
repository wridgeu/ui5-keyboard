// ESM bundle entry: imports Assets and the full entry (which includes all
// built-in layouts). Re-exports the component class and public types.
import "./Assets.js";

export { default as KioskKeyboard } from "./KioskKeyboard.js";
export { default as CustomLayout } from "./CustomLayout.js";
export { FKeyMode, KeyboardType, LayoutFacet, LayoutRole, MobileKeyboard } from "./types.js";
export type {
  KeyPressEventDetail,
  LayoutChangeEventDetail,
  KeyboardTypeChangeEventDetail,
  ActiveControlChangeEventDetail,
  OpenStateChangeEventDetail,
  KeyDefinition,
  KeyRow,
  LayoutDefinition,
  CustomLayoutSpec,
  KeyWidth,
  KeyType,
  SpecialKeyValue,
  CompositionMiddleware,
} from "./types.js";
export type { KioskKeyboardDomContract } from "./KioskKeyboard.js";
