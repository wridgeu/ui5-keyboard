import net from "node:net";
import { type ChildProcess, spawn } from "node:child_process";
import treeKill from "tree-kill";

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

function killProcessTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    treeKill(pid, (err) => {
      if (err) console.warn(`Failed to kill process tree (pid ${pid}):`, err.message);
      resolve();
    });
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

    async onComplete() {
      if (!serverProcess?.pid) return;
      const pid = serverProcess.pid;
      serverProcess = undefined;
      await killProcessTree(pid);
    },
  };
}
