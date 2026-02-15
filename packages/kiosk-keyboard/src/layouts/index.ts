import type { LayoutDefinition } from "../types";
import qwerty from "./qwerty";
import numeric from "./numeric";
import special from "./special";
import numpad from "./numpad";

const layouts: Record<string, LayoutDefinition> = {
  qwerty,
  numeric,
  special,
  numpad,
};

export default layouts;
