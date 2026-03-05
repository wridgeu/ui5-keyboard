import { playwrightLauncher } from "@web/test-runner-playwright";
import { esbuildPlugin } from "@web/dev-server-esbuild";

export default {
  files: "test/component/**/*.test.ts",
  nodeResolve: true,
  browsers: [playwrightLauncher({ product: "chromium" })],
  plugins: [
    esbuildPlugin({
      ts: true,
      tsx: true,
      tsconfig: "./tsconfig.json",
    }),
  ],
};
