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

customElements.whenDefined("kiosk-keyboard").then(() => {
  customElements.get("kiosk-keyboard").registerLayout("glyph-stress", glyphStressLayout);
});
