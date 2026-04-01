sap.ui.define([], () => {
  "use strict";

  return {
    name: "QUnit test suite for ui5.hotkeys",
    defaults: {
      page: "ui5://test-resources/ui5/hotkeys/qunit/Test.qunit.html?testsuite={suite}&test={name}",
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
      constants: {
        title: "QUnit tests for ui5.hotkeys - constants",
      },
      platform: {
        title: "QUnit tests for ui5.hotkeys - platform",
      },
      parse: {
        title: "QUnit tests for ui5.hotkeys - parse",
      },
      match: {
        title: "QUnit tests for ui5.hotkeys - match",
      },
      dom: {
        title: "QUnit tests for ui5.hotkeys - dom",
      },
      format: {
        title: "QUnit tests for ui5.hotkeys - format",
      },
      HotkeyManager: {
        title: "QUnit tests for ui5.hotkeys - HotkeyManager",
      },
      validate: {
        title: "QUnit tests for ui5.hotkeys - validate",
      },
      "router-integration": {
        title: "QUnit tests for ui5.hotkeys - Router Integration",
      },
      "dialog-scope": {
        title: "QUnit tests for ui5.hotkeys - Dialog & Fragment Scopes",
      },
      SequenceManager: {
        title: "QUnit tests for ui5.hotkeys - SequenceManager",
      },
      KeyStateTracker: {
        title: "QUnit tests for ui5.hotkeys - KeyStateTracker",
      },
      HotkeyRecorder: {
        title: "QUnit tests for ui5.hotkeys - HotkeyRecorder",
      },
      RegistrationGroup: {
        title: "QUnit tests for ui5.hotkeys - RegistrationGroup",
      },
      "HotkeyManager-blackbox": {
        title: "QUnit tests for ui5.hotkeys - HotkeyManager Black-Box Contracts",
      },
      "SequenceManager-blackbox": {
        title: "QUnit tests for ui5.hotkeys - SequenceManager Black-Box Contracts",
      },
      "skip-reason": {
        title: "QUnit tests for ui5.hotkeys - skip-reason",
      },
      "dispatch-core": {
        title: "QUnit tests for ui5.hotkeys - dispatch-core",
      },
      "event-dispatcher": {
        title: "QUnit tests for ui5.hotkeys - EventDispatcher & Suspend Guard",
      },
      "negative-edge-cases": {
        title: "QUnit tests for ui5.hotkeys - Negative & Edge-Case Paths",
      },
    },
  };
});
