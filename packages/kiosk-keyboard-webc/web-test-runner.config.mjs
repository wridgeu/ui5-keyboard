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
  // Coverage is gated by the runner's own --coverage flag (test:coverage:component).
  coverageConfig: {
    include: ["src/**/*.ts"],
    exclude: ["src/generated/**", "src/bundle.esm.ts", "src/Assets.ts", "src/jsx.d.ts"],
    reportDir: "coverage/component",
    reporters: ["text", "lcov"],
  },
};
