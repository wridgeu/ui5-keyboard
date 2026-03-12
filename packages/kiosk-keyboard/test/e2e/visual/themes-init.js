// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(["ui5/kiosk/KioskKeyboard"], function (KioskKeyboard) {
  "use strict";

  new KioskKeyboard().placeAt("kb-qwerty");
  new KioskKeyboard({ keyboardType: "Numpad" }).placeAt("kb-numpad");
});
