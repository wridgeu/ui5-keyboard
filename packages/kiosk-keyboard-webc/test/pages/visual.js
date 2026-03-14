// Import the source ESM entry so Vite transpiles TS on the fly and
// deduplicates the UI5 WC framework. No tsc pre-build needed.
import "../../src/bundle.esm.ts";

const glyphStressLayout = [
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
];

customElements.whenDefined("kiosk-keyboard").then(() => {
  customElements.get("kiosk-keyboard").registerLayout("glyph-stress", glyphStressLayout);
});
