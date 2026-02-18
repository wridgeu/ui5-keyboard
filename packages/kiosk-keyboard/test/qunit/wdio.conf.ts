import url from "node:url";
import path from "node:path";
import { createServerManager } from "../../../../tools/wdio-server.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PORT = 8082;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

const server = createServerManager(PORT, PACKAGE_ROOT);

export const config: WebdriverIO.Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  maxInstances: 1,

  capabilities: [
    {
      browserName: "chrome",
      "goog:chromeOptions": {
        args: ["--headless=new", "--window-size=1440,900", "--disable-gpu", "--no-sandbox"],
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
        paths: [
          "/test-resources/ui5/kiosk/qunit/Test.qunit.html?testsuite=test-resources/ui5/kiosk/qunit/testsuite.qunit&test=KioskKeyboard",
        ],
      },
    ],
  ],

  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
