import { playwrightLauncher } from "@web/test-runner-playwright";
import { esbuildPlugin } from "@web/dev-server-esbuild";

// Needs `(pointer: coarse)` to match, which the default context cannot give it.
const COARSE_POINTER_FILE = "test/component/mobile-keyboard-coarse.test.ts";

export default {
  files: ["test/component/**/*.test.ts", `!${COARSE_POINTER_FILE}`],
  nodeResolve: true,
  browsers: [playwrightLauncher({ product: "chromium" })],
  groups: [
    {
      name: "coarse-pointer",
      files: COARSE_POINTER_FILE,
      browsers: [
        playwrightLauncher({
          product: "chromium",
          createBrowserContext: ({ browser }) => browser.newContext({ hasTouch: true }),
        }),
      ],
    },
  ],
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
