// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(["ui5/kiosk/KioskKeyboard", "sap/ui/core/Theming"], function (KioskKeyboard, Theming) {
  "use strict";

  new KioskKeyboard().placeAt("kb-qwerty");
  new KioskKeyboard({ keyboardType: "Numpad" }).placeAt("kb-numpad");

  // Expose theme switching for e2e tests
  window.__setTheme = function (theme) {
    return new Promise(function (resolve) {
      Theming.attachApplied(function onApplied() {
        Theming.detachApplied(onApplied);
        resolve();
      });
      Theming.setTheme(theme);
    });
  };
});
