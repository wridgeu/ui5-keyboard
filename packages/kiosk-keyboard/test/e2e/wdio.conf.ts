import path from "node:path";
import type { wdi5Config } from "wdio-ui5-service";
import { createServerManager } from "../../../../tools/wdio-server.js";
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
const PORT = 8085;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

const server = createServerManager(
  PORT,
  PACKAGE_ROOT,
  undefined,
  60_000,
  "/test-resources/ui5/kiosk/e2e/visual/index.html",
);

const headless = !process.env.HEADED && !process.argv.includes("--headed");
const runReadmeScreenshots = process.argv.includes("--readme-screenshots");
const updateVisualBaseline = process.argv.includes("--update-visual-baseline");
const chromeArgs = [`--window-size=${DESKTOP_WINDOW_SIZE}`, ...BASE_CHROME_ARGS];
if (headless) chromeArgs.unshift("--headless=new");

const cachedBinaries = resolveCachedBinaries();
const chromedriverOpts = buildChromedriverOptions();

export const config: wdi5Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  specs: [path.resolve(__dirname, "**/*.test.ts")],
  exclude: [
    ...(runReadmeScreenshots ? [] : [path.resolve(__dirname, "readme-screenshots.test.ts")]),
    path.resolve(__dirname, "flp-lifecycle.test.ts"),
  ],

  maxInstances: 5,

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
