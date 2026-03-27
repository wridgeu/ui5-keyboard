// Import the source ESM entry so Vite transpiles TS on the fly and
// deduplicates the UI5 WC framework. No tsc pre-build needed.
import "../../src/bundle.esm.ts";

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
    { value: "label-only", label: "Label" },
    { value: "blank", icon: "", label: "" },
    { value: "value-fallback" },
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

customElements.whenDefined("kiosk-keyboard").then(() => {
  const KK = customElements.get("kiosk-keyboard");
  KK.registerLayout("glyph-stress", glyphStressLayout);
  KK.registerLayout("icon-label-variations", iconLabelVariationsLayout);
});
