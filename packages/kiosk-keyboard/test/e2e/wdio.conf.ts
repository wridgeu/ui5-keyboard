import url from "node:url";
import path from "node:path";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

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

  baseUrl: "http://localhost:8082",

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
};
