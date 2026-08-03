import CustomLayout from "ui5/kiosk/CustomLayout";
import type { MetadataOptions } from "sap/ui/core/Element";
import { ARABIC_DIGITS_LAYOUT } from "../layouts/custom-layouts";

/**
 * The Arabic-Indic digit pad shipped as one named unit rather than as a bag of
 * properties spread across a settings object: everything the layout is - its rows
 * and the language its keycaps are written in - travels together and is reusable
 * as `<demo:ArabicDigitsCustomLayout/>` with no further configuration.
 *
 * @namespace demo.hotkeys.customlayout
 * @extends ui5.kiosk.CustomLayout
 */
export default class ArabicDigitsCustomLayout extends CustomLayout {
  static override readonly metadata: MetadataOptions = {
    library: "demo.hotkeys",
  };

  /**
   * `init` runs before `applySettings`, so the unit's own values are defaults a
   * consumer can still override on the element.
   */
  override init(): void {
    this.setName("arabic-digits");
    this.setRows(ARABIC_DIGITS_LAYOUT);
    this.setKeycapLang("ar");
  }
}
