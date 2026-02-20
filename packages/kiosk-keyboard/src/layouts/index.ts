import type { LayoutDefinition } from "../types";
import qwerty from "./qwerty";
import qwertzDe from "./qwertz-de";
import numeric from "./numeric";
import special from "./special";
import numpad from "./numpad";
import fkeys from "./fkeys";
import qwertyFk from "./qwerty-fk";
import qwertzDeFk from "./qwertz-de-fk";

const layouts: Record<string, LayoutDefinition> = {
  qwerty,
  "qwertz-de": qwertzDe,
  numeric,
  special,
  numpad,
  fkeys,
  "qwerty-fk": qwertyFk,
  "qwertz-de-fk": qwertzDeFk,
};

export default layouts;
