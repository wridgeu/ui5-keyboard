import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { describe, it } from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const guardPath = path.join(import.meta.dirname, "check-port-free.mjs");

/**
 * @param {number | string} port port to hand the guard
 * @returns {{ status: number | null, stderr: string }} the guard's exit status and diagnostics
 */
function runGuard(port) {
  const result = spawnSync(process.execPath, [guardPath, String(port)], { encoding: "utf8" });
  return { status: result.status, stderr: result.stderr };
}

/**
 * @param {string} host loopback address to bind
 * @returns {Promise<net.Server>} a server listening on an ephemeral port of that host
 */
function listenOn(host) {
  const server = net.createServer();
  return new Promise((resolve) => server.listen(0, host, () => resolve(server)));
}

/**
 * @param {net.Server} server
 * @returns {number} the ephemeral port the server bound
 */
function portOf(server) {
  // `address()` answers with a pipe path for a UDS server and with null before
  // the socket is listening; only a TCP binding answers with a port record.
  const address = server.address();
  if (!(address instanceof Object)) throw new Error("Server is not bound to a TCP port.");
  return address.port;
}

/**
 * @param {net.Server} server
 * @returns {Promise<void>}
 */
function close(server) {
  return new Promise((resolve) => server.close(() => resolve(undefined)));
}

describe("check-port-free", () => {
  it("exits 0 when nothing is listening", async () => {
    // An ephemeral port the OS just handed out and that is released again: the
    // closest a test gets to a port known to be free.
    const server = await listenOn("127.0.0.1");
    const port = portOf(server);
    await close(server);

    const { status, stderr } = runGuard(port);
    assert.equal(status, 0, stderr);
  });

  it("exits 1 when a server is listening on 127.0.0.1", async () => {
    const server = await listenOn("127.0.0.1");
    try {
      const { status, stderr } = runGuard(portOf(server));
      assert.equal(status, 1, stderr);
      assert.match(stderr, /already in use on 127\.0\.0\.1\./);
    } finally {
      await close(server);
    }
  });

  it("exits 1 when a server is listening on ::1", async () => {
    const server = await listenOn("::1");
    try {
      const { status, stderr } = runGuard(portOf(server));
      assert.equal(status, 1, stderr);
      assert.match(stderr, /already in use on ::1\./);
    } finally {
      await close(server);
    }
  });
});

/**
 * @param {string} script the `test:qunit` command line
 * @param {RegExp} pattern pattern whose first group holds the port
 * @param {string} what description of the port for the failure message
 * @returns {string} the captured port
 */
function portIn(script, pattern, what) {
  const port = script.match(pattern)?.[1];
  if (!port) throw new Error(`No ${what} found in: ${script}`);
  return port;
}

/**
 * @param {string} workspace package directory under `packages/`
 * @returns {string} that package's `test:qunit` script
 */
function qunitScript(workspace) {
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, "packages", workspace, "package.json"), "utf8"));
  const script = manifest.scripts?.["test:qunit"];
  if (script === undefined) throw new Error(`packages/${workspace} has no test:qunit script.`);
  return script;
}

/**
 * Asserts the guard is wired ahead of `start-server-and-test` on the same port
 * that is served and polled, and returns that port.
 *
 * @param {string} workspace package directory under `packages/`
 * @returns {string} the guarded port
 */
function assertGuarded(workspace) {
  const script = qunitScript(workspace);
  const guarded = portIn(script, /check-port-free\.mjs (\d+)/, "check-port-free.mjs argument");
  const served = portIn(script, /--port (\d+)/, "ui5 serve --port");
  const polled = portIn(script, /http:\/\/localhost:(\d+)\//, "localhost url port");

  assert.equal(guarded, served, `${workspace}: guard port ${guarded} does not match the --port ${served}`);
  assert.equal(guarded, polled, `${workspace}: guard port ${guarded} does not match the polled url port ${polled}`);
  assert.ok(
    script.indexOf("check-port-free.mjs") < script.indexOf("start-server-and-test"),
    `${workspace}: the guard must run before start-server-and-test, otherwise the suite is already running against the foreign server`,
  );
  return guarded;
}

describe("test:qunit port wiring", () => {
  it("guards the served port in every package that runs a QUnit server", () => {
    assert.equal(assertGuarded("kiosk-keyboard"), "8082");
    assert.equal(assertGuarded("hotkeys"), "8081");
  });
});
