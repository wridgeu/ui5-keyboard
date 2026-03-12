// Uses the unbundled ESM entry so Vite deduplicates the UI5 WC framework,
// allowing setTheme() to affect the component. Requires `npm run build` first.
// See test/pages/README.md for details on why this is needed.
import "../../dist/bundle.esm.js";
import { setTheme } from "@ui5/webcomponents-base/dist/config/Theme.js";

// Expose setTheme globally so e2e tests can call it via browser.execute()
window.__setTheme = setTheme;
