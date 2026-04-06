import os from "node:os";
import url from "node:url";
import path from "node:path";
import { createServerManager, readQUnitTestIds, generateQUnitSpecs } from "../../../../tools/wdio-server.js";
import { BASE_CHROME_ARGS, CHROME_VERSION, DESKTOP_WINDOW_SIZE } from "../../../../tools/wdio-device-profiles.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PORT = 8081;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");
const TESTSUITE_FILE = path.resolve(__dirname, "testsuite.qunit.ts");
const SPECS_DIR = path.resolve(__dirname, ".generated-specs");

const server = createServerManager(
  PORT,
  PACKAGE_ROOT,
  undefined,
  60_000,
  "/test-resources/ui5/hotkeys/qunit/testsuite.qunit.html",
);
const testIds = readQUnitTestIds(TESTSUITE_FILE);

const cpus = (os.availableParallelism?.() ?? os.cpus().length) || 4;
const safeParallel = Math.max(1, cpus - 1);
const parallel = Math.min(safeParallel, 4);

// Generate one spec file per QUnit test so WDIO can run them in parallel.
const specs = generateQUnitSpecs(
  testIds,
  SPECS_DIR,
  (name) =>
    `/test-resources/ui5/hotkeys/qunit/Test.qunit.html?testsuite=test-resources/ui5/hotkeys/qunit/testsuite.qunit&test=${name}`,
);

export const config: WebdriverIO.Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  specs,
  maxInstances: parallel,

  capabilities: [
    {
      browserName: "chrome",
      browserVersion: CHROME_VERSION,
      "goog:chromeOptions": {
        args: ["--headless=new", `--window-size=${DESKTOP_WINDOW_SIZE}`, ...BASE_CHROME_ARGS],
      },
    },
  ],

  logLevel: "warn",

  baseUrl: `http://localhost:${PORT}`,
  waitforTimeout: 180_000,

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 210_000,
  },

  reporters: ["spec"],

  // Keep the qunit service (no paths) so it registers browser.getQUnitResults().
  services: [["qunit", {}]],

  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
