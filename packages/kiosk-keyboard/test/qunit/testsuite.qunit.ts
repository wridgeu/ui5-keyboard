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
      "KioskKeyboard-renderer-blackbox": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard Renderer Black-Box",
      },
      "KioskKeyboard-backspace-repeat": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard Backspace Auto-Repeat",
      },
      "auto-repeat": {
        title: "QUnit tests for ui5.kiosk - AutoRepeater",
      },
      "KioskKeyboard-autoshow-blackbox": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard Auto-Show Black-Box",
      },
      "input-operations": {
        title: "QUnit tests for ui5.kiosk - input-operations",
      },
      "target-input-session": {
        title: "QUnit tests for ui5.kiosk - target-input-session",
      },
      "focus-claim-service": {
        title: "QUnit tests for ui5.kiosk - focus-claim-service",
      },
      "dom-resolution": {
        title: "QUnit tests for ui5.kiosk - DOM resolution (resolveInputOrTextarea)",
      },
      "layout-registry": {
        title: "QUnit tests for ui5.kiosk - layout-registry",
      },
      "i18n-registry": {
        title: "QUnit tests for ui5.kiosk - i18n-registry",
      },
      "key-labels": {
        title: "QUnit tests for ui5.kiosk - key-labels",
      },
      "key-token": {
        title: "QUnit tests for ui5.kiosk - key-token parseKeyAction",
      },
      "latin-variants": {
        title: "QUnit tests for ui5.kiosk - latin-variants long-press table & helpers",
      },
      "layout-meta": {
        title: "QUnit tests for ui5.kiosk - layout-meta per-layout attributes",
      },
      "custom-layout-fold": {
        title: "QUnit tests for ui5.kiosk - custom-layout-fold per-facet merge & diagnostics",
      },
      "KioskKeyboard-layout": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard Layout Management",
      },
      "KioskKeyboard-docked": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard Docked Mode",
      },
      "KioskKeyboard-a11y": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard Accessibility",
      },
      "KioskKeyboard-focus": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard Focus & Navigation",
      },
      "KioskKeyboard-i18n": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard i18n Integration",
      },
      "negative-edge-cases": {
        title: "QUnit tests for ui5.kiosk - Negative-path & edge-case tests",
      },
      "KioskKeyboard-responsive": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard Responsive Sizing",
      },
      "KioskKeyboard-autocompact": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard autoCompact",
      },
      "auto-compact-behavior": {
        title: "QUnit tests for ui5.kiosk - AutoCompactBehavior",
      },
      "shift-state": {
        title: "QUnit tests for ui5.kiosk - ShiftState",
      },
      "middleware-registry": {
        title: "QUnit tests for ui5.kiosk - middleware-registry",
      },
      "kana-dakuten": {
        title: "QUnit tests for ui5.kiosk - kana-dakuten middleware",
      },
      "hangul-compose": {
        title: "QUnit tests for ui5.kiosk - hangul-compose middleware",
      },
      "native-keyboard-suppression": {
        title: "QUnit tests for ui5.kiosk - NativeKeyboardSuppression",
      },
      "custom-layouts": {
        title: "QUnit tests for ui5.kiosk - customLayouts aggregation",
      },
      "compose-layout": {
        title: "QUnit tests for ui5.kiosk - composeLayout splice helper",
      },
      "customLayouts-xml": {
        title: "QUnit tests for ui5.kiosk - customLayouts declared in an XML view",
      },
      "unknown-token": {
        title: "QUnit tests for ui5.kiosk - unrecognized {token} keys are no-ops",
      },
      "custom-keys": {
        title: "QUnit tests for ui5.kiosk - custom keys via enriched keyPress + input API",
      },
      "keyboard-type-middleware": {
        title: "QUnit tests for ui5.kiosk - keyboardType vs composition middleware",
      },
      "KioskKeyboard-variants": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard accent-variant popup",
      },
      "KioskKeyboard-capslock-sharp-s": {
        title: "QUnit tests for ui5.kiosk - CapsLock emits ẞ from the base ß key",
      },
      "KioskKeyboard-capslock-shiftvalue": {
        title: "QUnit tests for ui5.kiosk - CapsLock is uppercase-mode, not a Shift alias",
      },
      "KioskKeyboard-reset": {
        title: "QUnit tests for ui5.kiosk - KioskKeyboard reset() restores a fresh input context",
      },
    },
  };
});
