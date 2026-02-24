import net from "node:net";
import fs from "node:fs";
import { type ChildProcess, spawn } from "node:child_process";
import ts from "typescript";
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
  const useShell = process.platform === "win32";

  return {
    async onPrepare() {
      if (await isPortInUse(port)) return;
      serverProcess = spawn(npxCommand, ["ui5", "serve", "--port", String(port)], {
        cwd: packageRoot,
        stdio: "pipe",
        shell: useShell,
        windowsHide: useShell,
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
