import path from "node:path";
import { createViteServerManager } from "../../../../tools/wdio-server.js";
import {
  BASE_CHROME_ARGS,
  CHROME_VERSION,
  DESKTOP_WINDOW_SIZE,
  resolveCachedBinaries,
  buildChromedriverOptions,
  ensureBrowsersDownloaded,
  cleanScreenshots,
} from "../../../../tools/wdio-device-profiles.js";

const __dirname = import.meta.dirname;
const PORT = 8086;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

const server = createViteServerManager(PORT, PACKAGE_ROOT, 60_000, "/test/pages/index.html");

const headless = !process.env.HEADED && !process.argv.includes("--headed");
const updateVisualBaseline = process.argv.includes("--update-visual-baseline");
const chromeArgs = [`--window-size=${DESKTOP_WINDOW_SIZE}`, ...BASE_CHROME_ARGS];
if (headless) chromeArgs.unshift("--headless=new");

const cachedBinaries = resolveCachedBinaries();
const chromedriverOpts = buildChromedriverOptions();

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
        ...(cachedBinaries.chrome ? { binary: cachedBinaries.chrome } : {}),
      },
      ...(chromedriverOpts ? { "wdio:chromedriverOptions": chromedriverOpts } : {}),
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
        formatImageName: "{tag}",
        screenshotPath: path.resolve(__dirname, "__screenshots__"),
        autoSaveBaseline: updateVisualBaseline,
        disableCSSAnimation: true,
        hideScrollBars: true,
        waitForFontsLoaded: true,
        compareOptions: {
          createJsonReportFiles: true,
        },
      },
    ],
  ],

  onPrepare: async () => {
    await ensureBrowsersDownloaded();
    cleanScreenshots(path.resolve(__dirname, "__screenshots__"));
    await server.onPrepare();
  },
  onWorkerStart: () => server.ensureRunning(),
  beforeSuite: () => server.ensureRunning(),
  onComplete: () => server.onComplete(),
};
