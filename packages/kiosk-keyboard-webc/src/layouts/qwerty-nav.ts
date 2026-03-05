import type { LayoutDefinition } from "../types.js";
import navRow from "./nav-row.js";
import qwerty from "./qwerty.js";

const qwertyNav: LayoutDefinition = [navRow, ...qwerty];

export default qwertyNav;
