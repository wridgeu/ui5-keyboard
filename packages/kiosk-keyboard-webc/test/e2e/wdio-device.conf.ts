import url from "node:url";
import path from "node:path";
import { createViteServerManager } from "../../../../tools/wdio-server.js";
import { buildChromeOptions, deviceProfiles } from "../../../../tools/wdio-device-profiles.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PORT = 8084;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

const server = createViteServerManager(PORT, PACKAGE_ROOT);

const deviceArg = process.argv.find((a) => a.startsWith("--device="));
const deviceName = deviceArg?.split("=")[1];
if (!deviceName || !deviceProfiles[deviceName]) {
  throw new Error(`Unknown or missing device profile: ${deviceName}. Use --device=phone or --device=tablet.`);
}
const profile = deviceProfiles[deviceName];
const headless = !process.env.HEADED && !process.argv.includes("--headed");
const updateVisualBaseline = process.argv.includes("--update-visual-baseline");

export const config: WebdriverIO.Config = {
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
        disableCSSAnimation: true,
        hideScrollBars: true,
        waitForFontsLoaded: true,
      },
    ],
  ],

  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
