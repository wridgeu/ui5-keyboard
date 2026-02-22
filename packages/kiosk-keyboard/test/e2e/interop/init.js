// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(
  ["ui5/kiosk/KioskKeyboard", "sap/m/Input", "sap/m/StepInput", "sap/m/TextArea", "sap/ui/core/Element"],
  function (KioskKeyboard, Input, StepInput, TextArea, Element) {
    "use strict";

    window.interopHarnessReady = false;

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

    if (!customElements.get("interop-shadow-bridge-input")) {
      customElements.define(
        "interop-shadow-bridge-input",
        class extends HTMLElement {
          connectedCallback() {
            if (this.shadowRoot && this.shadowRoot.querySelector("input")) return;
            var root = this.shadowRoot || this.attachShadow({ mode: "open" });
            var input = document.createElement("input");
            input.type = "text";
            input.placeholder = "Custom element (shadow bridge target)";
            input.style.width = "320px";
            input.style.padding = "10px";
            input.style.border = "1px solid #c8d0d8";
            input.style.borderRadius = "8px";
            root.append(input);
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

    var shadowBridge = new Input("interopShadowBridgeInput", { visible: false, value: "" });
    shadowBridge.placeAt("interop-shadow-bridge");

    var host = document.getElementById("interop-custom-host");
    if (host) {
      host.innerHTML = '<interop-bridge-input id="interopCustom"></interop-bridge-input>';
    }

    var shadowHost = document.getElementById("interop-shadow-host");
    if (shadowHost) {
      shadowHost.innerHTML = '<interop-shadow-bridge-input id="interopShadowCustom"></interop-shadow-bridge-input>';
    }

    var custom = document.getElementById("interopCustom");
    var shadowCustom = document.getElementById("interopShadowCustom");

    var keyboard = new KioskKeyboard({
      id: "interopKeyboard",
      docked: true,
      autoShow: true,
      autoType: true,
      mobileKeyboard: "Custom",
      inputIds: [input.getId(), step.getId(), textArea.getId(), bridge.getId(), shadowBridge.getId()],
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

    if (shadowCustom instanceof HTMLElement) {
      const getShadowInput = function () {
        return shadowCustom.shadowRoot ? shadowCustom.shadowRoot.querySelector("input") : null;
      };

      const adoptShadowBridgeTarget = function () {
        const nativeInput = getShadowInput();
        shadowBridge.setValue(nativeInput ? nativeInput.value : "");
        keyboard.setTargetInput(shadowBridge);
        keyboard.show();
        shadowBridge.focus();
      };

      shadowCustom.addEventListener("focusin", adoptShadowBridgeTarget);

      const shadowInput = getShadowInput();
      if (shadowInput instanceof HTMLInputElement) {
        shadowInput.addEventListener("focus", adoptShadowBridgeTarget);
        shadowInput.addEventListener("input", function () {
          shadowBridge.setValue(shadowInput.value);
        });
      }
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
      focusShadowCustomElement: function () {
        var el = document.getElementById("interopShadowCustom");
        var nativeInput = el && el.shadowRoot ? el.shadowRoot.querySelector("input") : null;
        if (nativeInput instanceof HTMLElement) {
          nativeInput.focus();
        }
      },
    };

    window.interopHarnessReady = true;
  },
);
