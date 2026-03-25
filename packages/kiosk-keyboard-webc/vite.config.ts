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
      entry: path.resolve(__dirname, "src/bundle.esm.ts"),
      formats: ["es"],
      fileName: "kiosk-keyboard.bundle",
    },
    outDir: "dist",
    emptyOutDir: false,
    rolldownOptions: {
      output: {
        codeSplitting: false,
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
