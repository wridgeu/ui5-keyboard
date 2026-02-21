import net from "node:net";
import fs from "node:fs";
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
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

  return {
    async onPrepare() {
      if (await isPortInUse(port)) return;
      serverProcess = spawn(npxCommand, ["ui5", "serve", "--port", String(port)], {
        cwd: packageRoot,
        stdio: "pipe",
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

/**
 * Extract test IDs from a UI5 testsuite.qunit.ts file.
 * Keys are read from the "tests" object and returned in declaration order.
 */
export function readQUnitTestIds(testsuitePath: string): string[] {
  const source = fs.readFileSync(testsuitePath, "utf8");
  const testsIndex = source.indexOf("tests:");
  if (testsIndex < 0) {
    throw new Error(`No tests section found in ${testsuitePath}`);
  }

  const objectStart = source.indexOf("{", testsIndex);
  if (objectStart < 0) {
    throw new Error(`No tests object start found in ${testsuitePath}`);
  }

  let depth = 0;
  let objectEnd = -1;
  for (let i = objectStart; i < source.length; i++) {
    const char = source[i];
    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) {
        objectEnd = i;
        break;
      }
    }
  }

  if (objectEnd < 0) {
    throw new Error(`No tests object end found in ${testsuitePath}`);
  }

  const testsBlock = source.slice(objectStart + 1, objectEnd);
  const keyPattern = /^\s*(?:"([^"]+)"|([A-Za-z0-9_-]+)):\s*\{/gm;
  const ids: string[] = [];
  for (const match of testsBlock.matchAll(keyPattern)) {
    const id = match[1] ?? match[2];
    if (id) ids.push(id);
  }

  if (ids.length === 0) {
    throw new Error(`No test IDs extracted from ${testsuitePath}`);
  }

  return ids;
}
