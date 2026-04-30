// Import the source ESM entry so Vite transpiles TS on the fly and
// deduplicates the UI5 WC framework. No tsc pre-build needed.
import { KioskKeyboard } from "../../src/bundle.esm.ts";
import { setTheme } from "@ui5/webcomponents-base/dist/config/Theme.js";

const THEME_BACKGROUNDS = {
  sap_horizon: "#fff",
  sap_horizon_dark: "#1a1d21",
  sap_horizon_hcb: "#000",
  sap_horizon_hcw: "#fff",
};

// Theme switcher
document.querySelectorAll(".theme-controls button").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const theme = btn.dataset.theme;
    await setTheme(theme);
    document.body.style.background = THEME_BACKGROUNDS[theme];
    document.querySelectorAll(".preview").forEach((p) => {
      p.style.background = THEME_BACKGROUNDS[theme];
    });
    document.querySelectorAll(".theme-controls button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    // Update label colors for dark themes
    const isDark = theme === "sap_horizon_dark" || theme === "sap_horizon_hcb";
    document.querySelectorAll(".demo-item label").forEach((l) => {
      l.style.color = isDark ? "#aaa" : "#666";
    });
  });
});

// Apply demo layouts as per-instance overrides on every kiosk-keyboard on the page.
const demoLayouts = {
  "demo-default": [[{ value: "F5", label: "F5" }]],
  "demo-modifier": [[{ value: "F5", label: "F5", type: "modifier" }]],
};
document.querySelectorAll("kiosk-keyboard").forEach((kb) => {
  kb.instanceLayouts = demoLayouts;
});
