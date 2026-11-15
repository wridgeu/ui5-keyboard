import { playwrightLauncher } from "@web/test-runner-playwright";
import { esbuildPlugin } from "@web/dev-server-esbuild";
import generateSources from "./generate-sources.mjs";

export default {
  files: "test/component/**/*.test.ts",
  nodeResolve: true,
  browsers: [playwrightLauncher({ product: "chromium" })],
  // Module scripts run in document order, so the helper patches chai before any test file loads.
  testRunnerHtml: (testFramework) =>
    `<!DOCTYPE html><html><head></head><body><script type="module" src="/test/helpers/clone-safe-assertion-errors.ts"></script><script type="module" src="${testFramework}"></script></body></html>`,
  plugins: [
    // The runner awaits serverStart before it launches a browser.
    { name: "generate-sources", serverStart: generateSources },
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
