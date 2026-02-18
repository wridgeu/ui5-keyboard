// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(
  ["ui5/kiosk/KioskKeyboard", "sap/m/Input", "sap/m/TextArea", "sap/m/Button", "sap/m/Popover", "sap/m/VBox"],
  function (KioskKeyboard, Input, TextArea, Button, Popover, VBox) {
    "use strict";

    // 1. Default QWERTY
    new KioskKeyboard().placeAt("kb-qwerty");

    // 2. With Input Target
    var input = new Input({ value: "Hello World", width: "300px" });
    input.placeAt("input-area");
    var kbInput = new KioskKeyboard({ targetInput: input });
    kbInput.placeAt("kb-with-input");

    // 3. Numpad
    var kbNumpad = new KioskKeyboard({ keyboardType: "Numpad" });
    kbNumpad.placeAt("kb-numpad");

    // 4. Numeric
    var kbNumeric = new KioskKeyboard({ keyboardType: "Numeric" });
    kbNumeric.placeAt("kb-numeric");

    // 5. Disabled
    var kbDisabled = new KioskKeyboard({ enabled: false });
    kbDisabled.placeAt("kb-disabled");

    // 6. Wide container
    new KioskKeyboard().placeAt("kb-wide");

    // 7. Narrow container
    new KioskKeyboard().placeAt("kb-narrow");

    // 8. Compact density
    new KioskKeyboard().placeAt("kb-compact");

    // 9. Docked
    var kbDocked = new KioskKeyboard({ docked: true });
    kbDocked.placeAt("kb-docked");

    document.getElementById("toggle-docked").addEventListener("click", function () {
      if (kbDocked.isOpen()) {
        kbDocked.close();
      } else {
        kbDocked.show();
      }
    });

    // 10. Inside Popover
    var popoverInput = new Input({ width: "100%", placeholder: "Type here..." });
    var popoverKb = new KioskKeyboard({ targetInput: popoverInput });
    var popover = new Popover({
      title: "Kiosk Input",
      contentWidth: "360px",
      content: [
        new VBox({
          items: [popoverInput, popoverKb],
        }),
      ],
    });
    var openBtn = new Button({
      text: "Open Popover with Keyboard",
      press: function () {
        popover.openBy(openBtn);
      },
    });
    openBtn.placeAt("popover-trigger");

    // 11. Shift / CapsLock state
    var shiftInput = new Input({ value: "Test shift", width: "300px" });
    shiftInput.placeAt("input-shift");
    var kbShift = new KioskKeyboard({ targetInput: shiftInput });
    kbShift.placeAt("kb-shift");

    // 12. Special characters layout
    var kbSpecial = new KioskKeyboard({ layout: "special" });
    kbSpecial.placeAt("kb-special");

    // 13. Inline in fixed container
    new KioskKeyboard().placeAt("kb-container-fixed");

    // 14. Inline with stableHeight
    new KioskKeyboard({ stableHeight: true }).placeAt("kb-stable-height");
  },
);
