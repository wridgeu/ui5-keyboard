import type { LayoutDefinition } from "../types";
import fkeyRow from "./fkey-row";
import qwertzDe from "./qwertz-de";

const qwertzDeFk: LayoutDefinition = [fkeyRow, ...qwertzDe];

export default qwertzDeFk;
