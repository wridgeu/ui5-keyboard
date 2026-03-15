import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import treeKill from "tree-kill";

const require = createRequire(import.meta.url);

function usage() {
  console.error(
    "Usage: node tools/run-ui5-shared-server-matrix.mjs <package-root> <port> -- <command> [<command> ...]",
  );
}

function resolveUi5CliEntry(packageRoot) {
  try {
    return require.resolve("@ui5/cli/bin/ui5.js", { paths: [packageRoot] });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to resolve @ui5/cli for '${packageRoot}'. ${reason}`, { cause: error });
  }
}

function probePort(port, timeout = 1_000) {
  return new Promise((resolve) => {
    const socket = net.createConnection(port, "localhost");
    socket.setTimeout(timeout);
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function waitForServer(port, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await probePort(port)) return;
    await delay(500);
  }
  throw new Error(`Server not ready on port ${port} after ${timeout}ms`);
}

async function waitForPortToClose(port, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!(await probePort(port))) return;
    await delay(250);
  }
  throw new Error(`Server on port ${port} did not close after ${timeout}ms`);
}

function killProcessTree(pid) {
  return new Promise((resolve) => {
    treeKill(pid, () => resolve());
  });
}

function spawnShell(command, cwd) {
  const child = spawn(command, {
    cwd,
    env: process.env,
    shell: true,
    stdio: "inherit",
    windowsHide: process.platform === "win32",
  });
  child.on("error", (err) => {
    console.error(`Child process failed: ${err.message}`);
  });
  return child;
}

const separatorIndex = process.argv.indexOf("--");
if (separatorIndex === -1 || separatorIndex < 4) {
  usage();
  process.exit(1);
}

const packageRoot = path.resolve(process.argv[2]);
const port = Number.parseInt(process.argv[3], 10);
const commands = process.argv.slice(separatorIndex + 1);

if (!Number.isFinite(port) || commands.length === 0) {
  usage();
  process.exit(1);
}

let serverProcess;
let ownsServer = false;
const runningChildren = new Set();

async function startServer() {
  if (await probePort(port)) return;
  const ui5CliEntry = resolveUi5CliEntry(packageRoot);
  serverProcess = spawn(process.execPath, [ui5CliEntry, "serve", "--port", String(port)], {
    cwd: packageRoot,
    env: process.env,
    shell: false,
    stdio: ["ignore", "ignore", "inherit"],
    windowsHide: process.platform === "win32",
  });
  serverProcess.on("error", (err) => {
    console.error(`Server process failed to start: ${err.message}`);
  });
  ownsServer = true;
  await waitForServer(port, 60_000);
}

async function stopServer() {
  if (!ownsServer || !serverProcess?.pid) return;
  const pid = serverProcess.pid;
  serverProcess = undefined;
  ownsServer = false;
  await killProcessTree(pid);
  await waitForPortToClose(port, 15_000);
}

async function stopChildren() {
  await Promise.all(
    [...runningChildren].map(async (child) => {
      runningChildren.delete(child);
      if (child.pid) {
        await killProcessTree(child.pid);
      }
    }),
  );
}

let shuttingDown = false;
async function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopChildren();
  await stopServer();
  process.exit(exitCode);
}

process.on("SIGINT", () => {
  void shutdown(130);
});
process.on("SIGTERM", () => {
  void shutdown(143);
});

try {
  await startServer();
} catch (err) {
  console.error(err);
  await stopServer();
  process.exit(1);
}

let remaining = commands.length;
let failed = false;

for (const command of commands) {
  const child = spawnShell(command, packageRoot);
  runningChildren.add(child);
  child.on("exit", (code, signal) => {
    runningChildren.delete(child);
    if (failed) return;
    if (signal || code !== 0) {
      failed = true;
      void shutdown(code ?? 1);
      return;
    }
    remaining -= 1;
    if (remaining === 0) {
      void shutdown(0);
    }
  });
}
