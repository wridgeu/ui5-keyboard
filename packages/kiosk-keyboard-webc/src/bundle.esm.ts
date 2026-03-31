// ESM bundle entry -- imports Assets, all built-in layouts, and the component.
// Re-exports the component class and public types for consumer convenience.
import "./Assets.js";
import "./layouts/qwerty.js";
import "./layouts/qwertz-de.js";
import "./layouts/numeric.js";
import "./layouts/special.js";
import "./layouts/numpad.js";
import "./layouts/fkeys.js";
import "./layouts/nav.js";
import "./layouts/qwerty-fk.js";
import "./layouts/qwertz-de-fk.js";
import "./layouts/qwerty-nav.js";
import "./layouts/qwertz-de-nav.js";
import "./layouts/ja-romaji.js";
import "./layouts/ja-kana.js";
import "./layouts/arabic.js";
import "./layouts/ko-hangul.js";
import "./layouts/qwerty-es.js";

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
