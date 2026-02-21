import url from "node:url";
import path from "node:path";
import { createServerManager } from "../../../../tools/wdio-server.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PORT = 8082;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

const server = createServerManager(PORT, PACKAGE_ROOT);

const headless = !process.env.HEADED && !process.argv.includes("--headed");
const chromeArgs = ["--window-size=1440,900", "--disable-gpu", "--no-sandbox"];
if (headless) chromeArgs.unshift("--headless=new");

export const config: WebdriverIO.Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  specs: [path.resolve(__dirname, "**/*.test.ts")],

  maxInstances: 1,

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
    timeout: 60_000,
  },

  reporters: ["spec"],

  services: [
    "ui5",
    [
      "visual",
      {
        baselineFolder: path.resolve(__dirname, "__baselines__"),
        formatImageName: "{tag}-{logName}-{width}x{height}",
        screenshotPath: path.resolve(__dirname, "__screenshots__"),
        autoSaveBaseline: !process.env.CI,
        disableCSSAnimation: true,
        hideScrollBars: true,
        waitForFontsLoaded: true,
      },
    ],
  ],

  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
