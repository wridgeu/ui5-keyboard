import type { MetadataOptions } from "sap/ui/core/webc/WebComponent";
import WebComponent from "sap/ui/core/webc/WebComponent";
import CustomAlertButtonElement from "demo/hotkeys/webc/CustomAlertButton";

void CustomAlertButtonElement;

export default class AlertButton extends WebComponent {
  static readonly metadata: MetadataOptions = {
    tag: "demo-alert-button",
    properties: {
      text: "string",
      message: "string",
    },
  };
}
