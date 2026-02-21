import type { LayoutDefinition } from "../types";
import navRow from "./nav-row";
import qwerty from "./qwerty";

const qwertyNav: LayoutDefinition = [navRow, ...qwerty];

export default qwertyNav;
