import net from "node:net";
import fs from "node:fs";
import path from "node:path";
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

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection(port, "localhost");
    socket.setTimeout(5_000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
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
        socket.destroy();
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
export function createServerManager(port: number, packageRoot: string, configFile?: string, startupTimeout = 60_000) {
  let serverProcess: ChildProcess | undefined;

  return {
    async onPrepare() {
      if (await isPortInUse(port)) return;
      const ui5CliEntry = resolveUi5CliEntry(packageRoot);
      const args = [ui5CliEntry, "serve", "--port", String(port)];
      if (configFile) args.push("--config", configFile);
      serverProcess = spawn(process.execPath, args, {
        cwd: packageRoot,
        stdio: ["ignore", "pipe", "inherit"],
        shell: false,
        windowsHide: process.platform === "win32",
      });
      await waitForServer(port, startupTimeout);
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

  // Write spec files idempotently — no cleanup needed since the file set
  // is deterministic.  Worker processes may reload this config concurrently,
  // so we must avoid deleting files that other workers are already reading.
  return testIds.map((id) => {
    const specPath = path.join(outputDir, `${id}.spec.js`);
    const url = urlFn(id);
    fs.writeFileSync(
      specPath,
      [
        `describe(${JSON.stringify("QUnit: " + id)}, function () {`,
        `  it("should pass QUnit tests", async function () {`,
        `    await browser.url(${JSON.stringify(url)});`,
        `    await browser.getQUnitResults();`,
        `  });`,
        `});`,
        ``,
      ].join("\n"),
    );
    return specPath;
  });
}
