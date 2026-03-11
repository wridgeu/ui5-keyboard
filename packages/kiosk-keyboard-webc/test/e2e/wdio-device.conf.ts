import url from "node:url";
import path from "node:path";
import { createViteServerManager } from "../../../../tools/wdio-server.js";
import { buildChromeOptions, deviceProfiles, CHROME_VERSION } from "../../../../tools/wdio-device-profiles.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
// Base port for this package's device tests. Each device profile adds its own
// portOffset (phone: +1, tablet: +2) so profiles can run in parallel without
// collisions. The kiosk-keyboard package uses BASE_PORT 8089 — keep these
// ranges non-overlapping when adding new packages or device profiles.
const BASE_PORT = 8086;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

const deviceArg = process.argv.find((a) => a.startsWith("--device="));
const deviceName = deviceArg?.split("=")[1];
if (!deviceName || !deviceProfiles[deviceName]) {
  const validDevices = Object.keys(deviceProfiles).join(", ");
  throw new Error(`Unknown or missing device profile: ${deviceName}. Use --device=${validDevices}.`);
}
const profile = deviceProfiles[deviceName];
const PORT = BASE_PORT + profile.portOffset;

const server = createViteServerManager(PORT, PACKAGE_ROOT);
const headless = !process.env.HEADED && !process.argv.includes("--headed");
const updateVisualBaseline = process.argv.includes("--update-visual-baseline");

export const config: WebdriverIO.Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  specs: [
    path.resolve(__dirname, "visual.test.ts"),
    path.resolve(__dirname, "rtl.test.ts"),
    path.resolve(__dirname, "accessibility-media.test.ts"),
  ],

  maxInstances: 1,
  maxInstancesPerCapability: 1,

  capabilities: [
    {
      browserName: "chrome",
      browserVersion: CHROME_VERSION,
      "goog:chromeOptions": buildChromeOptions(profile, headless),
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
        baselineFolder: path.resolve(__dirname, `__baselines__/${profile.id}`),
        formatImageName: "{tag}-{logName}-{width}x{height}",
        screenshotPath: path.resolve(__dirname, `__screenshots__/${profile.id}`),
        autoSaveBaseline: updateVisualBaseline,
        createJsonReportFiles: true,
        disableCSSAnimation: true,
        hideScrollBars: true,
        waitForFontsLoaded: true,
      },
    ],
  ],

  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
