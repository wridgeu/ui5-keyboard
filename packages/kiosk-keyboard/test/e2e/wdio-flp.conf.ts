import url from "node:url";
import path from "node:path";
import type { wdi5Config } from "wdio-ui5-service";
import { createServerManager } from "../../../../tools/wdio-server.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PORT = 8083;
const PACKAGE_ROOT = path.resolve(__dirname, "../../../../packages/demo-app");

// SAPUI5 framework packages may need to download on first run → longer timeout
const server = createServerManager(PORT, PACKAGE_ROOT, "ui5-flp.yaml", 120_000);

const headless = !process.env.HEADED && !process.argv.includes("--headed");
const chromeArgs = ["--window-size=1440,900", "--disable-gpu", "--no-sandbox"];
if (headless) chromeArgs.unshift("--headless=new");

export const config: wdi5Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  specs: [path.resolve(__dirname, "flp-lifecycle.test.ts")],

  maxInstances: 1,
  maxInstancesPerCapability: 1,

  capabilities: [
    {
      browserName: "chrome",
      "goog:chromeOptions": {
        args: chromeArgs,
      },
    },
  ],

  logLevel: "warn",

  baseUrl: `http://localhost:${PORT}`,

  wdi5: {
    skipInjectUI5OnStart: true,
    waitForUI5Timeout: 20_000,
  },

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 120_000,
  },

  reporters: ["spec"],

  services: ["ui5"],

  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
