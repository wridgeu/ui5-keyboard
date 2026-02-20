import type { KeyRow } from "../types";

/**
 * Shared F1-F12 key row used by the built-in variant layouts (`qwerty-fk`,
 * `qwertz-de-fk`). Import this to compose custom variant layouts:
 *
 * ```ts
 * import fkeyRow from "ui5/kiosk/layouts/fkey-row";
 * import type { LayoutDefinition } from "ui5/kiosk/types";
 *
 * const azertyFk: LayoutDefinition = [fkeyRow, ...azerty];
 * KioskKeyboard.registerLayout("azerty-fr-fk", azertyFk);
 * ```
 *
 * @public
 */
const fkeyRow: KeyRow = [
  { value: "{fkey:F1}", label: "F1", type: "modifier" },
  { value: "{fkey:F2}", label: "F2", type: "modifier" },
  { value: "{fkey:F3}", label: "F3", type: "modifier" },
  { value: "{fkey:F4}", label: "F4", type: "modifier" },
  { value: "{fkey:F5}", label: "F5", type: "modifier" },
  { value: "{fkey:F6}", label: "F6", type: "modifier" },
  { value: "{fkey:F7}", label: "F7", type: "modifier" },
  { value: "{fkey:F8}", label: "F8", type: "modifier" },
  { value: "{fkey:F9}", label: "F9", type: "modifier" },
  { value: "{fkey:F10}", label: "F10", type: "modifier" },
  { value: "{fkey:F11}", label: "F11", type: "modifier" },
  { value: "{fkey:F12}", label: "F12", type: "modifier" },
];

export default fkeyRow;
