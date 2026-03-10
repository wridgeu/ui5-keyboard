import type { LayoutDefinition } from "../types.js";
import fkeyRow from "./fkey-row.js";
import qwertzDe from "./qwertz-de.js";

const qwertzDeFk: LayoutDefinition = [fkeyRow, ...qwertzDe];

export default qwertzDeFk;
