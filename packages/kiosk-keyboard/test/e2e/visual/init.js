// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(["ui5/kiosk/KioskKeyboard", "sap/m/Input"], function (KioskKeyboard, Input) {
  "use strict";

  // Glyph stress layout: exercises single-glyph rendering with characters
  // that push vertical metrics, horizontal width, and text-box-trim edges.
  //
  // Row 1: Wide ASCII glyphs (horizontal stress)
  // Row 2: Descenders + diacritics (vertical stress, text-box-trim cap/alphabetic)
  // Row 3: Unicode symbols (grapheme segmentation, font coverage, width)
  KioskKeyboard.registerLayout("glyph-stress", [
    [
      { value: "@" },
      { value: "%" },
      { value: "&" },
      { value: "W" },
      { value: "M" },
      { value: "#" },
      { value: "$" },
      { value: "~" },
    ],
    [
      { value: "Q" },
      { value: "g" },
      { value: "j" },
      { value: "Ä" },
      { value: "Ö" },
      { value: "ñ" },
      { value: "ç" },
      { value: "^" },
    ],
    [
      { value: "€" },
      { value: "£" },
      { value: "→" },
      { value: "←" },
      { value: "µ" },
      { value: "°" },
      { value: "§" },
      { value: "¿" },
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

  // 13. Function Keys (F1-F12)
  new KioskKeyboard({ layout: "fkeys" }).placeAt("kb-fkeys");

  // 14. Navigation Keys
  new KioskKeyboard({ layout: "nav" }).placeAt("kb-nav");

  // 15. QWERTY with F-Key Row
  new KioskKeyboard({ layout: "qwerty-fk" }).placeAt("kb-qwerty-fk");

  // 16. QWERTZ-DE with F-Key Row
  new KioskKeyboard({ layout: "qwertz-de-fk" }).placeAt("kb-qwertz-de-fk");

  // 17. QWERTY with Nav Row
  new KioskKeyboard({ layout: "qwerty-nav" }).placeAt("kb-qwerty-nav");

  // 18. QWERTZ-DE with Nav Row
  new KioskKeyboard({ layout: "qwertz-de-nav" }).placeAt("kb-qwertz-de-nav");

  // 19. Glyph stress layout
  new KioskKeyboard({ layout: "glyph-stress" }).placeAt("kb-glyph-stress");

  // 20. Height-constrained container
  new KioskKeyboard().placeAt("kb-height-constrained");

  // 21. Severely height-constrained container
  new KioskKeyboard().placeAt("kb-height-tiny");

  // 22. Ancestor-constrained (flex parent 400x250)
  new KioskKeyboard().placeAt("kb-ancestor-constrained-wrap");

  // 23. Ancestor-constrained severely (flex parent 400x180)
  new KioskKeyboard().placeAt("kb-ancestor-tiny-wrap");

  // 24. Narrow + height-constrained (320x250)
  new KioskKeyboard().placeAt("kb-narrow-short");

  // 25. Viewport-width height-constrained (250px)
  new KioskKeyboard().placeAt("kb-vw-height-short");

  // 26. Viewport-width severely height-constrained (180px)
  new KioskKeyboard().placeAt("kb-vw-height-tiny");
});
