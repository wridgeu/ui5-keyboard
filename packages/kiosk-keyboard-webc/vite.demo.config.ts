import { defineConfig } from "vite";
import path from "node:path";

const __dirname = import.meta.dirname;

// Build of the framework-less standalone demo page (test/pages/index.html) as a
// static, hostable site (consumed by the GitHub Pages deploy). This is an
// HTML-entry build and is intentionally separate from vite.config.ts, which is
// a *library* build of the web component bundle.
//
// `root` is the demo page's own folder so the built index.html lands at the
// output root (./index.html, not ./test/pages/index.html). `base: "./"` keeps
// asset URLs relative so the site works under the GitHub project-pages subpath.
export default defineConfig({
  root: path.resolve(__dirname, "test/pages"),
  base: "./",
  resolve: {
    // Single instance of the UI5 WC framework so setTheme() and the component
    // share one theme registry (mirrors vite.config.ts).
    dedupe: ["@ui5/webcomponents-base"],
  },
  build: {
    outDir: path.resolve(__dirname, "demo-dist"),
    emptyOutDir: true,
  },
});
