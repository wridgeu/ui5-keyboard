import { playwrightLauncher } from "@web/test-runner-playwright";
import { esbuildPlugin } from "@web/dev-server-esbuild";

const coverage = process.argv.includes("--coverage");

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
  coverageConfig: {
    include: ["src/**/*.ts"],
    exclude: ["src/generated/**", "src/bundle.esm.ts", "src/Assets.ts", "src/jsx.d.ts"],
    report: coverage,
    reportDir: "coverage/component",
    reporters: ["text", "lcov"],
  },
};
