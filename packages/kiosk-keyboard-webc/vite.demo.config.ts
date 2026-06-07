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
    // The component registers its built-in layouts via side-effect-only
    // imports (e.g. `import "./layouts/qwerty.js"` in KioskKeyboard.ts; each
    // layout module self-registers into the shared registry). This build
    // consumes the package from `src/`, which the package.json `sideEffects`
    // allowlist does not cover (it lists only `./dist/...`), so the bundler
    // classifies those `src/layouts/*` modules as side-effect-free and drops
    // them -- every keyboard then throws "Built-in default layout 'qwerty' is
    // missing" and renders an empty shadow root.
    //
    // `treeshake: false` is the documented Rollup/Rolldown switch to disable
    // tree-shaking ("produces bigger bundles"). Note `{ moduleSideEffects:
    // true }` does NOT fix this: the boolean form defers to the package.json
    // `sideEffects` allowlist, so the src layouts stay excluded. The ~15 KB
    // size cost is irrelevant for a demo that already bundles all layouts/i18n.
    // (Dev `npm start` is unaffected -- Vite's dev server does not tree-shake.)
    rollupOptions: {
      treeshake: false,
    },
  },
});
