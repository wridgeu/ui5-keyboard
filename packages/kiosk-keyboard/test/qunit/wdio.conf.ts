import os from "node:os";
import url from "node:url";
import path from "node:path";
import { createServerManager, readQUnitTestIds, generateQUnitSpecs } from "../../../../tools/wdio-server.js";
import { CHROME_VERSION, DESKTOP_WINDOW_SIZE } from "../../../../tools/wdio-device-profiles.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PORT = 8082;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");
const TESTSUITE_FILE = path.resolve(__dirname, "testsuite.qunit.ts");
const SPECS_DIR = path.resolve(__dirname, ".generated-specs");

const server = createServerManager(
  PORT,
  PACKAGE_ROOT,
  undefined,
  60_000,
  "/test-resources/ui5/kiosk/qunit/testsuite.qunit.html",
);
const testIds = readQUnitTestIds(TESTSUITE_FILE);

const cpus = (os.availableParallelism?.() ?? os.cpus().length) || 4;
const requestedParallel = Number(process.env.KIOSK_QUNIT_MAX_INSTANCES ?? "");
// Leave one CPU free for Chrome/UI5 server overhead and cap the suite below the
// flakier 5-worker setting that occasionally timed out on Windows.
const safeParallel = Math.max(1, cpus - 1);
const parallel =
  Number.isFinite(requestedParallel) && requestedParallel > 0
    ? Math.min(Math.floor(requestedParallel), safeParallel)
    : Math.min(safeParallel, 4);

// Generate one spec file per QUnit test so WDIO can run them in parallel.
const specs = generateQUnitSpecs(
  testIds,
  SPECS_DIR,
  (name) =>
    `/test-resources/ui5/kiosk/qunit/Test.qunit.html?testsuite=test-resources/ui5/kiosk/qunit/testsuite.qunit&test=${name}`,
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
        args: ["--headless=new", `--window-size=${DESKTOP_WINDOW_SIZE}`, "--disable-gpu", "--no-sandbox"],
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
