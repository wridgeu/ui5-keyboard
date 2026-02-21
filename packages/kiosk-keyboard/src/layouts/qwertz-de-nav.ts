import type { LayoutDefinition } from "../types";
import navRow from "./nav-row";
import qwertzDe from "./qwertz-de";

const qwertzDeNav: LayoutDefinition = [navRow, ...qwertzDe];

export default qwertzDeNav;
