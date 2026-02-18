import net from "node:net";
import { type ChildProcess, execSync, spawn } from "node:child_process";

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

/**
 * Creates wdio lifecycle hooks that auto-start a UI5 dev server
 * if the target port is not already in use, and tear it down on completion.
 */
export function createServerManager(port: number, packageRoot: string) {
  let serverProcess: ChildProcess | undefined;

  return {
    async onPrepare() {
      if (await isPortInUse(port)) return;
      serverProcess = spawn("npx", ["ui5", "serve", "--port", String(port)], {
        cwd: packageRoot,
        stdio: "pipe",
        shell: true,
      });
      await waitForServer(port);
    },

    onComplete() {
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
    },
  };
}
