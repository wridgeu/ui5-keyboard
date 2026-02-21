sap.ui.define([], () => {
  "use strict";

  return {
    name: "QUnit test suite for ui5.kiosk",
    defaults: {
      page: "ui5://test-resources/ui5/kiosk/qunit/Test.qunit.html?testsuite={suite}&test={name}",
      qunit: {
        version: 2,
      },
      sinon: {
        version: 4,
      },
      ui5: {
        theme: "sap_horizon",
      },
    },
    tests: {
      KioskKeyboard: {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard",
      },
      "KioskKeyboard-events": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard Events & RTL",
      },
      "KioskKeyboard-autotype-mobile": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard autoType & mobile keyboard",
      },
      "KioskKeyboard-autoshow": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard autoShow",
      },
      FKeys: {
        title: "QUnit tests for ui5.kiosk - FKeys",
      },
      NavKeys: {
        title: "QUnit tests for ui5.kiosk - NavKeys",
      },
      Grapheme: {
        title: "QUnit tests for ui5.kiosk - Grapheme",
      },
    },
  };
});
