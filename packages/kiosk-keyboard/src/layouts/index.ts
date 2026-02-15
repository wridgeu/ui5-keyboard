import type { LayoutDefinition } from "../types";
import qwerty from "./qwerty";
import qwertzDe from "./qwertz-de";
import numeric from "./numeric";
import special from "./special";
import numpad from "./numpad";

const layouts: Record<string, LayoutDefinition> = {
  qwerty,
  "qwertz-de": qwertzDe,
  numeric,
  special,
  numpad,
};

export default layouts;
