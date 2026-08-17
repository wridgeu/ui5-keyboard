import WebComponent from "sap/ui/core/webc/WebComponent";
import DemoKioskInput from "demo/hotkeys/webc/DemoKioskInput";

// SAFETY: `WebComponent.extend` is declared as returning the untyped `Function`, while it
// actually returns the generated subclass constructor, so the value carries the full
// WebComponent class API.
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
    if (host instanceof DemoKioskInput) {
      host.value = value;
    }

    return this;
  },

  setPlaceholder(placeholder: string) {
    this.setProperty("placeholder", placeholder, true);

    const host = this.getDomRef();
    if (host instanceof DemoKioskInput) {
      host.placeholder = placeholder;
    }

    return this;
  },

  getIdForLabel() {
    return `${this.getId()}-inner`;
  },
}) as typeof WebComponent;

export default KioskInput;
