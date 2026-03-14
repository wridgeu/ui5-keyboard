// Import the source ESM entry so Vite transpiles TS on the fly and
// deduplicates the UI5 WC framework. No tsc pre-build needed.
import "../../src/bundle.esm.ts";
import { setTheme } from "@ui5/webcomponents-base/dist/config/Theme.js";

// Expose setTheme globally so e2e tests can call it via browser.execute()
window.__setTheme = setTheme;
