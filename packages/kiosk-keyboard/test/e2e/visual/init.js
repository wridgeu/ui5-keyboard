// Plain JS: not processed by ui5-tooling-transpile (test files outside src/)
sap.ui.define(
  [
    "ui5/kiosk/KioskKeyboard",
    "sap/m/Input",
    "ui5/kiosk/layouts/nav-row",
    "ui5/kiosk/layouts/nav-row-compact",
    "ui5/kiosk/layouts/fkey-row",
    "ui5/kiosk/layouts/fkey-row-compact",
  ],
  function (KioskKeyboard, Input, navRow, navRowCompact, fkeyRow, fkeyRowCompact) {
    "use strict";

    // Glyph stress layout: exercises single-glyph rendering with characters
    // that push vertical metrics, horizontal width, and text-box-trim edges.
    //
    // Row 1: Wide ASCII glyphs (horizontal stress)
    // Row 2: Descenders + diacritics (vertical stress, text-box-trim cap/alphabetic)
    // Row 3: Unicode symbols (grapheme segmentation, font coverage, width)
    var glyphStress = [
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
    ];

    // 1. Default QWERTY
    new KioskKeyboard().placeAt("kb-qwerty");

    // 1b. Accent variants: the corner hint marks keys with a long-press popup.
    new KioskKeyboard({ accentVariants: true }).placeAt("kb-accent-variants");

    // 2. With Input Target
    var input = new Input({ value: "Hello World", width: "300px" });
    input.placeAt("input-area");
    var kbInput = new KioskKeyboard({ controls: [input.getId()] });
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
    var kbShift = new KioskKeyboard({ controls: [shiftInput.getId()] });
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

    // 14b. QWERTY + Nav Row (combined): the single 8-key nav row
    var qwertyLayout = KioskKeyboard.getRegisteredLayout("qwerty");
    new KioskKeyboard({
      layout: "qwerty-nav",
      customLayouts: [{ name: "qwerty-nav", rows: [navRow, ...qwertyLayout] }],
    }).placeAt("kb-qwerty-nav");

    // 14c. QWERTY + Compact Nav Rows: the 2x4 form for narrow keyboards
    new KioskKeyboard({
      layout: "qwerty-nav-compact",
      customLayouts: [{ name: "qwerty-nav-compact", rows: [...navRowCompact, ...qwertyLayout] }],
    }).placeAt("kb-qwerty-nav-compact");

    // 14d/14e. QWERTY + F-key row: the single 12-key row and the 2x6 form
    new KioskKeyboard({
      layout: "qwerty-fk",
      customLayouts: [{ name: "qwerty-fk", rows: [fkeyRow, ...qwertyLayout] }],
    }).placeAt("kb-qwerty-fk");

    new KioskKeyboard({
      layout: "qwerty-fk-compact",
      customLayouts: [{ name: "qwerty-fk-compact", rows: [...fkeyRowCompact, ...qwertyLayout] }],
    }).placeAt("kb-qwerty-fk-compact");

    // 15. Glyph stress layout
    new KioskKeyboard({
      layout: "glyph-stress",
      customLayouts: [{ name: "glyph-stress", rows: glyphStress }],
    }).placeAt("kb-glyph-stress");

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

    // 27. Flex parent auto-detect (no CSS on keyboard)
    new KioskKeyboard().placeAt("kb-flex-auto-wrap");

    // 28. Grid parent auto-detect (no CSS on keyboard)
    new KioskKeyboard().placeAt("kb-grid-auto-wrap");

    // 29. Unconstrained (regression guard)
    new KioskKeyboard().placeAt("kb-unconstrained");

    // 30. Japanese Romaji
    new KioskKeyboard({ layout: "ja-romaji" }).placeAt("kb-ja-romaji");

    // 31. Arabic
    new KioskKeyboard({ layout: "arabic" }).placeAt("kb-arabic");

    // 32. Japanese Kana
    new KioskKeyboard({ layout: "ja-kana" }).placeAt("kb-ja-kana");

    // 33. Korean Hangul
    new KioskKeyboard({ layout: "ko-hangul" }).placeAt("kb-ko-hangul");

    // 34. Indic glyph stress layout: exercises Indic script detection and
    // font-family / text-box-edge overrides across all 10 supported scripts.
    var indicStress = [
      [
        { value: "\u0905" }, // अ Devanagari
        { value: "\u0915" }, // क
        { value: "\u0928" }, // न
        { value: "\u0939" }, // ह
        { value: "\u0964" }, // । danda
        { value: "\u0985" }, // অ Bengali
        { value: "\u0995" }, // ক
        { value: "\u09B9" }, // হ
      ],
      [
        { value: "\u0A05" }, // ਅ Gurmukhi
        { value: "\u0A85" }, // અ Gujarati
        { value: "\u0B05" }, // ଅ Oriya
        { value: "\u0B85" }, // அ Tamil
        { value: "\u0C05" }, // అ Telugu
        { value: "\u0C85" }, // ಅ Kannada
        { value: "\u0D05" }, // അ Malayalam
        { value: "\u0D85" }, // අ Sinhala
      ],
    ];
    new KioskKeyboard({
      layout: "indic-stress",
      customLayouts: [{ name: "indic-stress", rows: indicStress }],
    }).placeAt("kb-indic-stress");

    // 35. Spanish (QWERTY-ES)
    new KioskKeyboard({ layout: "qwerty-es" }).placeAt("kb-qwerty-es");
  },
);
