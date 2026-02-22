import WebComponent from "sap/ui/core/webc/WebComponent";

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
