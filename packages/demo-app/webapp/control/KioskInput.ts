import WebComponent from "sap/ui/core/webc/WebComponent";

const KioskInput = WebComponent.extend("demo.hotkeys.control.KioskInput", {
  metadata: {
    tag: "demo-kiosk-input",
    properties: {
      value: {
        type: "string",
        mapping: {
          type: "property",
          to: "value",
        },
      },
      placeholder: {
        type: "string",
        mapping: {
          type: "property",
          to: "placeholder",
        },
      },
    },
    methods: ["focusInner"],
  },

  setValue(value: string) {
    this.setProperty("value", value, true);

    const host = this.getDomRef();
    if (host instanceof HTMLElement) {
      (host as HTMLElement & { value?: string }).value = value;
    }

    return this;
  },

  setPlaceholder(placeholder: string) {
    this.setProperty("placeholder", placeholder, true);

    const host = this.getDomRef();
    if (host instanceof HTMLElement) {
      (host as HTMLElement & { placeholder?: string }).placeholder = placeholder;
    }

    return this;
  },
}) as typeof WebComponent;

export default KioskInput;
