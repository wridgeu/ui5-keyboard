// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(
  [
    "ui5/kiosk/KioskKeyboard",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/SearchField",
    "sap/m/ComboBox",
    "sap/m/DatePicker",
    "sap/m/StepInput",
    "sap/m/CheckBox",
    "sap/m/RadioButton",
    "sap/ui/core/Item",
  ],
  function (KioskKeyboard, Input, TextArea, SearchField, ComboBox, DatePicker, StepInput, CheckBox, RadioButton, Item) {
    "use strict";

    // ── Full keyboard inputs ──
    new Input({ width: "300px", placeholder: "Text (default)" }).placeAt("input-text");
    new Input({ width: "300px", type: "Email", placeholder: "Email" }).placeAt("input-email");
    new Input({ width: "300px", type: "Password", placeholder: "Password" }).placeAt("input-password");
    new Input({ width: "300px", type: "Url", placeholder: "URL" }).placeAt("input-url");
    new TextArea({ width: "300px", placeholder: "TextArea" }).placeAt("input-textarea");
    new SearchField({ width: "300px", placeholder: "Search" }).placeAt("input-search");
    new ComboBox({
      width: "300px",
      placeholder: "ComboBox",
      items: [new Item({ key: "a", text: "Alpha" }), new Item({ key: "b", text: "Beta" })],
    }).placeAt("input-combo");
    new DatePicker({ width: "300px", placeholder: "Date" }).placeAt("input-date");

    // ── Numpad keyboard inputs ──
    new Input({ width: "300px", type: "Number", placeholder: "Number" }).placeAt("input-number");
    new Input({ width: "300px", type: "Tel", placeholder: "Tel" }).placeAt("input-tel");
    new StepInput({ width: "300px" }).placeAt("input-step");

    // ── Ignored inputs ──
    new CheckBox({ text: "Checkbox" }).placeAt("input-checkbox");
    new RadioButton({ text: "Radio" }).placeAt("input-radio");
    new Input({ width: "300px", editable: false, value: "Readonly" }).placeAt("input-readonly");

    // ── Single docked keyboard with autoShow + autoType ──
    new KioskKeyboard({
      docked: true,
      autoShow: true,
      autoType: true,
      mobileKeyboard: "Custom",
    }).placeAt("kb");
  },
);
