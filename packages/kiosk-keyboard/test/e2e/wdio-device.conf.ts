import url from "node:url";
import path from "node:path";
import type { wdi5Config } from "wdio-ui5-service";
import { createServerManager } from "../../../../tools/wdio-server.js";
import { buildChromeOptions, deviceProfiles } from "../../../../tools/wdio-device-profiles.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PORT = 8082;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

const server = createServerManager(PORT, PACKAGE_ROOT);

const deviceArg = process.argv.find((a) => a.startsWith("--device="));
const deviceName = deviceArg?.split("=")[1];
if (!deviceName || !deviceProfiles[deviceName]) {
  throw new Error(`Unknown or missing device profile: ${deviceName}. Use --device=phone or --device=tablet.`);
}
const profile = deviceProfiles[deviceName];
const headless = !process.env.HEADED && !process.argv.includes("--headed");
const updateVisualBaseline = process.argv.includes("--update-visual-baseline");

export const config: wdi5Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  specs: [path.resolve(__dirname, "visual.test.ts")],

  maxInstances: 1,
  maxInstancesPerCapability: 1,

  capabilities: [
    {
      browserName: "chrome",
      "goog:chromeOptions": buildChromeOptions(profile, headless),
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
        baselineFolder: path.resolve(__dirname, `__baselines__/${profile.id}`),
        formatImageName: "{tag}-{logName}-{width}x{height}",
        screenshotPath: path.resolve(__dirname, `__screenshots__/${profile.id}`),
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
