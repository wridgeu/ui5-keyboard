import url from "node:url";
import path from "node:path";
import net from "node:net";
import { type ChildProcess, execSync, spawn } from "node:child_process";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PORT = 8082;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

let serverProcess: ChildProcess | undefined;

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection(port, "localhost");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

function waitForServer(port: number, timeout = 30_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      const socket = net.createConnection(port, "localhost");
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Server not ready on port ${port} after ${timeout}ms`));
        } else {
          setTimeout(check, 500);
        }
      });
    }
    check();
  });
}

function stopServer(): void {
  if (!serverProcess?.pid) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /pid ${serverProcess.pid} /f /t`, { stdio: "ignore" });
    } catch {
      // already exited
    }
  } else {
    serverProcess.kill();
  }
  serverProcess = undefined;
}

export const config: WebdriverIO.Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  maxInstances: 1,

  capabilities: [
    {
      browserName: "chrome",
      "goog:chromeOptions": {
        args: ["--headless=new", "--window-size=1440,900", "--disable-gpu", "--no-sandbox"],
      },
    },
  ],

  logLevel: "warn",

  baseUrl: `http://localhost:${PORT}`,
  waitforTimeout: 90_000,

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 120_000,
  },

  reporters: ["spec"],

  services: [
    [
      "qunit",
      {
        paths: [
          "/test-resources/ui5/kiosk/qunit/Test.qunit.html?testsuite=test-resources/ui5/kiosk/qunit/testsuite.qunit&test=KioskKeyboard",
        ],
      },
    ],
  ],

  async onPrepare() {
    if (await isPortInUse(PORT)) return;
    serverProcess = spawn("npx", ["ui5", "serve", "--port", String(PORT)], {
      cwd: PACKAGE_ROOT,
      stdio: "pipe",
      shell: true,
    });
    await waitForServer(PORT);
  },

  onComplete() {
    stopServer();
  },
};
