// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(["ui5/kiosk/KioskKeyboard", "sap/m/Input"], function (KioskKeyboard, Input) {
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

  // 10. Shift / CapsLock state
  var shiftInput = new Input({ value: "Test shift", width: "300px" });
  shiftInput.placeAt("input-shift");
  var kbShift = new KioskKeyboard({ targetInput: shiftInput });
  kbShift.placeAt("kb-shift");

  // 11. Special characters layout
  var kbSpecial = new KioskKeyboard({ layout: "special" });
  kbSpecial.placeAt("kb-special");

  // 12. Inline in fixed container
  new KioskKeyboard().placeAt("kb-container-fixed");

  // 13. Inline with stableHeight
  new KioskKeyboard({ stableHeight: true }).placeAt("kb-stable-height");

  // 14. Function Keys (F1-F12)
  new KioskKeyboard({ layout: "fkeys" }).placeAt("kb-fkeys");

  // 15. Navigation Keys
  new KioskKeyboard({ layout: "nav" }).placeAt("kb-nav");

  // 16. QWERTY with F-Key Row
  new KioskKeyboard({ layout: "qwerty-fk" }).placeAt("kb-qwerty-fk");

  // 17. QWERTZ-DE with F-Key Row
  new KioskKeyboard({ layout: "qwertz-de-fk" }).placeAt("kb-qwertz-de-fk");

  // 18. QWERTY with Nav Row
  new KioskKeyboard({ layout: "qwerty-nav" }).placeAt("kb-qwerty-nav");

  // 19. QWERTZ-DE with Nav Row
  new KioskKeyboard({ layout: "qwertz-de-nav" }).placeAt("kb-qwertz-de-nav");

  // 20. Glyph stress layout
  new KioskKeyboard({ layout: "glyph-stress" }).placeAt("kb-glyph-stress");

  // 21. Height-constrained container
  new KioskKeyboard().placeAt("kb-height-constrained");

  // 22. Severely height-constrained container
  new KioskKeyboard().placeAt("kb-height-tiny");

  // 23. Ancestor-constrained (flex parent 400x250)
  new KioskKeyboard().placeAt("kb-ancestor-constrained-wrap");

  // 24. Ancestor-constrained severely (flex parent 400x180)
  new KioskKeyboard().placeAt("kb-ancestor-tiny-wrap");

  // 25. Narrow + height-constrained (320x250)
  new KioskKeyboard().placeAt("kb-narrow-short");

  // 26. Viewport-width height-constrained (250px)
  new KioskKeyboard().placeAt("kb-vw-height-short");

  // 27. Viewport-width severely height-constrained (180px)
  new KioskKeyboard().placeAt("kb-vw-height-tiny");
});
