// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(
  ["ui5/kiosk/KioskKeyboard", "sap/m/Input", "sap/m/StepInput", "sap/m/TextArea", "sap/ui/core/Element"],
  function (KioskKeyboard, Input, StepInput, TextArea, Element) {
    "use strict";

    if (!customElements.get("interop-bridge-input")) {
      customElements.define(
        "interop-bridge-input",
        class extends HTMLElement {
          connectedCallback() {
            if (this.querySelector("input")) return;
            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = "Custom element (bridge target)";
            input.style.width = "320px";
            input.style.padding = "10px";
            input.style.border = "1px solid #c8d0d8";
            input.style.borderRadius = "8px";
            this.append(input);
          }
        },
      );
    }

    var input = new Input("interopInput", { width: "320px", placeholder: "Standard Input" });
    input.placeAt("interop-input");

    var step = new StepInput("interopStep", { width: "320px", min: 0, max: 999, value: 5 });
    step.placeAt("interop-step");

    var textArea = new TextArea("interopTextArea", { width: "320px", rows: 3, value: "" });
    textArea.placeAt("interop-textarea");

    var bridge = new Input("interopBridgeInput", { visible: false, value: "" });
    bridge.placeAt("interop-bridge");

    var host = document.getElementById("interop-custom-host");
    if (host) {
      host.innerHTML = '<interop-bridge-input id="interopCustom"></interop-bridge-input>';
    }

    var custom = document.getElementById("interopCustom");

    var keyboard = new KioskKeyboard({
      id: "interopKeyboard",
      docked: true,
      autoShow: true,
      autoType: true,
      mobileKeyboard: "Custom",
      inputIds: [input.getId(), step.getId(), textArea.getId(), bridge.getId()],
    });
    keyboard.placeAt("interop-kb");

    if (custom instanceof HTMLElement) {
      custom.addEventListener("focusin", function () {
        var nativeInput = custom.querySelector("input");
        bridge.setValue(nativeInput ? nativeInput.value : "");
        keyboard.setTargetInput(bridge);
        keyboard.show();
        bridge.focus();
      });
      custom.addEventListener(
        "input",
        function (event) {
          var target = event.target;
          if (target instanceof HTMLInputElement) {
            bridge.setValue(target.value);
          }
        },
        true,
      );
    }

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
      focusCustomElement: function () {
        var el = document.getElementById("interopCustom");
        var nativeInput = el && el.querySelector ? el.querySelector("input") : null;
        if (nativeInput instanceof HTMLElement) {
          nativeInput.focus();
        }
      },
    };
  },
);
