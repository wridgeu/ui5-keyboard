import type { LayoutDefinition } from "../types.js";
import navRow from "./nav-row.js";
import qwertzDe from "./qwertz-de.js";

const qwertzDeNav: LayoutDefinition = [navRow, ...qwertzDe];

export default qwertzDeNav;
