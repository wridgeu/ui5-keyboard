import type { LayoutDefinition } from "../types";
import qwerty from "./qwerty";
import qwertzDe from "./qwertz-de";
import numeric from "./numeric";
import special from "./special";
import numpad from "./numpad";
import fkeys from "./fkeys";
import nav from "./nav";
import qwertyFk from "./qwerty-fk";
import qwertzDeFk from "./qwertz-de-fk";
import qwertyNav from "./qwerty-nav";
import qwertzDeNav from "./qwertz-de-nav";

/** Default base layout name used when no explicit layout is configured. */
export const DEFAULT_LAYOUT = "qwerty" as const;

const layouts: Record<string, LayoutDefinition> = Object.assign(Object.create(null), {
  qwerty,
  "qwertz-de": qwertzDe,
  numeric,
  special,
  numpad,
  fkeys,
  nav,
  "qwerty-fk": qwertyFk,
  "qwertz-de-fk": qwertzDeFk,
  "qwerty-nav": qwertyNav,
  "qwertz-de-nav": qwertzDeNav,
});

export default layouts;
