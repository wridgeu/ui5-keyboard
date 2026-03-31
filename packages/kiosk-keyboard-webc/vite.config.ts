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
      // Only build the standalone bundle. Individual module files are
      // produced by tsc in build:dev and must remain as flat ESM so that
      // ui5-tooling-modules can process them (same pattern as @ui5/webcomponents).
      entry: path.resolve(__dirname, "src/bundle.esm.ts"),
      fileName: "kiosk-keyboard.bundle",
      formats: ["es"],
    },
    outDir: "dist",
    emptyOutDir: false,
    rolldownOptions: {
      output: {
        inlineDynamicImports: true,
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
