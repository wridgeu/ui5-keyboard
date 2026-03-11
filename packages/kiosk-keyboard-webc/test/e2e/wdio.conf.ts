import url from "node:url";
import path from "node:path";
import { createViteServerManager } from "../../../../tools/wdio-server.js";
import { CHROME_VERSION, DESKTOP_WINDOW_SIZE } from "../../../../tools/wdio-device-profiles.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PORT = 8086;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

const server = createViteServerManager(PORT, PACKAGE_ROOT);

const headless = !process.env.HEADED && !process.argv.includes("--headed");
const updateVisualBaseline = process.argv.includes("--update-visual-baseline");
const chromeArgs = [`--window-size=${DESKTOP_WINDOW_SIZE}`, "--disable-gpu", "--no-sandbox"];
if (headless) chromeArgs.unshift("--headless=new");

export const config: WebdriverIO.Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  specs: [path.resolve(__dirname, "**/*.test.ts")],

  maxInstances: 3,

  capabilities: [
    {
      browserName: "chrome",
      browserVersion: CHROME_VERSION,
      "goog:chromeOptions": {
        args: chromeArgs,
      },
    },
  ],

  logLevel: "warn",

  baseUrl: `http://localhost:${PORT}`,

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 60_000,
  },

  reporters: ["spec"],

  services: [
    [
      "visual",
      {
        baselineFolder: path.resolve(__dirname, "__baselines__"),
        formatImageName: "{tag}-{logName}-{width}x{height}",
        screenshotPath: path.resolve(__dirname, "__screenshots__"),
        autoSaveBaseline: updateVisualBaseline,
        disableCSSAnimation: true,
        hideScrollBars: true,
        waitForFontsLoaded: true,
      },
    ],
  ],

  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
