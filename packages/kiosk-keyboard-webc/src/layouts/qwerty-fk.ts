import type { LayoutDefinition } from "../types.js";
import fkeyRow from "./fkey-row.js";
import qwerty from "./qwerty.js";

const qwertyFk: LayoutDefinition = [fkeyRow, ...qwerty];

export default qwertyFk;
