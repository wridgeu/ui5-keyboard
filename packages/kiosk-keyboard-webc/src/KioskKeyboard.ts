// Full entry point -- imports all built-in layouts (triggering self-registration)
// then re-exports the core component and its types.
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

export { default, default as KioskKeyboard } from "./KioskKeyboardCore.js";
export type { KioskKeyboardDomContract } from "./KioskKeyboardCore.js";
export type { CompositionMiddleware } from "./types.js";
