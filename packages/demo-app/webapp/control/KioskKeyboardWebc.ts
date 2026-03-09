import WebComponent from "sap/ui/core/webc/WebComponent";

/**
 * UI5 bridge control for the `<kiosk-keyboard>` native web component.
 *
 * Uses `WebComponent.extend()` to map attributes/properties so the element
 * can be consumed in XML views and participate in UI5 data binding.
 *
 * Note: For primitive types (string, boolean), `mapping.type = "property"`
 * renders values as HTML attributes on the custom tag. The `to` field must
 * use kebab-case attribute names (e.g. "keyboard-type") which the UI5 Web
 * Components `@property()` decorator reflects to camelCase JS properties.
 *
 */
const KioskKeyboardWebc = WebComponent.extend("demo.hotkeys.control.KioskKeyboardWebc", {
  metadata: {
    tag: "kiosk-keyboard",
    properties: {
      layout: {
        type: "string",
        defaultValue: "",
        mapping: { type: "property", to: "layout" },
      },
      keyboardType: {
        type: "string",
        defaultValue: "Full",
        mapping: { type: "property", to: "keyboard-type" },
      },
      docked: {
        type: "boolean",
        defaultValue: false,
        mapping: { type: "property", to: "docked" },
      },
      open: {
        type: "boolean",
        defaultValue: false,
        mapping: { type: "property", to: "open" },
      },
      autoShow: {
        type: "boolean",
        defaultValue: false,
        mapping: { type: "property", to: "auto-show" },
      },
      autoType: {
        type: "boolean",
        defaultValue: false,
        mapping: { type: "property", to: "auto-type" },
      },
      disabled: {
        type: "boolean",
        defaultValue: false,
        mapping: { type: "property", to: "disabled" },
      },
      ariaLabel: {
        type: "string",
        defaultValue: "",
        mapping: { type: "property", to: "aria-label" },
      },
      inputIds: {
        type: "string",
        defaultValue: "",
        mapping: { type: "property", to: "input-ids" },
      },
      for: {
        type: "string",
        defaultValue: "",
        mapping: { type: "property", to: "for" },
      },
      stableHeight: {
        type: "boolean",
        defaultValue: false,
        mapping: { type: "property", to: "stable-height" },
      },
      mobileKeyboard: {
        type: "string",
        defaultValue: "Auto",
        mapping: { type: "property", to: "mobile-keyboard" },
      },
      fKeyMode: {
        type: "string",
        defaultValue: "Virtual",
        mapping: { type: "property", to: "f-key-mode" },
      },
    },
    events: {
      keyPress: {
        detail: {
          key: { type: "string" },
          shiftKey: { type: "boolean" },
          char: { type: "string" },
        },
      },
      afterOpen: {},
      afterClose: {},
      layoutChange: {
        detail: {
          layout: { type: "string" },
        },
      },
      keyboardTypeChange: {
        detail: {
          keyboardType: { type: "string" },
          previousKeyboardType: { type: "string" },
          autoDetected: { type: "boolean" },
        },
      },
    },
    associations: {
      ariaLabelledBy: { type: "sap.ui.core.Control", multiple: true, singularName: "ariaLabelledBy" },
      ariaDescribedBy: { type: "sap.ui.core.Control", multiple: true, singularName: "ariaDescribedBy" },
    },
    methods: ["show", "close", "isOpen", "setTargetElement", "setTargetResolver", "resetKeyboardType"],
  },
}) as typeof WebComponent;

export default KioskKeyboardWebc;
