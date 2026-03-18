import net from "node:net";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import { type ChildProcess, spawn } from "node:child_process";
import ts from "typescript";
import treeKill from "tree-kill";

const require = createRequire(import.meta.url);

function resolveUi5CliEntry(packageRoot: string): string {
  try {
    return require.resolve("@ui5/cli/bin/ui5.js", { paths: [packageRoot] });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to resolve @ui5/cli for '${packageRoot}'. Install dependencies before running tests. ${reason}`,
      { cause: error },
    );
  }
}

/** Probes whether a TCP connection to localhost:port succeeds within the given timeout. */
function probePort(port: number, timeout = 1_000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection(port, "localhost");
    socket.setTimeout(timeout);
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function isSuccessfulHttpStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 400;
}

/** Polls until the server on the given port accepts TCP connections and responds to the expected HTTP path. */
async function waitForServer(port: number, timeout: number, readinessPath = "/"): Promise<void> {
  const deadline = Date.now() + timeout;
  // Phase 1: wait for TCP
  while (Date.now() < deadline) {
    if (await probePort(port)) break;
    await delay(500);
  }
  if (Date.now() >= deadline) {
    throw new Error(`Server not ready on port ${port} after ${timeout}ms (TCP)`);
  }
  // Phase 2: wait for HTTP readiness (server may accept TCP before it can serve content)
  while (Date.now() < deadline) {
    if (await probeHttp(port, readinessPath)) return;
    await delay(500);
  }
  throw new Error(`Server on port ${port} accepts TCP but does not serve '${readinessPath}' after ${timeout}ms`);
}

/** Verifies that an HTTP server on localhost:port serves the expected path with a 2xx/3xx status. */
function probeHttp(port: number, readinessPath = "/", timeout = 3_000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}${readinessPath}`, { timeout }, (res) => {
      resolve(isSuccessfulHttpStatus(res.statusCode ?? 0));
      res.resume(); // drain the response
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

/** Polls until the given localhost port no longer accepts TCP connections. */
async function waitForPortToClose(port: number, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!(await probePort(port))) return;
    await delay(250);
  }
  throw new Error(`Server on port ${port} did not close after ${timeout}ms`);
}

function killProcessTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    treeKill(pid, (err) => {
      if (err) console.warn(`Failed to kill process tree (pid ${pid}):`, err.message);
      resolve();
    });
  });
}

const MAX_STARTUP_OUTPUT_CHARS = 12_000;

function createStartupOutputBuffer() {
  let output = "";

  return {
    append(stream: "stdout" | "stderr", chunk: Buffer | string): void {
      const text = chunk.toString().trim();
      if (!text) return;
      output += `[${stream}] ${text}\n`;
      if (output.length > MAX_STARTUP_OUTPUT_CHARS) {
        output = output.slice(-MAX_STARTUP_OUTPUT_CHARS);
      }
    },
    format(): string {
      return output ? `\nRecent server output:\n${output}` : "";
    },
  };
}

function createStartupFailureMonitor(
  child: ChildProcess,
  label: string,
  getRecentOutput: () => string,
): { promise: Promise<never>; complete: () => void } {
  let startupFinished = false;
  let rejectStartup!: (reason: Error) => void;

  const onError = (error: Error) => {
    if (startupFinished) return;
    rejectStartup(
      new Error(`${label} failed before becoming ready: ${error.message}${getRecentOutput()}`, { cause: error }),
    );
  };

  const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
    if (startupFinished) return;
    rejectStartup(
      new Error(
        `${label} exited before becoming ready (code=${code ?? "null"}, signal=${signal ?? "null"})${getRecentOutput()}`,
      ),
    );
  };

  const promise = new Promise<never>((_, reject) => {
    rejectStartup = reject;
  });

  child.once("error", onError);
  child.once("exit", onExit);

  return {
    promise,
    complete() {
      startupFinished = true;
      child.off("error", onError);
      child.off("exit", onExit);
    },
  };
}

/** Shared startup/shutdown logic for child dev servers (UI5 CLI, Vite, etc.). */
function createChildServerManager(opts: {
  port: number;
  packageRoot: string;
  label: string;
  spawnArgs: string[];
  startupTimeout: number;
  readinessPath: string;
}) {
  const { port, packageRoot, label, spawnArgs, startupTimeout, readinessPath } = opts;
  let serverProcess: ChildProcess | undefined;

  async function start(): Promise<void> {
    if (await probePort(port)) {
      // Port is occupied -- verify it's actually serving the expected content.
      // Stale processes from killed test runs keep the port open but serve
      // nothing, causing "Keyboard keys not rendered" timeouts downstream.
      if (!(await probeHttp(port, readinessPath))) {
        throw new Error(
          `Port ${port} is occupied by a process that does not serve '${readinessPath}'. ` +
            `Kill the stale or wrong process (netstat -aon | findstr :${port}) and retry.`,
        );
      }
      return;
    }
    const startupOutput = createStartupOutputBuffer();
    serverProcess = spawn(process.execPath, spawnArgs, {
      cwd: packageRoot,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: process.platform === "win32",
    });

    serverProcess.stdout?.on("data", (chunk) => startupOutput.append("stdout", chunk));
    serverProcess.stderr?.on("data", (chunk) => startupOutput.append("stderr", chunk));

    const startupFailure = createStartupFailureMonitor(serverProcess, label, () => startupOutput.format());

    try {
      await Promise.race([
        waitForServer(port, startupTimeout, readinessPath).catch((error) => {
          throw new Error(`${(error as Error).message}${startupOutput.format()}`, { cause: error });
        }),
        startupFailure.promise,
      ]);
    } catch (error) {
      startupFailure.complete();
      if (serverProcess?.pid) {
        await killProcessTree(serverProcess.pid);
      }
      serverProcess = undefined;
      throw error;
    }

    startupFailure.complete();
  }

  async function stop(): Promise<void> {
    if (!serverProcess?.pid) return;
    const pid = serverProcess.pid;
    serverProcess = undefined;
    await killProcessTree(pid);
    await waitForPortToClose(port, 15_000);
  }

  return {
    onPrepare: start,
    onComplete: stop,
    [Symbol.asyncDispose]: stop,
  };
}

/**
 * Creates wdio lifecycle hooks that auto-start a UI5 dev server
 * if the target port is not already in use, and tear it down on completion.
 *
 * The returned object also implements `Symbol.asyncDispose` so it can be
 * used with `await using` for automatic cleanup.
 */
export function createServerManager(
  port: number,
  packageRoot: string,
  configFile?: string,
  startupTimeout = 60_000,
  readinessPath = "/",
) {
  const ui5CliEntry = resolveUi5CliEntry(packageRoot);
  const args = [ui5CliEntry, "serve", "--port", String(port)];
  if (configFile) args.push("--config", configFile);

  return createChildServerManager({
    port,
    packageRoot,
    label: `UI5 server on port ${port}`,
    spawnArgs: args,
    startupTimeout,
    readinessPath,
  });
}

function resolveViteCliEntry(packageRoot: string): string {
  try {
    const vitePkgPath = require.resolve("vite/package.json", { paths: [packageRoot] });
    return path.resolve(path.dirname(vitePkgPath), "bin", "vite.js");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to resolve vite for '${packageRoot}'. Install dependencies before running tests. ${reason}`,
      { cause: error },
    );
  }
}

/**
 * Creates wdio lifecycle hooks that start a Vite dev server for packages
 * that use Vite for bundling (e.g. kiosk-keyboard-webc).
 *
 * Unlike a plain static file server, Vite resolves bare module specifiers
 * (e.g. `@ui5/webcomponents/dist/Input.js`) so test pages with ES module
 * imports work without an import map.
 *
 * Mirrors the `createServerManager` API so consumers use the same pattern.
 */
export function createViteServerManager(
  port: number,
  packageRoot: string,
  startupTimeout = 60_000,
  readinessPath = "/",
) {
  const viteCliEntry = resolveViteCliEntry(packageRoot);

  return createChildServerManager({
    port,
    packageRoot,
    label: `Vite server on port ${port}`,
    spawnArgs: [viteCliEntry, "--port", String(port), "--strictPort"],
    startupTimeout,
    readinessPath,
  });
}

/**
 * Extract test IDs from a UI5 testsuite.qunit.ts file.
 * Keys are read from the "tests" object and returned in declaration order.
 *
 * Uses TypeScript AST parsing (not regex/brace matching) so formatting changes
 * in testsuite files do not break extraction.
 */
export function readQUnitTestIds(testsuitePath: string): string[] {
  const source = fs.readFileSync(testsuitePath, "utf8");

  const sourceFile = ts.createSourceFile(testsuitePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const getPropertyName = (name: ts.PropertyName): string | null => {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
      return name.text;
    }
    return null;
  };

  const findTestsObject = (node: ts.Node): ts.ObjectLiteralExpression | null => {
    if (ts.isPropertyAssignment(node) && getPropertyName(node.name) === "tests") {
      if (ts.isObjectLiteralExpression(node.initializer)) {
        return node.initializer;
      }
      throw new Error(`tests section in ${testsuitePath} is not an object literal`);
    }

    for (const child of node.getChildren(sourceFile)) {
      const found = findTestsObject(child);
      if (found) return found;
    }

    return null;
  };

  const resolvedTestsObject = findTestsObject(sourceFile);
  if (!resolvedTestsObject) {
    throw new Error(`No tests section found in ${testsuitePath}`);
  }

  const ids: string[] = [];
  for (const prop of resolvedTestsObject.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      throw new Error(
        `Unsupported property syntax in tests object in ${testsuitePath} (only standard key: value entries are supported)`,
      );
    }
    const id = getPropertyName(prop.name);
    if (!id) {
      throw new Error(`Unsupported test key syntax in ${testsuitePath}`);
    }
    ids.push(id);
  }

  if (ids.length === 0) {
    throw new Error(`No test IDs extracted from ${testsuitePath}`);
  }

  return ids;
}

/**
 * Generate one spec file per QUnit test ID so that WebdriverIO can distribute
 * them across parallel browser instances via `maxInstances`.
 *
 * Each generated file navigates to the QUnit HTML page for a single test
 * and uses `browser.getQUnitResults()` (provided by wdio-qunit-service).
 *
 * @param testIds    Test IDs extracted from the testsuite file.
 * @param outputDir  Directory to write the generated `.spec.js` files into.
 * @param urlFn      Function that maps a test ID to its QUnit HTML URL path.
 * @returns Array of absolute file paths for generated spec files.
 */
export function generateQUnitSpecs(testIds: string[], outputDir: string, urlFn: (name: string) => string): string[] {
  fs.mkdirSync(outputDir, { recursive: true });

  // Write spec files idempotently - no cleanup needed since the file set
  // is deterministic.  Worker processes may reload this config concurrently,
  // so we must avoid deleting files that other workers are already reading.
  return testIds.map((id) => {
    const specPath = path.join(outputDir, `${id}.spec.js`);
    const url = urlFn(id);
    fs.writeFileSync(
      specPath,
      `describe(${JSON.stringify("QUnit: " + id)}, function () {
  it("should pass QUnit tests", async function () {
    await browser.url(${JSON.stringify(url)});
    await browser.getQUnitResults();
  });
});
`,
    );
    return specPath;
  });
}
