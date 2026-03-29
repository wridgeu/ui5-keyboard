import type { LayoutDefinition } from "../types.js";
import { _registerBuiltInLayout } from "../core/layout-registry.js";
import fkeyRow from "./fkey-row.js";
import qwertzDe from "./qwertz-de.js";

const qwertzDeFk: LayoutDefinition = [fkeyRow, ...qwertzDe];

_registerBuiltInLayout("qwertz-de-fk", qwertzDeFk);

export default qwertzDeFk;
