// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(
  ["ui5/kiosk/KioskKeyboard", "sap/m/Input", "sap/m/Button", "sap/m/Popover", "sap/m/VBox"],
  function (KioskKeyboard, Input, Button, Popover, VBox) {
    "use strict";

    KioskKeyboard.registerLayout("glyph-stress", [
      [
        { value: "@" },
        { value: "%" },
        { value: "&" },
        { value: '"' },
        { value: "#" },
        { value: "+" },
        { value: "=" },
        { value: "?" },
      ],
    ]);

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

    // 15. Function Keys (F1-F12)
    new KioskKeyboard({ layout: "fkeys" }).placeAt("kb-fkeys");

    // 16. Navigation Keys
    new KioskKeyboard({ layout: "nav" }).placeAt("kb-nav");

    // 17. QWERTY with F-Key Row
    new KioskKeyboard({ layout: "qwerty-fk" }).placeAt("kb-qwerty-fk");

    // 18. QWERTZ-DE with F-Key Row
    new KioskKeyboard({ layout: "qwertz-de-fk" }).placeAt("kb-qwertz-de-fk");

    // 19. QWERTY with Nav Row
    new KioskKeyboard({ layout: "qwerty-nav" }).placeAt("kb-qwerty-nav");

    // 20. QWERTZ-DE with Nav Row
    new KioskKeyboard({ layout: "qwertz-de-nav" }).placeAt("kb-qwertz-de-nav");

    // 21. Glyph stress layout
    new KioskKeyboard({ layout: "glyph-stress" }).placeAt("kb-glyph-stress");

    // 22. Height-constrained container
    new KioskKeyboard().placeAt("kb-height-constrained");

    // 23. Severely height-constrained container
    new KioskKeyboard().placeAt("kb-height-tiny");
  },
);
