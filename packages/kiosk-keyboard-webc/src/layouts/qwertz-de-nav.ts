import type { LayoutDefinition } from "../types.js";
import { _registerBuiltInLayout } from "../core/layout-registry.js";
import navRow from "./nav-row.js";
import qwertzDe from "./qwertz-de.js";

const qwertzDeNav: LayoutDefinition = [navRow, ...qwertzDe];

_registerBuiltInLayout("qwertz-de-nav", qwertzDeNav);

export default qwertzDeNav;
