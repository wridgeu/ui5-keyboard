import type { LayoutDefinition } from "../types.js";
import qwerty from "./qwerty.js";
import qwertzDe from "./qwertz-de.js";
import numeric from "./numeric.js";
import special from "./special.js";
import numpad from "./numpad.js";
import fkeys from "./fkeys.js";
import nav from "./nav.js";
import qwertyFk from "./qwerty-fk.js";
import qwertzDeFk from "./qwertz-de-fk.js";
import qwertyNav from "./qwerty-nav.js";
import qwertzDeNav from "./qwertz-de-nav.js";
import jaRomaji from "./ja-romaji.js";
import arabic from "./arabic.js";

/** All built-in layouts keyed by name. */
const builtInLayouts: ReadonlyMap<string, LayoutDefinition> = new Map([
  ["qwerty", qwerty],
  ["qwertz-de", qwertzDe],
  ["numeric", numeric],
  ["special", special],
  ["numpad", numpad],
  ["fkeys", fkeys],
  ["nav", nav],
  ["qwerty-fk", qwertyFk],
  ["qwertz-de-fk", qwertzDeFk],
  ["qwerty-nav", qwertyNav],
  ["qwertz-de-nav", qwertzDeNav],
  ["ja-romaji", jaRomaji],
  ["arabic", arabic],
]);

export default builtInLayouts;
