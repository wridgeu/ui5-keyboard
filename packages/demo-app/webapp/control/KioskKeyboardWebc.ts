import WebComponent from "sap/ui/core/webc/WebComponent";

/**
 * UI5 bridge control for the `<kiosk-keyboard>` native web component.
 *
 * Uses `WebComponent.extend()` to map attributes/properties so the element
 * can be consumed in XML views and participate in UI5 data binding.
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
        defaultValue: "",
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
    },
    methods: ["show", "close", "setTargetElement", "resetKeyboardType"],
  },
}) as typeof WebComponent;

export default KioskKeyboardWebc;
