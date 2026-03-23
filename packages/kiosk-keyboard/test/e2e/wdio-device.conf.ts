import url from "node:url";
import path from "node:path";
import type { wdi5Config } from "wdio-ui5-service";
import { createServerManager } from "../../../../tools/wdio-server.js";
import {
  buildChromeOptions,
  buildChromedriverOptions,
  deviceProfiles,
  CHROME_VERSION,
  DEVICE_BASE_PORTS,
  ensureBrowsersDownloaded,
} from "../../../../tools/wdio-device-profiles.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const BASE_PORT = DEVICE_BASE_PORTS["kiosk-keyboard"];
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

const deviceArg = process.argv.find((a) => a.startsWith("--device="));
const deviceName = deviceArg?.split("=")[1];
if (!deviceName || !deviceProfiles[deviceName]) {
  const validDevices = Object.keys(deviceProfiles).join(", ");
  throw new Error(`Unknown or missing device profile: ${deviceName}. Use --device=${validDevices}.`);
}
const profile = deviceProfiles[deviceName];
const PORT = BASE_PORT + profile.portOffset;

const server = createServerManager(
  PORT,
  PACKAGE_ROOT,
  undefined,
  60_000,
  "/test-resources/ui5/kiosk/e2e/visual/index.html",
);
const headless = !process.env.HEADED && !process.argv.includes("--headed");
const updateVisualBaseline = process.argv.includes("--update-visual-baseline");

const chromedriverOpts = buildChromedriverOptions();

export const config: wdi5Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  specs: [
    path.resolve(__dirname, "visual.test.ts"),
    // Fixed-width container tests (400-600px fixtures) only on profiles wide
    // enough to hold them. Viewport-width responsive tests run on all profiles.
    ...(profile.width >= 400 ? [path.resolve(__dirname, "visual-container.test.ts")] : []),
    path.resolve(__dirname, "visual-container-responsive.test.ts"),
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

  wdi5: {
    skipInjectUI5OnStart: true,
    waitForUI5Timeout: 20_000,
  },

  specFileRetries: 1,
  specFileRetriesDelay: 0,

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
        baselineFolder: path.resolve(__dirname, `__baselines__/${profile.id}`),
        formatImageName: "{tag}",
        screenshotPath: path.resolve(__dirname, `__screenshots__/${profile.id}`),
        autoSaveBaseline: updateVisualBaseline,
        createJsonReportFiles: true,
        disableCSSAnimation: true,
        hideScrollBars: true,
        waitForFontsLoaded: true,
      },
    ],
  ],

  onPrepare: async () => {
    await ensureBrowsersDownloaded();
    await server.onPrepare();
  },
  onWorkerStart: () => server.ensureRunning(),
  onComplete: () => server.onComplete(),
};
