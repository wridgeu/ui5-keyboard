import WebComponent from "sap/ui/core/webc/WebComponent";
import "demo/hotkeys/webc/CustomAlertButton";

// SAFETY: `WebComponent.extend` is declared as returning the untyped `Function`, while it
// actually returns the generated subclass constructor, so the value carries the full
// WebComponent class API.
const AlertButton = WebComponent.extend("demo.hotkeys.control.AlertButton", {
  metadata: {
    tag: "demo-alert-button",
    properties: {
      text: {
        type: "string",
        mapping: {
          type: "property",
          to: "text",
        },
      },
      message: {
        type: "string",
        mapping: {
          type: "property",
          to: "message",
        },
      },
    },
    events: {
      demoAlert: {
        parameters: {
          message: "string",
        },
        mapping: {
          to: "demo-alert",
        },
      },
    },
  },
}) as typeof WebComponent;

export default AlertButton;
