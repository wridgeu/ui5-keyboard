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
 * Event mappings: Since UI5 >= 1.138, the WebComponent bridge auto-converts
 * camelCase event names to kebab-case DOM events via `sap/base/strings/hyphenate`
 * (e.g. `keyPress` → `key-press`). Explicit `mapping: { to: "..." }` is not
 * needed as long as `minUI5Version` in manifest.json is >= 1.138.
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
      accessibleName: {
        type: "string",
        defaultValue: "",
        mapping: { type: "property", to: "accessible-name" },
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
        allowPreventDefault: true,
        parameters: {
          key: { type: "string" },
          shiftKey: { type: "boolean" },
          char: { type: "string" },
        },
      },
      afterOpen: {},
      afterClose: {},
      layoutChange: {
        parameters: {
          layout: { type: "string" },
        },
      },
      keyboardTypeChange: {
        parameters: {
          keyboardType: { type: "string" },
          previousKeyboardType: { type: "string" },
          autoDetected: { type: "boolean" },
        },
      },
      targetInputChange: {
        parameters: {
          targetElement: { type: "any" },
        },
      },
    },
    associations: {
      ariaLabelledBy: { type: "sap.ui.core.Control", multiple: true, singularName: "ariaLabelledBy" },
      ariaDescribedBy: { type: "sap.ui.core.Control", multiple: true, singularName: "ariaDescribedBy" },
    },
    methods: [
      "show",
      "close",
      "isOpen",
      "setTargetElement",
      "setTargetResolver",
      "resetKeyboardType",
      "refreshResponsiveState",
    ],
  },
}) as typeof WebComponent;

export default KioskKeyboardWebc;
