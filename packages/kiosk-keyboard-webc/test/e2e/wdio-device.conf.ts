import url from "node:url";
import path from "node:path";
import { createViteServerManager } from "../../../../tools/wdio-server.js";
import {
  buildChromeOptions,
  deviceProfiles,
  CHROME_VERSION,
  DEVICE_BASE_PORTS,
} from "../../../../tools/wdio-device-profiles.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
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
    },
  ],

  logLevel: "warn",

  connectionRetryTimeout: 300_000,
  connectionRetryCount: 2,

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

  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
