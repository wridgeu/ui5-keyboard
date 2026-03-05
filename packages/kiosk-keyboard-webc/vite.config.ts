import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "dist/bundle.esm.js"),
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
    globals: true,
    environment: "jsdom",
  },
});
