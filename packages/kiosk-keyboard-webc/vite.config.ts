import { defineConfig } from "vitest/config";
import path from "node:path";

const __dirname = import.meta.dirname;

export default defineConfig({
  resolve: {
    // Ensure a single instance of the UI5 WC framework modules so that
    // setTheme() and the component share the same theme registry.
    dedupe: ["@ui5/webcomponents-base"],
    tsconfigPaths: true,
  },
  server: {
    watch: {
      // Exclude generated/output directories from file watching so that
      // prior coverage or visual regression runs do not trigger Vite
      // page reloads during e2e tests.
      ignored: ["**/coverage/**", "**/__screenshots__/**", "**/dist/**"],
    },
  },
  build: {
    lib: {
      entry: {
        KioskKeyboard: path.resolve(__dirname, "src/KioskKeyboard.ts"),
        KioskKeyboardCore: path.resolve(__dirname, "src/KioskKeyboardCore.ts"),
        "layouts/qwerty": path.resolve(__dirname, "src/layouts/qwerty.ts"),
        "layouts/qwertz-de": path.resolve(__dirname, "src/layouts/qwertz-de.ts"),
        "layouts/numeric": path.resolve(__dirname, "src/layouts/numeric.ts"),
        "layouts/special": path.resolve(__dirname, "src/layouts/special.ts"),
        "layouts/numpad": path.resolve(__dirname, "src/layouts/numpad.ts"),
        "layouts/fkeys": path.resolve(__dirname, "src/layouts/fkeys.ts"),
        "layouts/nav": path.resolve(__dirname, "src/layouts/nav.ts"),
        "layouts/qwerty-fk": path.resolve(__dirname, "src/layouts/qwerty-fk.ts"),
        "layouts/qwertz-de-fk": path.resolve(__dirname, "src/layouts/qwertz-de-fk.ts"),
        "layouts/qwerty-nav": path.resolve(__dirname, "src/layouts/qwerty-nav.ts"),
        "layouts/qwertz-de-nav": path.resolve(__dirname, "src/layouts/qwertz-de-nav.ts"),
        "layouts/ja-romaji": path.resolve(__dirname, "src/layouts/ja-romaji.ts"),
        "layouts/ja-kana": path.resolve(__dirname, "src/layouts/ja-kana.ts"),
        "layouts/arabic": path.resolve(__dirname, "src/layouts/arabic.ts"),
        "layouts/fkey-row": path.resolve(__dirname, "src/layouts/fkey-row.ts"),
        "layouts/nav-row": path.resolve(__dirname, "src/layouts/nav-row.ts"),
        "middleware/kana-dakuten": path.resolve(__dirname, "src/middleware/kana-dakuten.ts"),
        "bundle.esm": path.resolve(__dirname, "src/bundle.esm.ts"),
      },
      formats: ["es"],
    },
    outDir: "dist",
    emptyOutDir: false,
    rolldownOptions: {
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
  test: {
    include: ["test/unit/**/*.test.ts"],
    environment: "jsdom",
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      exclude: ["src/generated/**"],
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage/unit",
    },
  },
});
