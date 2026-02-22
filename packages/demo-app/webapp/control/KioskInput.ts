import type { MetadataOptions } from "sap/ui/core/webc/WebComponent";
import WebComponent from "sap/ui/core/webc/WebComponent";
import DemoKioskInputElement from "demo/hotkeys/webc/DemoKioskInput";

void DemoKioskInputElement;

export default class KioskInput extends WebComponent {
  static readonly metadata: MetadataOptions = {
    tag: "demo-kiosk-input",
    properties: {
      value: "string",
      placeholder: "string",
    },
    methods: ["focusInner"],
  };
}
