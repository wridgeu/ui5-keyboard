import type { LayoutDefinition } from "../types";
import fkeyRow from "./fkey-row";
import qwerty from "./qwerty";

const qwertyFk: LayoutDefinition = [fkeyRow, ...qwerty];

export default qwertyFk;
