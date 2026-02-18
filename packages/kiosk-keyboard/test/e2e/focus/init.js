// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(["ui5/kiosk/KioskKeyboard", "sap/m/Input"], function (KioskKeyboard, Input) {
  "use strict";

  var inputA = new Input({ width: "300px", placeholder: "Input A" });
  inputA.placeAt("input-a");

  var inputB = new Input({ width: "300px", placeholder: "Input B" });
  inputB.placeAt("input-b");

  var kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: "Custom",
  });
  kb.placeAt("kb");
});
