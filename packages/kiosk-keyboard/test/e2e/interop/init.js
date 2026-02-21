// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(
  ["ui5/kiosk/KioskKeyboard", "sap/m/Input", "sap/m/StepInput", "sap/m/TextArea", "sap/ui/core/Element"],
  function (KioskKeyboard, Input, StepInput, TextArea, Element) {
    "use strict";

    var input = new Input("interopInput", { width: "320px", placeholder: "Standard Input" });
    input.placeAt("interop-input");

    var step = new StepInput("interopStep", { width: "320px", min: 0, max: 999, value: 5 });
    step.placeAt("interop-step");

    var textArea = new TextArea("interopTextArea", { width: "320px", rows: 3, value: "" });
    textArea.placeAt("interop-textarea");

    new KioskKeyboard({
      id: "interopKeyboard",
      docked: true,
      autoShow: true,
      autoType: true,
      mobileKeyboard: "Custom",
      inputIds: [input.getId(), step.getId(), textArea.getId()],
    }).placeAt("interop-kb");

    window.interopHarness = {
      focusControlById: function (id) {
        var control = Element.getElementById(id);
        if (!control) return;

        var focusRef = control.getFocusDomRef && control.getFocusDomRef();
        if (focusRef instanceof HTMLElement) {
          const shadowInput = focusRef.shadowRoot && focusRef.shadowRoot.querySelector("input,textarea");
          const lightInput = focusRef.querySelector && focusRef.querySelector("input,textarea");
          (shadowInput || lightInput || focusRef).focus();
          return;
        }

        if (control.focus) {
          control.focus();
        }
      },
      getKeyboardTargetId: function () {
        var kb = Element.getElementById("interopKeyboard");
        return kb && kb.getTargetInput ? kb.getTargetInput() : "";
      },
    };
  },
);
