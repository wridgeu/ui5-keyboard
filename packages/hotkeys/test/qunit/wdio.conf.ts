import url from "node:url";
import path from "node:path";
import { createServerManager, readQUnitTestIds } from "../../../../tools/wdio-server.js";
import { BASE_CHROME_ARGS, CHROME_VERSION, DESKTOP_WINDOW_SIZE } from "../../../../tools/wdio-device-profiles.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PORT = 8081;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");
const TESTSUITE_FILE = path.resolve(__dirname, "testsuite.qunit.ts");

const server = createServerManager(
  PORT,
  PACKAGE_ROOT,
  undefined,
  60_000,
  "/test-resources/ui5/hotkeys/qunit/testsuite.qunit.html",
);
const testIds = readQUnitTestIds(TESTSUITE_FILE);

export const config: WebdriverIO.Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  maxInstances: 1,
  maxInstancesPerCapability: 1,

  capabilities: [
    {
      browserName: "chrome",
      browserVersion: CHROME_VERSION,
      maxInstances: 1,
      "goog:chromeOptions": {
        args: ["--headless=new", `--window-size=${DESKTOP_WINDOW_SIZE}`, ...BASE_CHROME_ARGS],
      },
    },
  ],

  logLevel: "warn",

  baseUrl: `http://localhost:${PORT}`,
  waitforTimeout: 90_000,

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 120_000,
  },

  reporters: ["spec"],

  services: [
    [
      "qunit",
      {
        paths: testIds.map(
          (name) =>
            `/test-resources/ui5/hotkeys/qunit/Test.qunit.html?testsuite=test-resources/ui5/hotkeys/qunit/testsuite.qunit&test=${name}`,
        ),
      },
    ],
  ],

  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
