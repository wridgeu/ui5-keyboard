// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(
  ["ui5/kiosk/KioskKeyboard", "sap/m/Input", "sap/m/StepInput", "sap/ui/webc/main/Input"],
  function (KioskKeyboard, Input, StepInput, WebcInput) {
    "use strict";

    var input = new Input("interopInput", { width: "320px", placeholder: "Standard Input" });
    input.placeAt("interop-input");

    var step = new StepInput("interopStep", { width: "320px", min: 0, max: 999, value: 5 });
    step.placeAt("interop-step");

    var webc = new WebcInput("interopWebc", { width: "320px", placeholder: "WebC Input" });
    webc.placeAt("interop-webc");

    new KioskKeyboard({
      id: "interopKeyboard",
      docked: true,
      autoShow: true,
      autoType: true,
      mobileKeyboard: "Custom",
      inputIds: [input.getId(), step.getId(), webc.getId()],
    }).placeAt("interop-kb");
  },
);
