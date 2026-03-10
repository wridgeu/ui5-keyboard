import { defineConfig } from "vitest/config";
import path from "node:path";

const __dirname = import.meta.dirname;

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "dist/bundle.esm.js"),
      formats: ["es"],
      fileName: "kiosk-keyboard.bundle",
    },
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
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
