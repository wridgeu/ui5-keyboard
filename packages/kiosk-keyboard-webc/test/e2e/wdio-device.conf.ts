import path from "node:path";
import { createViteServerManager } from "../../../../tools/wdio-server.js";
import {
  buildChromeOptions,
  buildChromedriverOptions,
  deviceProfiles,
  CHROME_VERSION,
  DEVICE_BASE_PORTS,
  ensureBrowsersDownloaded,
  cleanScreenshots,
} from "../../../../tools/wdio-device-profiles.js";

const __dirname = import.meta.dirname;
const BASE_PORT = DEVICE_BASE_PORTS["kiosk-keyboard-webc"];
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

const deviceArg = process.argv.find((a) => a.startsWith("--device="));
const deviceName = deviceArg?.split("=")[1];
if (!deviceName || !deviceProfiles[deviceName]) {
  const validDevices = Object.keys(deviceProfiles).join(", ");
  throw new Error(`Unknown or missing device profile: ${deviceName}. Use --device=${validDevices}.`);
}
const profile = deviceProfiles[deviceName];
const PORT = BASE_PORT + profile.portOffset;

const server = createViteServerManager(PORT, PACKAGE_ROOT, 60_000, "/test/pages/index.html");
const headless = !process.env.HEADED && !process.argv.includes("--headed");
const updateVisualBaseline = process.argv.includes("--update-visual-baseline");

const chromedriverOpts = buildChromedriverOptions();

export const config: WebdriverIO.Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  specs: [
    path.resolve(__dirname, "visual.test.ts"),
    path.resolve(__dirname, "visual-container.test.ts"),
    path.resolve(__dirname, "visual-enhancements.test.ts"),
    path.resolve(__dirname, "visual-themes.test.ts"),
    path.resolve(__dirname, "rtl.test.ts"),
    path.resolve(__dirname, "accessibility-media.test.ts"),
  ],

  maxInstances: 1,
  maxInstancesPerCapability: 1,

  capabilities: [
    {
      browserName: "chrome",
      browserVersion: CHROME_VERSION,
      "wdio:maxInstances": 1,
      "goog:chromeOptions": buildChromeOptions(profile, headless),
      ...(chromedriverOpts ? { "wdio:chromedriverOptions": chromedriverOpts } : {}),
    },
  ],

  logLevel: "warn",

  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,

  baseUrl: `http://localhost:${PORT}`,

  specFileRetries: 1,
  specFileRetriesDelay: 0,

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
        baselineFolder: path.resolve(__dirname, `__baselines__/${profile.id}`),
        formatImageName: "{tag}",
        screenshotPath: path.resolve(__dirname, `__screenshots__/${profile.id}`),
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
    cleanScreenshots(path.resolve(__dirname, `__screenshots__/${profile.id}`));
    await server.onPrepare();
  },
  onWorkerStart: () => server.ensureRunning(),
  // onWorkerStart runs once per worker process, not per spec file. If the
  // server crashes mid-run, subsequent specs in the same worker would see a
  // dead server. beforeSuite runs before each spec file, closing that gap.
  beforeSuite: () => server.ensureRunning(),
  onComplete: () => server.onComplete(),
};
