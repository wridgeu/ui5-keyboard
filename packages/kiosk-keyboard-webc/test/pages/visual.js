// Import the source ESM entry so Vite transpiles TS on the fly and
// deduplicates the UI5 WC framework. No tsc pre-build needed.
import "../../src/bundle.esm.ts";
import navRow from "../../src/layouts/nav-row.ts";
import navRowCompact from "../../src/layouts/nav-row-compact.ts";
import fkeyRow from "../../src/layouts/fkey-row.ts";
import fkeyRowCompact from "../../src/layouts/fkey-row-compact.ts";

// Glyph stress layout: exercises single-glyph rendering with characters
// that push vertical metrics, horizontal width, and text-box-trim edges.
//
// Row 1: Wide ASCII glyphs (horizontal stress)
// Row 2: Descenders + diacritics (vertical stress, text-box-trim cap/alphabetic)
// Row 3: Unicode symbols (grapheme segmentation, font coverage, width)
const glyphStressLayout = [
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

// Icon + label variation layout: exercises all rendering modes in one keyboard.
// Row 1: SAP icon + label (dual), SAP icon only, label only, blank
// Row 2: Unicode icons + labels, emoji icons
// Row 3: Built-in special keys (shift/enter/backspace/space) for comparison
const iconLabelVariationsLayout = [
  [
    { value: "sap-dual", icon: "sap-icon://home", label: "Home" },
    { value: "sap-custom", icon: "sap-icon://settings", label: "Settings" },
    { value: "sap-icon-only", icon: "sap-icon://delete", label: "" },
    { value: "{layout:numeric}", label: "123", type: "modifier" },
    { value: "blank", icon: "", label: "" },
    { value: "a" },
  ],
  [
    { value: "unicode-shift", icon: "\u21E7", label: "Shift" },
    { value: "unicode-enter", icon: "\u23CE", label: "Enter" },
    { value: "unicode-back", icon: "\u232B", label: "Delete" },
    { value: "emoji-search", icon: "\uD83D\uDD0D", label: "Search" },
    { value: "emoji-globe", icon: "\uD83C\uDF10", label: "Lang" },
    { value: "emoji-only", icon: "\u2328\uFE0F", label: "" },
  ],
  [
    { value: "{shift}", type: "modifier", width: "2.25" },
    { value: "{enter}", type: "action", width: "2.25" },
    { value: "{backspace}", type: "action", width: "2" },
    { value: " ", type: "space", width: "space" },
  ],
];

// Indic glyph stress layout: exercises Indic script detection and
// font-family / text-box-edge overrides across all 10 supported scripts.
const indicStressLayout = [
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

// Declare the visual stress layouts as custom layouts on every kiosk-keyboard
// rendered on the page. Pages are mounted before this script runs in the
// bundle.esm.ts entry, so simply iterate the existing elements. Each host needs
// its own child elements: a DOM node lives in one parent only.
customElements.whenDefined("kiosk-keyboard").then(() => {
  const qwerty = customElements.get("kiosk-keyboard").getRegisteredLayout("qwerty");
  const layouts = {
    "glyph-stress": glyphStressLayout,
    "icon-label-variations": iconLabelVariationsLayout,
    "indic-stress": indicStressLayout,
    // The two composition forms of the shared nav row, side by side: one 8-key
    // row, and the 2x4 arrangement for keyboards too narrow to seat it.
    "qwerty-nav": [navRow, ...qwerty],
    "qwerty-nav-compact": [...navRowCompact, ...qwerty],
    // The same two composition forms for the function-key row.
    "qwerty-fk": [fkeyRow, ...qwerty],
    "qwerty-fk-compact": [...fkeyRowCompact, ...qwerty],
  };
  document.querySelectorAll("kiosk-keyboard").forEach((kb) => {
    for (const [name, rows] of Object.entries(layouts)) {
      const customLayout = document.createElement("kiosk-keyboard-custom-layout");
      customLayout.slot = "customLayouts";
      customLayout.name = name;
      customLayout.rows = rows;
      kb.appendChild(customLayout);
    }
  });
});
