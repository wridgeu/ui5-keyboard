import { defineConfig } from "vitest/config";
import url from "node:url";
import path from "node:path";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

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
  },
});
