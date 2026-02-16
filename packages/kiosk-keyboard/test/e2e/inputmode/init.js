// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(["ui5/kiosk/KioskKeyboard", "sap/m/Input"], function (KioskKeyboard, Input) {
  "use strict";

  // 1. Custom mode — should suppress native keyboard (inputmode="none")
  var inputCustom = new Input({ width: "300px", placeholder: "Custom mode" });
  inputCustom.placeAt("input-custom");
  var kbCustom = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: "Custom",
    targetInput: inputCustom,
  });
  kbCustom.placeAt("kb-custom");

  // 2. Native mode — should NOT suppress (no inputmode change)
  var inputNative = new Input({ width: "300px", placeholder: "Native mode" });
  inputNative.placeAt("input-native");
  var kbNative = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: "Native",
    targetInput: inputNative,
  });
  kbNative.placeAt("kb-native");

  // 3. Auto mode — on desktop should suppress (inputmode="none")
  var inputAuto = new Input({ width: "300px", placeholder: "Auto mode" });
  inputAuto.placeAt("input-auto");
  var kbAuto = new KioskKeyboard({
    docked: true,
    autoShow: true,
    mobileKeyboard: "Auto",
    targetInput: inputAuto,
  });
  kbAuto.placeAt("kb-auto");
});
