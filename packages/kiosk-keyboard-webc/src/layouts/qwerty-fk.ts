import type { LayoutDefinition } from "../types.js";
import { _registerBuiltInLayout } from "../core/layout-registry.js";
import fkeyRow from "./fkey-row.js";
import qwerty from "./qwerty.js";

const qwertyFk: LayoutDefinition = [fkeyRow, ...qwerty];

_registerBuiltInLayout("qwerty-fk", qwertyFk);

export default qwertyFk;
