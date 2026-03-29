import type { LayoutDefinition } from "../types.js";
import { _registerBuiltInLayout } from "../core/layout-registry.js";
import navRow from "./nav-row.js";
import qwerty from "./qwerty.js";

const qwertyNav: LayoutDefinition = [navRow, ...qwerty];

_registerBuiltInLayout("qwerty-nav", qwertyNav);

export default qwertyNav;
